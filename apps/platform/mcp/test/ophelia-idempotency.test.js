import assert from "assert";
import * as opheliaAgent from "../agents/opheliaAgent.js";

(async () => {
  const savedTasks = [];
  const savedSteps = [];
  let publishCount = 0;
  const mockStore = {
    saveTask: async (task) => {
      const existing = savedTasks.find(
        (j) =>
          j.source_event_id &&
          task.source_event_id &&
          j.source_event_id === task.source_event_id &&
          j.topic_id === task.topic_id &&
          j.type === task.type
      );
      if (existing) return existing;
      const newTask = { id: "task-" + (savedTasks.length + 1), ...task };
      savedTasks.push(newTask);
      return newTask;
    },
    saveStep: async (step) => {
      const existing = savedSteps.find((s) => s.task_id === step.task_id && s.name === step.name);
      if (existing) return existing;
      const newStep = { id: "step-" + (savedSteps.length + 1), ...step };
      savedSteps.push(newStep);
      return newStep;
    },
  };
  const mockBus = {
    publish: async () => {
      publishCount++;
    },
  };

  const ev = { id: "evt-1", type: "user_message", topic_id: "t1", payload: { text: "hello" } };

  await opheliaAgent.onEvent(ev, { store: mockStore, bus: mockBus });
  await opheliaAgent.onEvent(ev, { store: mockStore, bus: mockBus });

  console.log(
    "Tasks saved",
    savedTasks.length,
    "Steps saved",
    savedSteps.length,
    "publishCount",
    publishCount
  );
  assert.strictEqual(savedTasks.length, 1, "Expected 1 task saved");
  assert.strictEqual(savedSteps.length, 1, "Expected 1 step saved");

  console.log("Idempotency test passed");
})();
