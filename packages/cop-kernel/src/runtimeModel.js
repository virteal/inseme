// File: packages/cop-kernel/src/runtimeModel.js
// Description: Pure COP runtime state helpers for request/turn/continuation orchestration.

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function cloneRequest(request) {
  return {
    ...request,
    continuations: Array.isArray(request.continuations)
      ? request.continuations.map((continuation) => ({ ...continuation }))
      : [],
  };
}

function cloneState(state) {
  return {
    ...state,
    queue: Array.isArray(state.queue) ? state.queue.map(cloneRequest) : [],
    activeRequest: state.activeRequest ? cloneRequest(state.activeRequest) : null,
    completed: Array.isArray(state.completed) ? state.completed.map(cloneRequest) : [],
    continuations: Array.isArray(state.continuations)
      ? state.continuations.map((continuation) => ({ ...continuation }))
      : [],
  };
}

function indexOfRequest(queue, requestId) {
  return queue.findIndex((request) => request.requestId === requestId);
}

function indexOfContinuation(continuations, continuationId) {
  return continuations.findIndex((continuation) => continuation.continuationId === continuationId);
}

export function createRuntimeState(overrides = {}) {
  return {
    processId: overrides.processId || null,
    queue: Array.isArray(overrides.queue) ? overrides.queue.map(cloneRequest) : [],
    activeRequest: overrides.activeRequest ? cloneRequest(overrides.activeRequest) : null,
    completed: Array.isArray(overrides.completed) ? overrides.completed.map(cloneRequest) : [],
    continuations: Array.isArray(overrides.continuations)
      ? overrides.continuations.map((continuation) => ({ ...continuation }))
      : [],
  };
}

export function enqueueRuntimeRequest(state, request, now = new Date()) {
  if (!request || typeof request !== "object") {
    throw new Error("enqueueRuntimeRequest: request is required");
  }
  if (!request.requestId) {
    throw new Error("enqueueRuntimeRequest: requestId is required");
  }

  const nextState = cloneState(state || createRuntimeState());
  const timestamp = nowIso(now);

  if (nextState.activeRequest?.requestId === request.requestId) {
    return {
      state: nextState,
      request: cloneRequest(nextState.activeRequest),
      deduplicated: true,
      location: "active",
    };
  }

  const queuedIndex = indexOfRequest(nextState.queue, request.requestId);
  if (queuedIndex >= 0) {
    return {
      state: nextState,
      request: cloneRequest(nextState.queue[queuedIndex]),
      deduplicated: true,
      location: "queue",
    };
  }

  const completedIndex = indexOfRequest(nextState.completed, request.requestId);
  if (completedIndex >= 0) {
    return {
      state: nextState,
      request: cloneRequest(nextState.completed[completedIndex]),
      deduplicated: true,
      location: "completed",
    };
  }

  const requestRecord = {
    ...request,
    requestId: request.requestId,
    status: "queued",
    createdAt: request.createdAt || timestamp,
    queuedAt: timestamp,
    turnId: request.turnId || null,
    continuations: Array.isArray(request.continuations)
      ? request.continuations.map((continuation) => ({ ...continuation }))
      : [],
  };

  nextState.queue.push(requestRecord);

  return {
    state: nextState,
    request: cloneRequest(requestRecord),
    deduplicated: false,
    location: "queue",
  };
}

export function startNextRuntimeRequest(state, now = new Date()) {
  const nextState = cloneState(state || createRuntimeState());

  if (nextState.activeRequest) {
    return {
      state: nextState,
      activeRequest: cloneRequest(nextState.activeRequest),
      started: false,
      reason: "active-request-present",
    };
  }

  const nextRequest = nextState.queue.shift() || null;
  if (!nextRequest) {
    return {
      state: nextState,
      activeRequest: null,
      started: false,
      reason: "queue-empty",
    };
  }

  const timestamp = nowIso(now);
  const activeRequest = {
    ...nextRequest,
    status: "running",
    startedAt: timestamp,
    turnId: nextRequest.turnId || `turn-${nextRequest.requestId}`,
  };

  nextState.activeRequest = activeRequest;

  return {
    state: nextState,
    activeRequest: cloneRequest(activeRequest),
    started: true,
    reason: "started",
  };
}

export function completeActiveRuntimeRequest(state, completion = {}, now = new Date()) {
  const nextState = cloneState(state || createRuntimeState());

  if (!nextState.activeRequest) {
    return {
      state: nextState,
      completedRequest: null,
      completed: false,
      reason: "no-active-request",
    };
  }

  const timestamp = nowIso(now);
  const completedRequest = {
    ...nextState.activeRequest,
    ...completion,
    status: completion.status || "completed",
    completedAt: timestamp,
  };

  nextState.completed.push(completedRequest);
  nextState.activeRequest = null;

  return {
    state: nextState,
    completedRequest: cloneRequest(completedRequest),
    completed: true,
    reason: "completed",
  };
}

export function registerRuntimeContinuation(state, requestId, continuation, now = new Date()) {
  if (!requestId) {
    throw new Error("registerRuntimeContinuation: requestId is required");
  }
  if (!continuation || typeof continuation !== "object") {
    throw new Error("registerRuntimeContinuation: continuation is required");
  }
  if (!continuation.continuationId) {
    throw new Error("registerRuntimeContinuation: continuationId is required");
  }

  const nextState = cloneState(state || createRuntimeState());
  const timestamp = nowIso(now);
  const continuationRecord = {
    ...continuation,
    requestId,
    registeredAt: continuation.registeredAt || timestamp,
    status: continuation.status || "open",
  };

  const existingIndex = indexOfContinuation(
    nextState.continuations,
    continuationRecord.continuationId
  );
  if (existingIndex >= 0) {
    return {
      state: nextState,
      continuation: { ...nextState.continuations[existingIndex] },
      deduplicated: true,
    };
  }

  nextState.continuations.push(continuationRecord);

  const requestTarget =
    nextState.activeRequest?.requestId === requestId
      ? nextState.activeRequest
      : nextState.queue.find((request) => request.requestId === requestId) ||
        nextState.completed.find((request) => request.requestId === requestId);

  if (requestTarget) {
    requestTarget.continuations = Array.isArray(requestTarget.continuations)
      ? requestTarget.continuations
      : [];
    requestTarget.continuations.push({
      continuationId: continuationRecord.continuationId,
      status: continuationRecord.status,
      registeredAt: continuationRecord.registeredAt,
      resumeTo: continuationRecord.resumeTo || null,
    });
  }

  return {
    state: nextState,
    continuation: { ...continuationRecord },
    deduplicated: false,
  };
}

export function resolveRuntimeContinuation(
  state,
  continuationId,
  resolution = {},
  now = new Date()
) {
  if (!continuationId) {
    throw new Error("resolveRuntimeContinuation: continuationId is required");
  }

  const nextState = cloneState(state || createRuntimeState());
  const index = indexOfContinuation(nextState.continuations, continuationId);
  if (index < 0) {
    return {
      state: nextState,
      continuation: null,
      resolved: false,
      reason: "continuation-not-found",
    };
  }

  const timestamp = nowIso(now);
  const continuation = {
    ...nextState.continuations[index],
    ...resolution,
    status: resolution.status || "resolved",
    resolvedAt: timestamp,
  };

  nextState.continuations[index] = continuation;

  for (const bucket of [nextState.activeRequest, ...nextState.queue, ...nextState.completed]) {
    if (!bucket?.continuations) continue;
    const item = bucket.continuations.find((entry) => entry.continuationId === continuationId);
    if (item) {
      item.status = continuation.status;
      item.resolvedAt = timestamp;
      item.resolution = resolution || null;
    }
  }

  return {
    state: nextState,
    continuation: { ...continuation },
    resolved: true,
    reason: "resolved",
  };
}

export function assertSingleActiveRequest(state) {
  const activeCount = state?.activeRequest ? 1 : 0;
  if (activeCount > 1) {
    throw new Error("assertSingleActiveRequest: more than one active request detected");
  }
  return true;
}
