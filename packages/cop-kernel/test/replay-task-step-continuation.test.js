import test from "node:test";
import assert from "node:assert/strict";

import { COPBus } from "../src/bus.js";
import {
  buildContinuationResumeMessage,
  createContinuationDescriptor,
  prepareRetry,
} from "../src/continuation.js";

function emptyProjection() {
  return {
    tasks: new Map(),
    steps: new Map(),
    continuations: new Map(),
    resumedContinuations: new Set(),
    processedEventIds: new Set(),
  };
}

function cloneData(data) {
  return data ? JSON.parse(JSON.stringify(data)) : {};
}

function projectEvent(state, event) {
  if (!event.id) {
    throw new Error("projectEvent requires event.id for idempotency");
  }

  if (state.processedEventIds.has(event.id)) {
    return state;
  }

  state.processedEventIds.add(event.id);

  const data = cloneData(event.data);

  switch (event.type) {
    case "cop.task.created":
      state.tasks.set(data.taskId, {
        taskId: data.taskId,
        topicId: event.topicId,
        status: "pending",
        steps: [],
      });
      break;

    case "cop.task.step.created": {
      const task = state.tasks.get(data.taskId);
      assert.ok(task, "step creation must reference an existing task");
      task.steps.push(data.stepId);
      state.steps.set(data.stepId, {
        taskId: data.taskId,
        stepId: data.stepId,
        status: "pending",
      });
      break;
    }

    case "cop.continuation.created":
      state.continuations.set(data.continuation.continuationId, {
        ...data.continuation,
        status: "waiting",
      });
      break;

    case "cop.continuation.resume": {
      const continuation = state.continuations.get(data.continuationId);
      assert.ok(continuation, "resumption must reference an existing continuation");
      state.continuations.set(data.continuationId, {
        ...continuation,
        status: "resumed",
        resumeReason: data.reason,
      });
      state.resumedContinuations.add(data.continuationId);
      break;
    }

    case "cop.task.step.completed": {
      const step = state.steps.get(data.stepId);
      assert.ok(step, "step completion must reference an existing step");
      state.steps.set(data.stepId, { ...step, status: "completed" });
      break;
    }

    case "cop.task.completed": {
      const task = state.tasks.get(data.taskId);
      assert.ok(task, "task completion must reference an existing task");
      state.tasks.set(data.taskId, { ...task, status: "completed" });
      break;
    }
  }

  return state;
}

function replay(events) {
  return events.reduce(projectEvent, emptyProjection());
}

test("replays Task / Step / Continuation state and ignores duplicate events", () => {
  const continuation = createContinuationDescriptor({
    resumeTo: "handler:test-worker",
    resumeIntent: "continue-test-task",
    taskId: "task-1",
    stepId: "step-1",
    state: { answer: 42 },
    waitForEvents: ["external.ready"],
  });

  const events = [
    {
      id: "evt-1",
      type: "cop.task.created",
      topicId: "topic-A",
      data: { taskId: "task-1" },
    },
    {
      id: "evt-2",
      type: "cop.task.step.created",
      topicId: "topic-A",
      data: { taskId: "task-1", stepId: "step-1" },
    },
    {
      id: "evt-3",
      type: "cop.continuation.created",
      topicId: "topic-A",
      data: { continuation },
    },
    {
      id: "evt-4",
      type: "cop.continuation.resume",
      topicId: "topic-A",
      data: { continuationId: continuation.continuationId, reason: "event-match" },
    },
    {
      id: "evt-5",
      type: "cop.task.step.completed",
      topicId: "topic-A",
      data: { taskId: "task-1", stepId: "step-1" },
    },
    {
      id: "evt-6",
      type: "cop.task.completed",
      topicId: "topic-A",
      data: { taskId: "task-1" },
    },
  ];

  const projected = replay([...events, events[1], events[3], events[5]]);

  assert.equal(projected.processedEventIds.size, 6);
  assert.equal(projected.tasks.get("task-1").status, "completed");
  assert.deepEqual(projected.tasks.get("task-1").steps, ["step-1"]);
  assert.equal(projected.steps.get("step-1").status, "completed");
  assert.equal(projected.continuations.get(continuation.continuationId).status, "resumed");
  assert.ok(projected.resumedContinuations.has(continuation.continuationId));
});

test("continuation retry creates new traceable state without mutating the previous descriptor", () => {
  const original = createContinuationDescriptor({
    resumeTo: "handler:test-worker",
    resumeIntent: "retry-test",
    state: { phase: "initial" },
    retry: {
      attempt: 1,
      maxAttempts: 3,
      retryDelayMs: 0,
    },
  });

  const retryDecision = prepareRetry(original);

  assert.equal(retryDecision.shouldRetry, true);
  assert.notEqual(retryDecision.updatedContinuation, original);
  assert.equal(original.retry.attempt, 1);
  assert.equal(retryDecision.updatedContinuation.retry.attempt, 2);
  assert.equal(original.state._retry, undefined);
  assert.equal(retryDecision.updatedContinuation.state._retry.attempt, 2);

  const resumeMessage = buildContinuationResumeMessage({
    continuation: retryDecision.updatedContinuation,
    triggeringEvent: { type: "failure.observed" },
  });

  assert.equal(resumeMessage.payload.resumedContinuationId, original.continuationId);
  assert.equal(resumeMessage.metadata.continuation.isResumption, true);
});

test("per-topic COPBus sub-buses isolate topic-scoped events", async () => {
  const rootBus = new COPBus({ name: "test-root" });
  const topicA = rootBus.forTopic("topic-A");
  const topicB = rootBus.forTopic("topic-B");

  const seenA = [];
  const seenB = [];

  topicA.subscribe("cop.task.created", (event) => seenA.push(event));
  topicB.subscribe("cop.task.created", (event) => seenB.push(event));

  await topicA.publish({
    id: "topic-A-event-1",
    type: "cop.task.created",
    data: { taskId: "task-A" },
  });

  assert.equal(seenA.length, 1);
  assert.equal(seenB.length, 0);
  assert.equal(seenA[0].subBus, "topic:topic-A");
});
