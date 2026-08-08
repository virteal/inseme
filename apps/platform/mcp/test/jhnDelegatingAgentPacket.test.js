import test from "node:test";
import assert from "node:assert/strict";
import { createJhnDelegatingAgent } from "../cop/jhnDelegatingAgent.js";
import { createMemoryCopEventStore } from "../../../../packages/cop-core/src/cop-event-spool.js";

test("JHN Delegating Agent Governed Delegation & Packet Tracing (#33, #31)", async (t) => {
  await t.test(
    "delegates under mandate and attaches packet_id and provisional_cost to Imputation",
    async () => {
      const store = createMemoryCopEventStore();

      // Mock handler returning completion result with token usage
      const mockHandler = {
        id: "handler:openai-reasoner@local",
        capability: "coding.assist",
        async invoke(input) {
          return {
            text: "Here is the refactored code implementation.",
            provider: "openai",
            model: "gpt-5.4-nano",
            usage: {
              prompt_tokens: 1_000,
              completion_tokens: 500,
            },
          };
        },
      };

      const agent = createJhnDelegatingAgent({
        store,
        handler: mockHandler,
        reasoner: {
          async respond({ message, handlerAssist }) {
            return { text: `John Response: ${handlerAssist}`, responseId: "resp-123" };
          },
        },
        identity: {
          principal_ref: "principal:jhn",
          mandate_ref: "mandate:jhn:active-001",
          logical_agent_ref: "agent:jhn",
        },
        shouldDelegate: () => true,
      });

      const result = await agent.turn({
        message: "Please write a governed delegation module",
        conversationId: "test-conv-1",
      });

      assert.equal(result.conversational_identity, "John");
      assert.equal(result.handler_instance_ref, "handler:openai-reasoner@local");
      assert.ok(result.governed_act);

      // Verify events recorded in store (user_message, CapabilityInvocation, Act, Trace, Imputation, assistant_message)
      const events = store.replay();
      assert.ok(events.length >= 5);

      const imputationEvent = events.find((e) => e.payload?.kind === "Imputation");
      assert.ok(imputationEvent);
      assert.equal(imputationEvent.payload.principal_ref, "principal:jhn");
      assert.equal(imputationEvent.payload.logical_agent_ref, "agent:jhn");
      assert.equal(imputationEvent.payload.material_executor, "handler:openai-reasoner@local");

      // Verify provisional_cost object calculated via gpt-5.4-nano rate card
      assert.ok(imputationEvent.payload.provisional_cost);
      assert.equal(imputationEvent.payload.provisional_cost.unit, "USD");
      assert.equal(imputationEvent.payload.provisional_cost.scale, 8);
      assert.ok(BigInt(imputationEvent.payload.provisional_cost.coefficient) > 0n);
    }
  );
});
