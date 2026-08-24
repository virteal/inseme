import assert from "node:assert/strict";
import test from "node:test";
import { createLocalCodexAcpMap } from "../registry/maps/local-codex-acp.js";

test("local Codex ACP map resolves a Windows npm shim to a managed Node entrypoint", () => {
  const [node] = createLocalCodexAcpMap(
    {
      CODEX_ACP_COMMAND: "C:\\Users\\jhr\\.npm-global\\codex-acp.cmd",
      MAGISTRAL_CODEX_ACP_WORKSPACE: "C:\\work\\public-guide",
      MAGISTRAL_CODEX_ACP_TIER: "fractavolta-guide",
    },
    "win32"
  );
  assert.equal(node.adapter, "acp_stdio");
  assert.equal(node.tier, "fractavolta-guide");
  assert.ok(node.args[0].endsWith("@agentclientprotocol\\codex-acp\\dist\\index.js"));
});

test("local Codex ACP map refuses a relative command or workspace", () => {
  assert.throws(
    () =>
      createLocalCodexAcpMap(
        {
          CODEX_ACP_COMMAND: "codex-acp.cmd",
          MAGISTRAL_CODEX_ACP_WORKSPACE: "C:\\work\\public-guide",
        },
        "win32"
      ),
    /absolute path/
  );
  assert.throws(
    () =>
      createLocalCodexAcpMap(
        {
          CODEX_ACP_COMMAND: "C:\\Users\\jhr\\codex-acp.cmd",
          MAGISTRAL_CODEX_ACP_WORKSPACE: "public-guide",
        },
        "win32"
      ),
    /absolute isolated public directory/
  );
});
