// File: src/tasks.js
// Description:
//   Task & step helpers

import { getStorage } from "./storage.js";

// Optional bus integration for genericity (events as the packet layer).
// Load it lazily: Netlify Edge bundles target ES2020, where top-level await is
// unavailable. Task APIs are already asynchronous, so resolving the optional
// dependency at the point of use preserves the same best-effort behaviour.
let defaultBus = null;
let defaultBusLoad = null;

function loadDefaultBus() {
  if (!defaultBusLoad) {
    defaultBusLoad = import("./bus.js")
      .then((busMod) => {
        defaultBus = busMod.defaultBus || null;
        return defaultBus;
      })
      .catch(() => null);
  }
  return defaultBusLoad;
}

function nowIso() {
  return new Date().toISOString();
}

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

/**
 * Internal helper to emit a COP event via the bus when available.
 * This is the key genericity mechanism: Task/Step lifecycles become first-class observable events
 * that the Scheduler, other handlers, JobScheduler, and audit can react to without app-level glue.
 */
async function emitTaskEvent(busOrScheduler, eventType, payload) {
  let targetBus = busOrScheduler;

  // Support passing a scheduler directly (common pattern)
  if (busOrScheduler && typeof busOrScheduler.getBusForTopic === "function") {
    const topicId = payload.topicId || payload.taskId || payload.data?.topicId;
    targetBus = busOrScheduler.getBusForTopic(topicId);
  } else if (!targetBus) {
    targetBus = defaultBus || (await loadDefaultBus());
  }

  if (!targetBus || typeof targetBus.publish !== "function") return;

  try {
    const eventData = { ...payload };
    // Further cop.packet.* wrapping of task events (as follow-up): include projection
    // when the payload looks like a continuation/task with resume info. This allows
    // routers/handlers to subscribe uniformly to cop.packet.* alongside cop.task.*
    if (payload && (payload.continuationId || payload.resumeTo || payload.waitForEvents)) {
      eventData.packet = asCognitivePacket({
        envelope: { packetKind: "task", taskId: payload.taskId, stepId: payload.stepId },
        payload,
        kind: "task",
      });
    }
    await targetBus.publish({
      type: `cop.task.${eventType}`,
      source: "cop-kernel/tasks",
      data: eventData,
      timestamp: nowIso(),
    });
  } catch (error) {
    console.warn(`[cop-kernel/tasks] Failed to emit event ${eventType}:`, error.message);
  }
}

/**
 * Crée un task.
 *
 * @param {Object} params
 * @param {string} params.taskType
 * @param {string} params.workerHandlerName
 * @param {string} [params.rootCorrelationId]
 * @param {string} [params.channel]
 * @param {string} [params.sourceEntityId]
 * @param {string} [params.sourceEntityType]
 * @param {string} [params.idempotencyHash]
 * @param {number} [params.priority=0]
 * @param {Object} [params.metadata]
 * @returns {Promise<object>} task créé (row renvoyée par storage)
 */
export async function createTask(params) {
  const storage = getStorage();
  const {
    taskType,
    workerHandlerName,
    rootCorrelationId = null,
    channel = null,
    sourceEntityId = null,
    sourceEntityType = null,
    idempotencyHash = null,
    priority = 0,
    metadata = {},
  } = params || {};

  if (!taskType) {
    throw new Error("createTask: 'taskType' is required");
  }
  if (!workerHandlerName) {
    throw new Error("createTask: 'workerHandlerName' is required");
  }

  const createdAt = nowIso();

  const row = {
    id: genId(),
    task_type: taskType,
    worker_handler_name: workerHandlerName,
    root_correlation_id: rootCorrelationId,
    channel,
    source_entity_id: sourceEntityId,
    source_entity_type: sourceEntityType,
    idempotency_hash: idempotencyHash,
    status: "pending",
    retry_count: 0,
    priority,
    metadata,
    created_at: createdAt,
    updated_at: createdAt,
    started_at: null,
    completed_at: null,
    error_message: null,
  };

  const inserted = await storage.tasks.upsert(row);

  await emitTaskEvent(null, "created", {
    taskId: inserted.id,
    taskType,
    workerHandlerName,
    rootCorrelationId,
    channel,
  });

  return inserted;
}

/**
 * Crée une étape de task.
 *
 * @param {Object} params
 * @param {string} params.taskId
 * @param {string} params.name
 * @param {number} [params.indexInTask=0]
 * @param {string} [params.inputHash]
 * @returns {Promise<object>} step
 */
export async function createTaskStep(params) {
  const storage = getStorage();
  const { taskId, name, indexInTask = 0, inputHash = null } = params || {};

  if (!taskId) {
    throw new Error("createTaskStep: 'taskId' is required");
  }
  if (!name) {
    throw new Error("createTaskStep: 'name' is required");
  }

  const createdAt = nowIso();

  const row = {
    id: genId(),
    task_id: taskId,
    name,
    index_in_task: indexInTask,
    input_hash: inputHash,
    status: "pending",
    created_at: createdAt,
    updated_at: createdAt,
    completed_at: null,
    error_message: null,
  };

  const inserted = await storage.steps.upsert(row);

  await emitTaskEvent(null, "step.created", {
    taskId,
    stepId: inserted.id,
    name,
    indexInTask,
  });

  return inserted;
}

// --- Changement d'état des tasks ---

export async function markTaskStarted(taskId) {
  const storage = getStorage();
  const patch = {
    status: "running",
    started_at: nowIso(),
    updated_at: nowIso(),
  };
  const result = await storage.tasks.update(taskId, patch);

  await emitTaskEvent(null, "started", { taskId });

  return result;
}

export async function markTaskCompleted(taskId) {
  const storage = getStorage();
  const patch = {
    status: "completed",
    completed_at: nowIso(),
    updated_at: nowIso(),
  };
  const result = await storage.tasks.update(taskId, patch);

  await emitTaskEvent(null, "completed", { taskId });

  return result;
}

export async function markTaskFailed(taskId, errorMessage) {
  const storage = getStorage();
  const patch = {
    status: "failed",
    error_message: errorMessage || null,
    updated_at: nowIso(),
  };
  const result = await storage.tasks.update(taskId, patch);

  await emitTaskEvent(null, "failed", { taskId, errorMessage });

  return result;
}

// --- Changement d'état des steps (fixed & generic) ---

export async function markTaskStepCompleted(stepId) {
  const storage = getStorage();
  const completedAt = nowIso();

  // Robust lookup: prefer direct get if available, fallback to list filter
  let step = null;
  if (typeof storage.steps.get === "function") {
    step = await storage.steps.get(stepId);
  } else if (typeof storage.steps.list === "function") {
    const all = await storage.steps.list({ limit: 1000 });
    step = (all || []).find((s) => s.id === stepId);
  }

  if (!step || !step.task_id) {
    throw new Error(`markTaskStepCompleted: could not resolve task_id for step ${stepId}`);
  }

  const patch = {
    status: "completed",
    completed_at: completedAt,
    updated_at: completedAt,
  };
  const result = await storage.steps.update(step.task_id, stepId, patch);

  await emitTaskEvent(null, "step.completed", { taskId: step.task_id, stepId });

  return result;
}

export async function markTaskStepFailed(stepId, errorMessage) {
  const storage = getStorage();
  const updatedAt = nowIso();

  let step = null;
  if (typeof storage.steps.get === "function") {
    step = await storage.steps.get(stepId);
  } else if (typeof storage.steps.list === "function") {
    const all = await storage.steps.list({ limit: 1000 });
    step = (all || []).find((s) => s.id === stepId);
  }

  if (!step || !step.task_id) {
    throw new Error(`markTaskStepFailed: could not resolve task_id for step ${stepId}`);
  }

  const patch = {
    status: "failed",
    error_message: errorMessage || null,
    updated_at: updatedAt,
  };
  const result = await storage.steps.update(step.task_id, stepId, patch);

  await emitTaskEvent(null, "step.failed", { taskId: step.task_id, stepId, errorMessage });

  return result;
}

// --- Generic high-level orchestration helpers (genericity layer) ---
// These prevent application-level reinvention of Task + Step + Continuation coordination.

/**
 * Create a Task together with an initial Continuation that is linked to it.
 * This is a common generic pattern: "start this unit of work and make it resumable".
 */
export async function createTaskWithInitialContinuation(params) {
  const {
    taskType,
    workerHandlerName,
    // continuation params
    resumeTo,
    resumeIntent,
    state = {},
    waitForEvents = [],
    resumeAfter = null,
    retry = null,
    // optional linkage
    rootCorrelationId = null,
    channel = null,
  } = params || {};

  if (!taskType || !workerHandlerName || !resumeTo) {
    throw new Error(
      "createTaskWithInitialContinuation: taskType, workerHandlerName and resumeTo are required"
    );
  }

  let task = null;
  try {
    // 1. Try to create the Task (requires storage tasks support)
    task = await createTask({
      taskType,
      workerHandlerName,
      rootCorrelationId,
      channel,
    });
  } catch (_error) {
    // Graceful degradation for environments without full task storage (e.g. early bac-à-sable runs)
    task = {
      id: genId(),
      task_type: taskType,
      worker_handler_name: workerHandlerName,
      status: "pending",
      synthetic: true,
      note: "Task created in degraded mode (no persistent storage)",
    };
  }

  // 2. Create linked Continuation (always works via existing generic helper)
  const { createContinuationDescriptor } = await import("./continuation.js");
  const continuation = createContinuationDescriptor({
    resumeTo,
    resumeIntent,
    taskId: task?.id || null,
    state,
    waitForEvents,
    resumeAfter,
    retry,
    correlationId: rootCorrelationId || undefined,
    meta: { source: "createTaskWithInitialContinuation", taskSynthetic: !!task?.synthetic },
  });

  // 3. Emit a high-level orchestration event (very useful for generic subscribers)
  await emitTaskEvent(null, "orchestrated", {
    taskId: task?.id,
    continuationId: continuation.continuationId,
    syntheticTask: !!task?.synthetic,
  });

  // 4. Return both — this is the generic contract applications can rely on.
  return {
    task,
    continuation,
    scheduleHint: {
      jobId: `task-${task?.id || "synthetic"}`,
      type: "continuation",
      continuation,
      schedule: retry ? { type: "exponentialBackoff", ...retry } : undefined,
    },
  };
}

/**
 * Associate (or re-associate) an existing Continuation to a Task/Step.
 * Useful for generic resumption routing across RAIX/mesh nodes.
 */
export async function associateContinuationToTask(continuationId, taskId, stepId = null) {
  // In a fuller implementation this would emit a linking Event or update a join table.
  // For now, return a normalized descriptor that higher layers can use.
  // Future: persist via storage.tasks_continuations or equivalent.
  return {
    continuationId,
    taskId,
    stepId,
    associatedAt: nowIso(),
  };
}

/**
 * Thin helper to produce a "cognitive packet" style structure (envelope + payload)
 * around a Continuation or Task event, for alignment with the Cognitive Packet Switching
 * framing (see cogentia/research/cognitive_packet_switching.md and the continuation_packet_routing doc).
 *
 * The envelope is the routable part (inspectable by a "Cogentia router" / bus / scheduler
 * without full payload interpretation). The payload is the cognitive content (here the
 * continuation descriptor or task state).
 *
 * This is a convenience projection; the underlying COP model (Events + Artifacts + Bus publish
 * of typed events on (per-topic) sub-buses + federation) already provides the switching.
 * Routers subscribe to specific event types or use topic sub-buses / propagateInterest.
 *
 * Improvements (clean follow-up):
 * - Generates id + timestamp in envelope if absent (better defaults).
 * - Optional emission of `cop.packet.created` (and `cop.packet.routed` etc. by callers)
 *   so external "Cogentia router handlers" can subscribe uniformly without knowing
 *   internal task/job event shapes.
 * - Basic shape validation (warns on obvious misuse).
 */
export function asCognitivePacket({
  envelope = {},
  payload = {},
  kind = "continuation",
  bus = null,
  emit = true,
} = {}) {
  if (!payload || typeof payload !== "object") {
    console.warn("[asCognitivePacket] payload should be an object (continuation or task state)");
  }

  const now = nowIso();
  const id =
    envelope.id ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "pkt-" + Date.now() + "-" + Math.random().toString(16).slice(2));

  const packet = {
    packetKind: kind,
    envelope: {
      protocol: "cognitive_packet.v0",
      packetKind: kind,
      id,
      createdAt: envelope.createdAt || now,
      ...envelope,
      trace: envelope.trace || {
        correlationId: payload.correlationId || payload.continuationId || payload.id,
      },
    },
    payload,
  };

  // Optional emission for uniform router subscription point.
  // Callers (or the bac-à-sable ctx wrapper) can pass a bus (e.g. topic-scoped).
  // Falls back to the module's defaultBus if available (same pattern as emitTaskEvent).
  if (emit) {
    const publish = (targetBus) => {
      if (!targetBus || typeof targetBus.publish !== "function") return;
      // Fire and forget; don't block the caller on router emission.
      targetBus
        .publish({
          type: "cop.packet.created",
          source: "cop-kernel/asCognitivePacket",
          data: { packet, kind },
          timestamp: now,
        })
        .catch((e) => console.warn("[asCognitivePacket] emit failed:", e.message));
    };
    const targetBus = bus || defaultBus;
    if (targetBus && typeof targetBus.publish === "function") {
      publish(targetBus);
    } else if (!bus) {
      void loadDefaultBus().then(publish);
    }
  }

  return packet;
}

// --- Ergonomic aliases for higher handlers adopting COP (e.g. Ophelia "from now on") ---
// These provide the startStep/completeStep names referenced in integration code and docs,
// without introducing new implementation debt. They delegate to the storage-backed marks.

export { createTaskStep as startStep };
export { markTaskStepCompleted as completeStep };
export { markTaskStepFailed as failStep };

export { markTaskCompleted as completeTask };
export { markTaskFailed as failTask };
export { markTaskStarted as startTask };
