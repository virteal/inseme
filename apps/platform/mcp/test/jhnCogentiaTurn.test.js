import assert from "node:assert/strict";
import { createJhnCogentiaTurn, createMemoryCopStore } from "../cop/jhnCogentiaTurn.js";

const calls = [];
const fakeFetch = async (url, init) => {
  calls.push({ url, init });
  const body = JSON.parse(init.body);
  if (body.method === "tools/list") {
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            tools: [{ name: "cogentia_search" }, { name: "cogentia_continuation_emit" }],
            _cogentia: { auth: "jhn", allowMutate: true },
          },
        });
      },
    };
  }
  if (body.params?.name === "cogentia_skill_get") {
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            structuredContent: {
              ok: true,
              tool: "cogentia_skill_get",
              data: { ok: true, skill: { slug: "corpus-evidence-retrieval" } },
              envelope: { kind: "cogentia.mcp_tool_result/v1" },
            },
          },
        });
      },
    };
  }
  if (body.params?.name === "cogentia_search") {
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            structuredContent: {
              ok: true,
              tool: "cogentia_search",
              citations: [
                {
                  source_id: "cogentia:research/cognitive_packets.md#L1-L10",
                  repo: "cogentia",
                  path: "research/cognitive_packets.md",
                },
              ],
              data: {
                ok: true,
                results: [
                  {
                    id: "cogentia:research/cognitive_packets.md#L1-L10",
                    repo: "cogentia",
                    path: "research/cognitive_packets.md",
                  },
                ],
              },
              envelope: { kind: "cogentia.mcp_tool_result/v1" },
            },
          },
        });
      },
    };
  }
  return {
    ok: true,
    async text() {
      return JSON.stringify({ jsonrpc: "2.0", id: body.id, result: {} });
    },
  };
};

const store = createMemoryCopStore();
const agent = createJhnCogentiaTurn({
  store,
  identity: {
    principal_ref: "principal:jhn",
    mandate_ref: "mandate:jhn:test",
    logical_agent_ref: "agent:jhn",
  },
  cogentia: (await import("../cop/cogentiaMcpClient.js")).createCogentiaMcpClient({
    url: "https://example.test/mcp",
    token: "t",
    actor: "agent:jhn",
    fetchImpl: fakeFetch,
  }),
});

const result = await agent.turn({
  message: "What is a cognitive packet?",
  conversationId: "test",
});

assert.equal(result.conversational_identity, "John");
assert.equal(result.cogentia.auth, "jhn");
assert.equal(result.citations.length, 1);
assert.equal(store.events.length, 3);
assert.equal(store.events[0].payload.kind, "conversation.user_message");
assert.equal(store.events[1].payload.kind, "capability.invocation");
assert.equal(store.events[2].payload.kind, "conversation.assistant_message");
assert.equal(store.events[2].payload.conversational_identity, "John");
assert.match(calls[0].init.headers.authorization, /Bearer t/);

console.log(JSON.stringify({ ok: true, tests: "jhnCogentiaTurn" }));
