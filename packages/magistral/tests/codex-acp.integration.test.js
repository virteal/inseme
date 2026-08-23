import test from "node:test";
import assert from "node:assert/strict";
import { platform } from "node:process";
import { connectAcpStdio } from "../src/acp.js";

const enabled = process.env.RUN_CODEX_ACP_INTEGRATION === "1";
const command = platform === "win32" ? "codex-acp.cmd" : "codex-acp";

test(
  "local Codex ACP completes one read-only prompt without MCP servers",
  {
    skip:
      !enabled && "set RUN_CODEX_ACP_INTEGRATION=1 to invoke the authenticated local Codex adapter",
  },
  async () => {
    const updates = [];
    const client = await connectAcpStdio({
      command,
      cwd: process.cwd(),
      env: { INITIAL_AGENT_MODE: "read-only" },
      requestTimeoutMs: 60_000,
      promptTimeoutMs: 120_000,
      onSessionUpdate: (event) => updates.push(event),
    });
    try {
      assert.equal(client.initialization.protocolVersion, 1);
      const session = await client.newSession({ cwd: process.cwd() });
      assert.equal(session.modes?.currentModeId, "read-only");
      const result = await client.prompt({
        sessionId: session.sessionId,
        prompt: [
          {
            type: "text",
            text: "Reply with exactly ACP_CODEX_LOCAL_OK. Do not read files, run tools, or make changes.",
          },
        ],
      });
      const text = updates
        .flatMap((event) => {
          const content = event.update?.content;
          return content?.type === "text" ? [content.text] : [];
        })
        .join("");
      assert.equal(result.stopReason, "end_turn");
      assert.equal(text, "ACP_CODEX_LOCAL_OK");
      assert.equal(await client.closeSession(session.sessionId), true);
    } finally {
      client.terminate();
    }
  }
);
