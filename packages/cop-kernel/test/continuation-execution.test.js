import test from "node:test";
import assert from "node:assert/strict";

import { createContinuationDescriptor } from "../src/continuation.js";
import { COPScheduler } from "../src/scheduler.js";
import { COPBus } from "../src/bus.js";

test("a designated continuation executes as a local Promise without mutating its descriptor", async () => {
  const continuation = createContinuationDescriptor({
    resumeTo: "capability:deterministic-test",
    resumeIntent: "produce-next-step",
    taskId: "task-continuation-execution",
    stepId: "step-1",
    state: { input: "preserved" },
  });
  const original = structuredClone(continuation);
  const readOnlyStore = Object.freeze({ kind: "test-read-only-store" });
  const bus = new COPBus({ name: "continuation-execution-test" });
  const scheduler = new COPScheduler(bus, {
    readOnlyStore,
    handlerResolver: async (resumeTo) => {
      assert.equal(resumeTo, continuation.resumeTo);
      return {
        async execute({ continuation: received, resumeMessage, triggeringEvent, reason, readOnlyStore: store }) {
          assert.deepEqual(received, original);
          assert.equal(resumeMessage.payload.resumedContinuationId, continuation.continuationId);
          assert.deepEqual(triggeringEvent, { type: "input.ready" });
          assert.equal(reason, "event-match");
          assert.equal(store, readOnlyStore);
          return {
            output: { accepted: received.state.input },
            continuations: [
              createContinuationDescriptor({
                resumeTo: "capability:next-step",
                taskId: received.taskId,
                state: { previous: received.continuationId },
              }),
            ],
          };
        },
      };
    },
  });

  const receipt = await scheduler.execute(continuation, {
    triggeringEvent: { type: "input.ready" },
    reason: "event-match",
  });

  assert.deepEqual(continuation, original);
  assert.equal(receipt.execution.handler, continuation.resumeTo);
  assert.deepEqual(receipt.execution.result.output, { accepted: "preserved" });
  assert.equal(receipt.execution.result.continuations.length, 1);
  assert.equal(receipt.execution.result.continuations[0].resumeTo, "capability:next-step");
});

test("missing designated handlers fail observably", async () => {
  const bus = new COPBus({ name: "continuation-execution-failure-test" });
  const observed = [];
  bus.subscribe("cop.continuation.execution_failed", (event) => observed.push(event));
  const scheduler = new COPScheduler(bus, { handlerResolver: async () => null });
  const continuation = createContinuationDescriptor({ resumeTo: "capability:missing" });

  await assert.rejects(() => scheduler.execute(continuation), /no executable handler/);
  assert.equal(observed.length, 1);
  assert.equal(observed[0].data.continuationId, continuation.continuationId);
});
