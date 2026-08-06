import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { bootstrapJhnLocalCopAuthority } from "../../scripts/bootstrap-jhn-cop-local.js";
import { createJhnLocalAgent } from "../cop/jhnLocalAgent.js";
import { readJhnConversationState } from "../cop/jhnConversationState.js";
import { createJhnLocalCapabilityIssuer } from "../cop/localCapabilityIssuer.js";
import { createJhnLocalCopRuntime } from "../cop/localRuntimeServer.js";
import { createOpenAIJhnReasoner } from "../cop/jhnReasoner.js";

test("automated end-to-end coverage for browser console and conversation restart path", async () => {
  const stateDirectory = await mkdtemp(path.join(os.tmpdir(), "jhn-cop-console-test-"));
  const clock = () => new Date("2026-08-02T10:00:00.000Z");
  const closeFetch = (url, options = {}) =>
    fetch(url, {
      ...options,
      headers: { ...options.headers, connection: "close" },
    });

  try {
    await bootstrapJhnLocalCopAuthority({ stateDirectory, clock });

    const historyLog = [];
    const createMockReasoner = () =>
      createOpenAIJhnReasoner({
        client: {
          responses: {
            create: async (request) => {
              historyLog.push(request.input);
              const lastMessage = request.input.split("\n").at(-1);
              const reply = lastMessage?.includes("secret")
                ? "Your secret word is cedar."
                : "Hello Jean-Hugues.";
              return { id: "resp_test", output_text: reply, usage: { total_tokens: 15 } };
            },
          },
        },
      });

    // Helper to start runtime + console server
    async function startConsoleStack() {
      const runtime = await createJhnLocalCopRuntime({ stateDirectory, clock });
      const runtimeAddress = await runtime.listen();
      const issuer = await createJhnLocalCapabilityIssuer({ stateDirectory, clock });
      const reasoner = createMockReasoner();

      const page = `<!doctype html><html><body>John Console</body></html>`;
      const server = createServer(async (request, response) => {
        if (request.method === "GET" && request.url === "/") {
          response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          response.end(page);
          return;
        }
        if (request.method === "POST" && request.url === "/chat") {
          try {
            const chunks = [];
            for await (const chunk of request) chunks.push(chunk);
            const { message, conversationId = "john" } = JSON.parse(
              Buffer.concat(chunks).toString("utf8")
            );
            const capability = await issuer.issue({ subject: "principal:jhn:runtime" });
            const state = readJhnConversationState({ stateDirectory, conversationId });
            const agent = createJhnLocalAgent({
              runtimeUrl: `http://${runtimeAddress.host}:${runtimeAddress.port}`,
              capability,
              reasoner,
              fetchImpl: closeFetch,
            });
            const result = await agent.turn({ message, conversationId, history: state.history });
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({ text: result.text }));
          } catch (error) {
            response.writeHead(400, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: error.message }));
          }
          return;
        }
        response.writeHead(404).end();
      });

      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      const consoleUrl = `http://127.0.0.1:${address.port}`;

      return {
        consoleUrl,
        async stop() {
          server.closeAllConnections?.();
          await new Promise((resolve) => server.close(resolve));
          issuer.close();
          await runtime.close();
        },
      };
    }

    // Session 1: Turn 1
    const stack1 = await startConsoleStack();
    const htmlResponse = await closeFetch(`${stack1.consoleUrl}/`);
    assert.equal(htmlResponse.status, 200);
    assert.match(await htmlResponse.text(), /John Console/);

    const turn1 = await closeFetch(`${stack1.consoleUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "My secret word is cedar", conversationId: "john" }),
    });
    assert.equal(turn1.status, 200);
    const body1 = await turn1.json();
    assert.equal(body1.text, "Your secret word is cedar.");

    // Verify persistence in SQLite
    const stateBeforeRestart = readJhnConversationState({ stateDirectory, conversationId: "john" });
    assert.equal(stateBeforeRestart.history.length, 2);
    assert.equal(stateBeforeRestart.history[0].role, "user");
    assert.equal(stateBeforeRestart.history[0].message, "My secret word is cedar");
    assert.equal(stateBeforeRestart.history[1].role, "assistant");
    assert.equal(stateBeforeRestart.history[1].message, "Your secret word is cedar.");

    // Stop session 1 (simulate restart)
    await stack1.stop();

    // Session 2: Turn 2 after restart
    const stack2 = await startConsoleStack();

    const turn2 = await closeFetch(`${stack2.consoleUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Repeat my secret word", conversationId: "john" }),
    });
    assert.equal(turn2.status, 200);
    const body2 = await turn2.json();
    assert.equal(body2.text, "Your secret word is cedar.");

    // Verify reconstructed history was passed to reasoner during turn 2
    const lastInput = historyLog[historyLog.length - 1];
    assert.equal(lastInput.split("\n").length, 3); // turn 1 user + turn 1 assistant + turn 2 user
    assert.match(lastInput, /^User: My secret word is cedar/m);

    // Verify updated persistence in SQLite
    const stateAfterRestart = readJhnConversationState({ stateDirectory, conversationId: "john" });
    assert.equal(stateAfterRestart.history.length, 4);

    await stack2.stop();
  } finally {
    await rm(stateDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  }
});
