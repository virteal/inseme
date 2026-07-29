import test from "node:test";
import assert from "node:assert/strict";

import {
  completeActiveRuntimeRequest,
  createRuntimeState,
  enqueueRuntimeRequest,
  registerRuntimeContinuation,
  resolveRuntimeContinuation,
  startNextRuntimeRequest,
} from "../src/runtimeModel.js";

test("runtime model enqueues requests and starts exactly one active request", () => {
  const baseState = createRuntimeState({ processId: "proc-1" });

  const first = enqueueRuntimeRequest(baseState, {
    requestId: "req-1",
    source: "cli",
    payload: { text: "first" },
  });

  assert.equal(first.deduplicated, false);
  assert.equal(first.state.queue.length, 1);
  assert.equal(first.state.activeRequest, null);

  const started = startNextRuntimeRequest(first.state, new Date("2026-07-18T10:00:00.000Z"));

  assert.equal(started.started, true);
  assert.equal(started.state.queue.length, 0);
  assert.equal(started.state.activeRequest.requestId, "req-1");
  assert.equal(started.state.activeRequest.status, "running");
  assert.equal(started.state.activeRequest.turnId, "turn-req-1");
});

test("runtime model deduplicates repeated request submission", () => {
  const baseState = createRuntimeState();

  const first = enqueueRuntimeRequest(baseState, {
    requestId: "req-1",
    source: "cli",
    payload: { text: "first" },
  });

  const second = enqueueRuntimeRequest(first.state, {
    requestId: "req-1",
    source: "cli",
    payload: { text: "first-again" },
  });

  assert.equal(second.deduplicated, true);
  assert.equal(second.location, "queue");
  assert.equal(second.state.queue.length, 1);
  assert.equal(second.state.queue[0].payload.text, "first");
});

test("runtime model refuses to start a second active request", () => {
  const state = createRuntimeState({
    activeRequest: {
      requestId: "req-1",
      status: "running",
      continuations: [],
    },
  });

  const started = startNextRuntimeRequest(state);

  assert.equal(started.started, false);
  assert.equal(started.reason, "active-request-present");
  assert.equal(started.state.activeRequest.requestId, "req-1");
});

test("runtime model attaches and resolves continuations traceably", () => {
  const queued = enqueueRuntimeRequest(createRuntimeState(), {
    requestId: "req-1",
    source: "cli",
    payload: { text: "continuation-test" },
  });

  const withContinuation = registerRuntimeContinuation(
    queued.state,
    "req-1",
    {
      continuationId: "cont-1",
      resumeTo: "agent:test-worker",
      resumeIntent: "finish-later",
    },
    new Date("2026-07-18T10:01:00.000Z")
  );

  assert.equal(withContinuation.deduplicated, false);
  assert.equal(withContinuation.state.queue[0].continuations.length, 1);
  assert.equal(withContinuation.state.continuations.length, 1);
  assert.equal(withContinuation.state.continuations[0].status, "open");

  const resolved = resolveRuntimeContinuation(
    withContinuation.state,
    "cont-1",
    { status: "resolved", resolutionNote: "completed" },
    new Date("2026-07-18T10:02:00.000Z")
  );

  assert.equal(resolved.resolved, true);
  assert.equal(resolved.state.continuations[0].status, "resolved");
  assert.equal(resolved.state.queue[0].continuations[0].status, "resolved");
  assert.equal(resolved.state.queue[0].continuations[0].resolution.resolutionNote, "completed");
});

test("runtime model completes active work and advances the queue", () => {
  const first = enqueueRuntimeRequest(createRuntimeState(), {
    requestId: "req-1",
    source: "cli",
    payload: { text: "first" },
  });
  const second = enqueueRuntimeRequest(first.state, {
    requestId: "req-2",
    source: "cli",
    payload: { text: "second" },
  });

  const started = startNextRuntimeRequest(second.state, new Date("2026-07-18T10:03:00.000Z"));
  const completed = completeActiveRuntimeRequest(
    started.state,
    { status: "completed", result: "ok" },
    new Date("2026-07-18T10:04:00.000Z")
  );

  assert.equal(completed.completed, true);
  assert.equal(completed.state.activeRequest, null);
  assert.equal(completed.state.completed.length, 1);
  assert.equal(completed.state.completed[0].result, "ok");

  const restarted = startNextRuntimeRequest(completed.state, new Date("2026-07-18T10:05:00.000Z"));
  assert.equal(restarted.started, true);
  assert.equal(restarted.state.activeRequest.requestId, "req-2");
});
