import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { connectAcpStdio, AcpProtocolError } from "../src/acp.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, "fixtures", "fake-acp-agent.js");

async function withClient({ agentArgs = [], ...options }, run) {
  const updates = [];
  const client = await connectAcpStdio({
    command: process.execPath,
    args: [fixture, ...agentArgs],
    cwd: process.cwd(),
    onSessionUpdate: (update) => updates.push(update),
    ...options,
  });
  try {
    await run(client, updates);
  } finally {
    client.terminate();
  }
}

test("ACP stdio client performs v1 session lifecycle and streams updates", async () => {
  await withClient({}, async (client, updates) => {
    assert.equal(client.initialization.protocolVersion, 1);
    assert.equal(client.initialization.agentInfo.name, "fake-acp-agent");
    const session = await client.newSession({ cwd: process.cwd() });
    const prompt = await client.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "Please inspect this safely." }],
    });
    assert.equal(prompt.stopReason, "end_turn");
    assert.deepEqual(updates, [
      {
        sessionId: session.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          messageId: "message-1",
          content: { type: "text", text: "fake ACP answer" },
        },
      },
    ]);
    assert.equal(await client.closeSession(session.sessionId), true);
  });
});

test("ACP client cancels a turn and handles an explicit permission response", async () => {
  let permission;
  await withClient(
    {
      requestPermission: (params) => {
        permission = params;
        return { outcome: "allow_once" };
      },
    },
    async (client) => {
      const { sessionId } = await client.newSession({ cwd: process.cwd() });
      const prompt = client.prompt({
        sessionId,
        prompt: [{ type: "text", text: "permission then wait" }],
      });
      client.cancel(sessionId);
      assert.equal((await prompt).stopReason, "cancelled");
      assert.equal(permission.sessionId, sessionId);
    }
  );
});

test("ACP client keeps MCP servers opt-in to prevent ambient re-entry", async () => {
  await withClient({}, async (client) => {
    await assert.rejects(
      client.newSession({ cwd: process.cwd(), mcpServers: [{ name: "cogentia" }] }),
      (error) =>
        error instanceof AcpProtocolError &&
        error.message === "acp_mcp_servers_require_explicit_admission"
    );
    const result = await client.newSession({
      cwd: process.cwd(),
      mcpServers: [{ name: "isolated-tool" }],
      allowMcpServer: (server) => server.name === "isolated-tool",
    });
    assert.equal(result.sessionId, "session-1");
  });
});

test("ACP client isolates concurrent sessions and accepts a capability-gated resume", async () => {
  await withClient({}, async (client, updates) => {
    const [one, two] = await Promise.all([
      client.newSession({ cwd: process.cwd() }),
      client.newSession({ cwd: process.cwd() }),
    ]);
    const [first, second] = await Promise.all([
      client.prompt({ sessionId: one.sessionId, prompt: [{ type: "text", text: "first" }] }),
      client.prompt({ sessionId: two.sessionId, prompt: [{ type: "text", text: "second" }] }),
    ]);
    assert.equal(first.stopReason, "end_turn");
    assert.equal(second.stopReason, "end_turn");
    assert.deepEqual(
      new Set(updates.map((item) => item.sessionId)),
      new Set([one.sessionId, two.sessionId])
    );
    await client.resumeSession({ sessionId: one.sessionId, cwd: process.cwd() });
  });
});

test("ACP cancellation settles pending permission requests as cancelled", async () => {
  let permissionSeen;
  let resolvePermission;
  await withClient(
    {
      requestPermission: () => {
        permissionSeen?.();
        return new Promise((resolve) => {
          resolvePermission = resolve;
        });
      },
    },
    async (client, updates) => {
      const { sessionId } = await client.newSession({ cwd: process.cwd() });
      const permission = new Promise((resolve) => {
        permissionSeen = resolve;
      });
      const prompt = client.prompt({
        sessionId,
        prompt: [{ type: "text", text: "permission then wait" }],
      });
      await permission;
      client.cancel(sessionId);
      assert.equal((await prompt).stopReason, "cancelled");
      assert.equal(updates.at(-1).update.status, "cancelled");
      resolvePermission({ outcome: "allow_once" });
    }
  );
});

test("ACP client rejects incompatible versions, invalid JSON, and timed-out prompts", async () => {
  await assert.rejects(
    connectAcpStdio({
      command: process.execPath,
      args: [fixture, "version-mismatch"],
      cwd: process.cwd(),
    }),
    (error) =>
      error instanceof AcpProtocolError && error.message === "acp_protocol_version_mismatch"
  );
  await withClient({ agentArgs: ["invalid-json"] }, async (client) => {
    const { sessionId } = await client.newSession({ cwd: process.cwd() });
    await assert.rejects(
      client.prompt({ sessionId, prompt: [{ type: "text", text: "invalid" }] }),
      (error) =>
        error instanceof AcpProtocolError && error.message === "acp_invalid_json_from_agent"
    );
  });
  await withClient({ agentArgs: ["timeout"], promptTimeoutMs: 20 }, async (client) => {
    const { sessionId } = await client.newSession({ cwd: process.cwd() });
    await assert.rejects(
      client.prompt({ sessionId, prompt: [{ type: "text", text: "wait" }] }),
      (error) =>
        error instanceof AcpProtocolError && error.message === "acp_request_timeout:session/prompt"
    );
  });
});
