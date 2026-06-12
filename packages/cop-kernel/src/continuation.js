/**
 * continuation.js
 *
 * Low-level COP Continuation primitives.
 *
 * Lineage and context:
 * - Historical precedent: l8 (https://github.com/JeanHuguesRobert/l8) — an early JS library
 *   that modeled "Tasks" as activities broken into "Steps" executed by a scheduler, with
 *   blocking-style control flow via cooperating closures, promises, and synchronization primitives.
 *   l8 tasks are user-level non-preemptive threads / promises with rich resumption.
 * - Future target: Inox (https://github.com/virteal/Inox or JeanHuguesRobert/Inox) — the
 *   concatenative stack VM with strict control/data plane separation, actors, and named values,
 *   intended as the efficient runtime substrate for COP agents/nodes at the edge (Fractanet).
 *   Inox's control structures and actor model are designed to implement COP-level Task/Step/Continuation
 *   semantics with minimal overhead and excellent traceability.
 *
 * These functions are derived directly from the normative specification
 * in packages/cop-core/Architecture.md (primarily sections 2.4 Task, 2.5 Step, 2.7 Continuation,
 * and 5.5 Continuation Execution Semantics).
 *
 * Goal: Provide a faithful, minimal implementation that can be used to
 * validate and harden the spec itself through real usage in the bac-à-sable.
 *
 * If the spec is ambiguous or incomplete, this implementation will surface it.
 *
 * See also:
 * - cop-kernel/src/jobScheduler.js (higher-level scheduling on top of continuations)
 * - cop-kernel/src/scheduler.js (the reactor that resumes continuations)
 * - The supabase COP schema (cop_task, cop_step, cop_artifact for continuations)
 * - inseme research/ and sandbox/cop-continuation-bac-a-sable for practical usage patterns.
 */

// Cross-environment UUID (node crypto, web crypto, or fallback).
// Avoids top-level "import from 'crypto'" which breaks browser bundlers (Vite etc).
function getRandomUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Simple v4-like fallback (good enough for correlation/continuation IDs in browser contexts)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates a Continuation Descriptor.
 *
 * Derived from spec §2.7 "Continuation Artifact":
 * - It represents suspended/deferred work.
 * - Must contain: where to resume (agent/topic/task/step), how (state),
 *   under which conditions (waitForEvents, resumeAfter, resumeBefore),
 *   and optional retry hints.
 *
 * This is the in-memory / message form before it becomes a persisted
 * `cop/continuation` Artifact.
 */
export function createContinuationDescriptor(params = {}) {
  const {
    resumeTo, // maps to "agent" in the Artifact payload
    resumeIntent,
    correlationId = null,
    channel = null,
    taskId = null,
    stepId = null,
    state = {},
    waitForEvents = [],
    resumeAfter = null,
    resumeBefore = null,
    retry = null,
    label = null,
    meta = {},
  } = params;

  if (!resumeTo) {
    throw new Error("createContinuationDescriptor: 'resumeTo' (agent) is required per spec §2.7");
  }

  const descriptor = {
    continuationId: getRandomUUID(),
    type: "cop/continuation", // as per spec §2.7.3 Reserved Type Name
    resumeTo, // "agent" field
    resumeIntent,
    correlationId: correlationId || getRandomUUID(),
    channel,
    taskId,
    stepId,
    state, // JSON-serializable state for resumption
    conditions: {
      waitForEvents: Array.isArray(waitForEvents) ? waitForEvents : [],
      resumeAfter: resumeAfter || null, // ISO-8601 as per spec
      resumeBefore: resumeBefore || null,
    },
    retry: retry || undefined,
    label,
    meta,
    createdAt: new Date().toISOString(),
  };

  return descriptor;
}

/**
 * Returns whether a continuation with a retry policy should be retried.
 * Supports exponential backoff: if retryDelayMs is provided, the actual delay
 * for this attempt is computed as retryDelayMs * 2^(attempt-1).
 *
 * Also supports obsolescence: if the continuation has been marked obsolete
 * (by an agent, typically an AI), retry is refused.
 */
export function prepareRetry(continuation) {
  if (!continuation || !continuation.retry) {
    return { shouldRetry: false, nextState: continuation?.state || {} };
  }

  // Obsolescence check (decided by an agent / AI in absence of precise spec)
  if (continuation.obsolete) {
    return {
      shouldRetry: false,
      nextState: continuation.state || {},
      obsolete: true,
      obsolescenceReason: continuation.obsolescenceReason || "marked obsolete by agent",
    };
  }

  const retryPolicy = continuation.retry;
  const currentAttempt = retryPolicy.attempt || 1;
  const maxAttempts = retryPolicy.maxAttempts || 1;

  if (currentAttempt >= maxAttempts) {
    return { shouldRetry: false, nextState: continuation.state || {} };
  }

  const nextAttempt = currentAttempt + 1;
  const baseDelayMs = retryPolicy.retryDelayMs || 0;

  // Exponential backoff
  const delayMs = baseDelayMs > 0 ? Math.floor(baseDelayMs * Math.pow(2, currentAttempt - 1)) : 0;

  const nextState = {
    ...(continuation.state || {}),
    _retry: {
      attempt: nextAttempt,
      maxAttempts,
      previousError: continuation.state?._retry?.lastError || null,
      backoffDelayMs: delayMs,
    },
  };

  const updatedContinuation = {
    ...continuation,
    state: nextState,
    retry: {
      ...retryPolicy,
      attempt: nextAttempt,
    },
  };

  // Handle delayed automatic re-registration with exponential backoff
  if (delayMs > 0) {
    const resumeAfter = new Date(Date.now() + delayMs).toISOString();
    updatedContinuation.conditions = {
      ...(updatedContinuation.conditions || {}),
      resumeAfter,
    };
  }

  return {
    shouldRetry: true,
    nextAttempt,
    updatedContinuation,
    nextState,
    delayMs,
    hasDelay: delayMs > 0,
    backoffApplied: true,
  };
}

/**
 * Marks a continuation as having reached max retries (no more retry possible).
 */
export function markMaxRetriesReached(continuation) {
  return {
    ...continuation,
    retry: {
      ...(continuation.retry || {}),
      exhausted: true,
    },
    state: {
      ...(continuation.state || {}),
      _retry: {
        ...(continuation.state?._retry || {}),
        exhausted: true,
      },
    },
  };
}

/**
 * Marks a continuation as obsolete.
 * This is the "clause d'obsolescence" – in the absence of a precise specification,
 * the decision is left to the judgment of an agent (typically an AI agent).
 *
 * Once obsolete, prepareRetry will refuse further retries.
 */
export function markContinuationObsolete(
  continuation,
  reason = "marked obsolete by agent",
  decidedBy = "agent"
) {
  return {
    ...continuation,
    obsolete: true,
    obsolescenceReason: reason,
    obsolescenceDecidedBy: decidedBy,
    obsolescenceDecidedAt: new Date().toISOString(),
  };
}

/**
 * Attaches a continuation descriptor to a COP Message.
 *
 * This is an internal mechanism (not directly in the Event schema) used by
 * higher-level helpers (callAgentWithContinuation) to carry resumption
 * information alongside a message.
 *
 * In a full implementation this would typically result in a `cop/continuation`
 * Artifact being created via an Event.
 */
export function attachContinuationToMessage(message, continuation) {
  if (!message || typeof message !== "object") {
    throw new Error("attachContinuationToMessage: message must be an object");
  }
  if (!continuation || !continuation.continuationId) {
    throw new Error("attachContinuationToMessage: valid continuation descriptor required");
  }

  // Per usage patterns and the spirit of spec §5.5, we attach under metadata.continuation
  return {
    ...message,
    metadata: {
      ...(message.metadata || {}),
      continuation: {
        continuationId: continuation.continuationId,
        resumeTo: continuation.resumeTo,
        resumeIntent: continuation.resumeIntent,
        correlationId: continuation.correlationId,
        taskId: continuation.taskId,
        stepId: continuation.stepId,
      },
    },
  };
}

// === l8 + "side" bridge for Cogitors as steps (user request: Cogitor as special l8 Step) ===

/**
 * Create an l8-compatible waitable for a Cogitor call.
 *
 * This gives COP an "l8 face": from inside l8.task/.step code, a remote or heterogeneous
 * Cogitor (e.g. JVM agent speaking the packet protocol) can be treated as a local cooperative
 * blocking Step.
 *
 * The returned object has a .promise that l8 code can pass to l8.wait(promise) (or integrate
 * with l8's parole/promise support) to block the current l8 step until the result arrives.
 *
 * The caller is responsible for:
 * - Emitting/sending the associated stack-call or continuation packet to the target Cogitor
 *   (via runner.resume, emit, or direct).
 * - When the result is delivered back (via the runner's deliverResult / continuation-input path,
 *   or directly in an onPacket handler for 'continuation-input'), calling the .resolve(value)
 *   or .reject(err) on the waitable.
 *
 * This closes the loop for "when a JVM needs results from external agents, with all benefits of l8".
 *
 * See also the lineage doc for full discussion and the "side" complementarity.
 */
export function createCogitorL8Waitable(targetCapability, stack = [], opts = {}) {
  let resolveFn, rejectFn;
  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const cont = createContinuationDescriptor({
    resumeTo: targetCapability,
    state: { stack, ...(opts.state || {}) },
    ...opts,
  });

  return {
    promise,
    continuation: cont,
    resolve: resolveFn,
    reject: rejectFn,
    // Convenience: the stack frame packet you can emit/send to initiate the call.
    // Requires import { createStackCallPacket } from './stdio.js' in caller if you use this.
    // Or build manually.
    buildStackCallPacket() {
      // Lazy to avoid circular if not needed.
      // In real use, caller does:
      // import { createStackCallPacket } from './stdio.js';
      // const pkt = createStackCallPacket({ stack, continuation: cont, verb: opts.verb || 'call', targetCapability });
      return { stack, continuation: cont, verb: opts.verb || "call", targetCapability };
    },
  };
}

/**
 * Simple promise wrapper for a Cogitor call, suitable for use inside "side" actions
 * (from the sibling `side/` repo: sync-looking async via retry + slots + delayed writes).
 *
 * Example with side (outer retryable "cognitive function"):
 *   Side(function (side) {
 *     const result = side.slot(() => callCogitorAsPromise('my-cap', [data]));
 *     // use result synchronously
 *     if (side.once('finalize')) {
 *       side.write(() => promoteStableArtifact(result));  // only on success
 *     }
 *     return result;
 *   });
 *
 * The promise will "block" the side action (trigger retry + slot caching), exactly as
 * any other async in side.slot.
 *
 * Complements l8: use l8 inside for fine-grained step trees of Cogitors; wrap the whole
 * turn with side for purity until side effects (e.g. stable artifacts, real writes).
 *
 * This is the "final reconciliation" of asynchronicity (remote Cogitors) with synchronous API
 * that the side repo aimed for, now applied to the COP + l8 world.
 */
export function callCogitorAsPromise(targetCapability, stack = [], opts = {}) {
  const waitable = createCogitorL8Waitable(targetCapability, stack, opts);
  // Caller must:
  // 1. Send the call (using waitable.continuation or build the packet).
  // 2. On result delivery for that continuation: waitable.resolve(value) or .reject(err).
  // The promise then resolves for the side.slot or l8.wait.
  return waitable.promise;
}

/**
 * Builds a COP Message used to trigger resumption of a Continuation.
 *
 * This is the message the Scheduler (or an external trigger) would send
 * when resumption conditions are met (§5.5.2 and §5.5.3).
 *
 * The receiving side (Agent) is expected to receive the original continuation
 * state + the triggering context.
 */
export function buildContinuationResumeMessage(params = {}) {
  const { continuation, payload = {}, from = null, triggeringEvent = null } = params;

  if (!continuation || !continuation.continuationId) {
    throw new Error("buildContinuationResumeMessage: valid continuation descriptor required");
  }

  return {
    cop_version: "0.1",
    message_id: getRandomUUID(),
    correlation_id: continuation.correlationId || continuation.continuationId,
    from: from || "cop-scheduler",
    to: continuation.resumeTo,
    intent: continuation.resumeIntent || "resume-continuation",
    channel: continuation.channel,
    payload: {
      resumedContinuationId: continuation.continuationId,
      state: continuation.state, // the state the Agent should resume with
      triggeringEvent, // the event that caused resumption (if any)
      ...payload,
    },
    metadata: {
      continuation: {
        continuationId: continuation.continuationId,
        isResumption: true,
        originalResumeTo: continuation.resumeTo,
      },
    },
  };
}
