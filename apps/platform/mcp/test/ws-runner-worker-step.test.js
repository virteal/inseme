import assert from "assert";
import * as runner from "../ws-runner.js";
import store from "../cop/supabaseStore.js";
import opheliaAgent from "../agents/opheliaAgent.js";

(async () => {
  // Mock store to simulate a claimed task and step
  let claimedTask = { id: "task-1", type: "deep_reply", topic_id: "t1" };
  let claimedStep = {
    id: "step-1",
    task_id: "task-1",
    name: "compose",
    status: "pending",
    input: { text: "hello" },
  };
  const origClaimTask = store.claimTask;
  const origClaimStep = store.claimStep;
  const origGetSteps = store.getSteps;
  let origOnStep = undefined;
  try {
    store.claimTask = async ({ workerId, leaseSeconds }) => claimedTask;
    store.claimStep = async ({ taskId, workerId, leaseSeconds }) => claimedStep;
    store.getSteps = async (taskId) => [claimedStep];

    // mock agent onStep to record call
    let called = 0;
    origOnStep = opheliaAgent.onStep;
    opheliaAgent.onStep = async (task, step, ctx) => {
      called++;
      return;
    };

    // run a single iteration of the workerLoop using workerIteration
    await runner.workerIteration("test-w1");

    assert.strictEqual(called, 1, "Expected agent onStep to be called once");
    console.log("ws-runner-worker-step test passed");
  } catch (e) {
    console.error("test failed", e);
    process.exit(1);
  } finally {
    store.claimTask = origClaimTask;
    store.claimStep = origClaimStep;
    store.getSteps = origGetSteps;
    opheliaAgent.onStep = origOnStep;
  }
})();
