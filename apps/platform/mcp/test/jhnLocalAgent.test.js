import assert from "node:assert/strict";
import { test } from "node:test";
import { createJhnLocalAgent } from "../cop/jhnLocalAgent.js";
import { createOpenAIJhnReasoner } from "../cop/jhnReasoner.js";

test("JHN local agent records a conversation turn through the COP boundary", async () => {
  const writes = [];
  const reasoner = createOpenAIJhnReasoner({
    client: {
      responses: {
        create: async (request) => {
          assert.equal(request.model, "gpt-5.6-luna");
          assert.equal(request.store, false);
          return { id: "response:test", output_text: "Bonjour.", usage: { total_tokens: 12 } };
        },
      },
    },
  });
  const agent = createJhnLocalAgent({
    runtimeUrl: "http://127.0.0.1:8787",
    capability: "test-capability",
    reasoner,
    fetchImpl: async (_url, request) => {
      writes.push(JSON.parse(request.body));
      return { ok: true, status: 201 };
    },
  });

  const result = await agent.turn({ message: "Bonjour John.", conversationId: "test" });
  assert.equal(result.text, "Bonjour.");
  assert.deepEqual(
    writes.map((write) => write.type),
    ["conversation.user_message", "conversation.assistant_message"]
  );
});
