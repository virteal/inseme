import assert from "node:assert/strict";
import { createCogentiaMcpClient } from "../cop/cogentiaMcpClient.js";

const calls = [];
const fakeFetch = async (url, init) => {
  calls.push({ url, init });
  const body = JSON.parse(init.body);
  if (body.method === "tools/list") {
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            tools: [{ name: "cogentia_continuation_emit" }],
            _cogentia: { auth: "jhn", allowMutate: true },
          },
        }),
    };
  }
  if (body.method === "tools/call") {
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            structuredContent: {
              ok: true,
              tool: body.params.name,
              envelope: { kind: "cogentia.mcp_tool_result/v1" },
              data: { ok: true },
            },
          },
        }),
    };
  }
  return {
    ok: true,
    text: async () => JSON.stringify({ jsonrpc: "2.0", id: body.id, result: {} }),
  };
};

const client = createCogentiaMcpClient({
  url: "https://example.test/mcp",
  token: "secret-token",
  actor: "agent:jhn",
  fetchImpl: fakeFetch,
});

const listed = await client.listTools();
assert.equal(listed.auth, "jhn");
assert.equal(listed.allowMutate, true);
const listCall = calls[0];
assert.match(listCall.init.headers.authorization, /Bearer secret-token/);
assert.equal(listCall.init.headers["x-cogentia-actor"], "agent:jhn");

const env = await client.callTool("cogentia_search", { query: "x" }, { subagentId: "elf-1" });
assert.equal(env.ok, true);
const toolCall = calls[1];
assert.equal(toolCall.init.headers["x-cogentia-actor"], "agent:jhn.subagent:elf-1");
const body = JSON.parse(toolCall.init.body);
assert.equal(body.params._meta["cogentia.actor"], "agent:jhn.subagent:elf-1");
assert.equal(body.params._meta["cogentia.jhn_token"], "secret-token");

console.log(JSON.stringify({ ok: true, tests: "cogentiaMcpClient" }));
