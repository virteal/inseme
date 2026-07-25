#!/usr/bin/env node
/**
 * Inseme federated MCP — stdio (JSON-RPC lines).
 *
 * Maximizes visible/actionable tools:
 *   - Cogentia.js daemon (corpus search, packs, issues, CLI, index…)
 *   - Ritornu (personal publication retrofit)
 *   - Hub meta (inseme_cockpit, inseme_list_surfaces)
 *
 * Env:
 *   COGENTIA_DAEMON_URL=http://127.0.0.1:8790
 *   COGENTIA_MCP_VIEW=public|full
 *   COGENTIA_ADMIN_TOKEN=…          (for full view)
 *   COGENTIA_MCP_ALLOW_OPS=1        (index rebuild, emit-static, …)
 *   INSEME_MCP_SURFACE=full|cogentia|ritornu
 *   SUPABASE_*                      (Ritornu private storage on platform)
 */

import { createHubMcp } from "../src/mcp/hub.js";
import { jsonRpcError } from "../src/mcp/core.js";

const hub = createHubMcp(process.env);

let input = "";
let pending = Promise.resolve();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  let newline;
  while ((newline = input.indexOf("\n")) >= 0) {
    const line = input.slice(0, newline).trim();
    input = input.slice(newline + 1);
    if (line) pending = pending.then(() => handleLine(line));
  }
});
process.stdin.on("end", () => {
  const line = input.trim();
  if (line) pending = pending.then(() => handleLine(line));
  pending.finally(() => process.exit(0));
});
process.stdin.resume();

async function handleLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return send(jsonRpcError(null, -32700, "Parse error"));
  }
  const response = await hub.handleJsonRpc(message);
  if (response) send(response);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
