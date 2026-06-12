// File: packages/cop-kernel/src/artifacts.js
// Description:
//   Helpers to persist COP artifacts via StorageInterface.artifacts.
//   Optionally emits a COP_EVENT over HTTP (transport layer).

import { getStorage } from "./storage.js";
import { emitCopEvent } from "./events.js";
import { COP_VERSION } from "./message.js";

/**
 * Persist a high-level COP artifact and optionally emit an event.
 *
 * Granularity note (for long-running mutations like "add column to table"):
 * - Fine-grained steps/events are cheap and encouraged for audit + resumption.
 * - Full artifact rows should usually be created for *stable* states only.
 * - During a complex Task, prefer emitting events (or transient/working artifacts)
 *   tagged with taskId/taskStepId. Only "promote" or emit a new stable artifact
 *   (with derivesFrom + stability) when the logical unit of work stabilizes.
 * - This keeps storage/query load reasonable while preserving full causality.
 *
 * @param {Object} params
 * @param {string} params.artifactType
 * @param {string} params.artifactKind
 * @param {string} [params.correlationId]
 * @param {string} [params.messageId]
 * @param {string} [params.eventId]
 * @param {string} [params.taskId]
 * @param {string} [params.taskStepId]
 * @param {Object} params.agent
 * @param {any}    params.content
 * @param {Object} [params.metadata]
 * @param {string} [params.stabilityLevel='stable']  // 'transient' | 'provisional' | 'stable' | 'superseded'
 * @param {string} [params.derivesFromArtifactId]   // for before/after lineage of a mutation
 * @param {boolean} [params.isCompacted=false]
 * @param {string} [params.contentRef]              // external URI/hash for large content (table dumps, etc.)
 * @param {boolean} [params.emitEvent=false]
 * @param {string}  [params.from]
 * @param {string}  [params.endpoint]
 * @param {string}  [params.baseUrl]
 * @param {string}  [params.eventsPath="/cop-events"]
 * @param {string}  [params.copVersion=COP_VERSION]
 * @param {boolean} [params.throwOnError=true]
 */
export async function emitCopArtifact(params) {
  const storage = getStorage();
  const {
    artifactType,
    artifactKind,

    correlationId = null,
    messageId = null,
    eventId = null,

    taskId = null,
    taskStepId = null,

    agent,
    content,
    metadata = {},

    // New for granularity / transactional evolution control
    stabilityLevel = "stable",
    derivesFromArtifactId = null,
    isCompacted = false,
    contentRef = null,

    // Retention / legal / GC policies (key for "rational exploration of the possible")
    // Allows expressing "right to forget", "keep for 10 years", "until superseded", "forever (or until deprecated)", etc.
    retentionPolicy = null, // e.g. { type: 'until_superseded' } | { type: 'fixed_years', years: 10 } | { type: 'legal_hold' } | { type: 'right_to_forget' } | { type: 'forever' }
    retentionExpiresAt = null, // ISO date when it can be GC'd (if policy allows)
    legalHold = false, // explicit hold overrides expiration/forget
    cacheKey = null, // optional stable key for cross-branch reuse / capitalization of intermediary results (hash of inputs + computation)

    emitEvent = false,
    from,
    endpoint,
    baseUrl,
    eventsPath = "/cop-events",
    copVersion = COP_VERSION,

    throwOnError = true,
  } = params || {};

  if (!artifactType) {
    throw new Error("emitCopArtifact: 'artifactType' is required");
  }
  if (!artifactKind) {
    throw new Error("emitCopArtifact: 'artifactKind' is required");
  }
  if (!agent || typeof agent.agentName !== "string") {
    throw new Error("emitCopArtifact: valid 'agent' (with agentName) is required");
  }

  const row = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + "-" + Math.random().toString(16).slice(2),

    correlation_id: correlationId,
    message_id: messageId,
    event_id: eventId,

    task_id: taskId,
    task_step_id: taskStepId,

    network_id: agent.networkId || null,
    node_id: agent.nodeId || null,
    instance_id: agent.instanceId || null,
    agent_name: agent.agentName,

    artifact_type: artifactType,
    artifact_kind: artifactKind,

    // Granularity / evolution controls
    stability_level: stabilityLevel,
    derives_from_artifact_id: derivesFromArtifactId,
    is_compacted: !!isCompacted,
    content_ref: contentRef || null,

    // Retention / cache / capitalization controls for exploration trees
    retention_policy: retentionPolicy,
    retention_expires_at: retentionExpiresAt,
    legal_hold: !!legalHold,
    cache_key: cacheKey || null,

    content,
    metadata: {
      ...metadata,
      // convenience so consumers don't have to dig
      stability: stabilityLevel,
      derivesFrom: derivesFromArtifactId,
      retention: retentionPolicy,
      cacheKey: cacheKey,
      legalHold: !!legalHold,
    },
    created_at: new Date().toISOString(),
  };

  let inserted = null;
  let errorObj = null;

  try {
    inserted = await storage.artifacts.insert(row);
  } catch (err) {
    errorObj = err;
    if (throwOnError) {
      throw err;
    }
  }

  if (emitEvent && inserted) {
    try {
      await emitCopEvent({
        from,
        endpoint,
        baseUrl,
        path: eventsPath,
        event: {
          cop_version: copVersion,
          event_type: "ARTIFACT_CREATED",
          artifact: inserted,
        },
      });
    } catch (err) {
      if (throwOnError) {
        throw err;
      }
    }
  }

  return {
    ok: !errorObj,
    artifact: inserted,
    error: errorObj ? String(errorObj.message || errorObj) : null,
  };
}

/**
 * Promote / stabilize artifacts associated with a completed Task.
 * This is the key mechanism for "the table before vs after" without persisting
 * every micro-mutation as a first-class stable artifact.
 *
 * Pattern for long mutations (e.g. "add column to table"):
 * 1. Start a Task for the logical evolution.
 * 2. During work: emit events (and optionally transient/provisional artifacts tagged with taskId).
 *    Keep heavy state in task metadata, continuation.state, step.checkpoint, or external refs.
 * 3. On success: call this (or manually emit one "stable" artifact with derivesFrom + stability:'stable').
 * 4. On failure: call abortTaskEvolution (no new stable artifact is promoted; old one remains authoritative).
 *
 * Uses storage.artifacts.insert (append-only friendly). If your storage supports
 * update + transaction, a storage.transaction() wrapper can make the promotion
 * + task status update atomic at the DB level.
 */
export async function stabilizeTaskArtifacts(
  taskId,
  {
    stableArtifacts = [], // array of {artifactType, artifactKind, content, metadata?, agent, ...}
    supersededArtifactIds = [], // previous working/transient ones to mark as superseded
    stabilityLevel = "stable",
    agent,
    correlationId = null,
    emitEvent = true,
  } = {}
) {
  const results = [];

  for (const a of stableArtifacts) {
    const res = await emitCopArtifact({
      ...a,
      taskId,
      stabilityLevel,
      derivesFromArtifactId: a.derivesFromArtifactId || null,
      emitEvent,
      agent: a.agent || agent,
      correlationId: a.correlationId || correlationId,
      throwOnError: false,
    });
    results.push(res);
  }

  // Optional: mark superseded (by inserting "superseded" marker artifacts or events;
  // full delete is rare because of audit. A lightweight "superseded" artifact or
  // a bulk update if storage supports it.)
  for (const oldId of supersededArtifactIds) {
    await emitCopArtifact({
      artifactType: "artifact.lifecycle",
      artifactKind: "superseded",
      taskId,
      content: { supersededArtifactId: oldId, reason: "task_stabilized", taskId },
      metadata: { supersededArtifactId: oldId },
      stabilityLevel: "superseded",
      agent,
      correlationId,
      emitEvent,
      throwOnError: false,
    });
  }

  return { ok: results.every((r) => r.ok), results };
}

/**
 * Abort/rollback a Task's evolution.
 * No new stable artifact is created for the "after" state.
 * You can optionally emit compensation artifacts or continuations here.
 * The pre-task stable artifact (if referenced via derives or task initial state)
 * remains the authoritative one.
 */
export async function abortTaskEvolution(
  taskId,
  {
    reason = "task_failed",
    compensationArtifacts = [],
    agent,
    correlationId = null,
    emitEvent = true,
  } = {}
) {
  const results = [];

  // Mark the task-level failure via a lifecycle artifact (lightweight)
  const abortRes = await emitCopArtifact({
    artifactType: "task.evolution",
    artifactKind: "aborted",
    taskId,
    content: { reason, abortedAt: new Date().toISOString() },
    metadata: { reason },
    stabilityLevel: "superseded",
    agent,
    correlationId,
    emitEvent,
    throwOnError: false,
  });
  results.push(abortRes);

  for (const a of compensationArtifacts) {
    const res = await emitCopArtifact({
      ...a,
      taskId,
      stabilityLevel: a.stabilityLevel || "provisional",
      agent: a.agent || agent,
      correlationId: a.correlationId || correlationId,
      emitEvent,
      throwOnError: false,
    });
    results.push(res);
  }

  return { ok: results.every((r) => r.ok), results, mode: "aborted" };
}

/**
 * Convenience: record a before/after pair for a logical mutation under a task.
 * Emits (or references) the "before" if not already recorded, then the "after" as stable.
 * Ideal for the "table before vs after adding a column" case.
 */
export async function recordArtifactEvolution({
  taskId,
  before, // {artifactType, artifactKind, content, ...} or just the id of existing stable
  after, // the new stable state
  agent,
  correlationId,
  operation = "evolve", // e.g. 'add_column', 'refactor', ...
} = {}) {
  let beforeId = before && before.id ? before.id : null;

  if (before && !beforeId) {
    const beforeRes = await emitCopArtifact({
      ...before,
      taskId,
      stabilityLevel: "stable",
      agent,
      correlationId,
      emitEvent: true,
      throwOnError: false,
    });
    beforeId = beforeRes.artifact?.id || beforeRes.artifact?.artifact?.id;
  }

  const afterRes = await emitCopArtifact({
    ...after,
    taskId,
    stabilityLevel: "stable",
    derivesFromArtifactId: beforeId,
    metadata: {
      ...(after.metadata || {}),
      operation,
      beforeArtifactId: beforeId,
    },
    agent,
    correlationId,
    emitEvent: true,
    throwOnError: false,
  });

  return {
    beforeId,
    afterId: afterRes.artifact?.id || afterRes.artifact?.artifact?.id,
    after: afterRes,
  };
}

/**
 * Lookup for reusable / cached intermediary results during rational exploration of possibles.
 * This enables "capitalization": if another branch (or previous exploration) already computed
 * a stable result for the same "cacheKey" (e.g. hash of input state + operation), reuse it
 * instead of re-computing.
 *
 * Example cacheKey: `sha256(table_schema_v3 + 'add_column:foo' + migration_params_hash)`
 *
 * Prefers stable artifacts; falls back according to minStability.
 */
export async function lookupReusableArtifact(
  cacheKey,
  { minStability = "stable", taskId = null, includeProvisional = false } = {}
) {
  const storage = getStorage();
  if (typeof storage.artifacts?.list !== "function") {
    // Fallback: some storages only support insert. In real use, implement list on the backend
    // (Supabase client .from('cop_artifacts').select() with filters, etc.)
    console.warn(
      "[artifacts] storage.artifacts.list not available; cache lookup degraded to no-op. Implement list() on your StorageInterface for full exploration support."
    );
    return { ok: true, data: [], note: "list not implemented on this storage backend" };
  }

  const criteria = { cacheKey, minStability };
  if (taskId) criteria.taskId = taskId;
  if (includeProvisional) criteria.includeProvisional = true;

  const res = await storage.artifacts.list(criteria);
  // Filter out legally forgotten or expired if policy engine present (here simplistic)
  const usable = (res.data || []).filter((a) => {
    if (a.legal_hold) return true; // hold wins
    if (a.retention_expires_at && new Date(a.retention_expires_at) < new Date()) return false;
    return true;
  });

  return { ok: true, data: usable, count: usable.length };
}

/**
 * Apply a retention / GC decision to one or more artifacts.
 * Supports legal "right to forget", time-based expiration, "until superseded", etc.
 * In a full system this would be driven by a scheduled GC task or agent judgment,
 * and would publish events (never silently delete the event log itself).
 */
export async function applyRetentionPolicy(artifactIdsOrQuery, policyDecision) {
  const storage = getStorage();
  const ids = Array.isArray(artifactIdsOrQuery) ? artifactIdsOrQuery : [];

  // If query provided and list supported, resolve first
  if (!Array.isArray(artifactIdsOrQuery) && typeof storage.artifacts?.list === "function") {
    const listRes = await storage.artifacts.list(artifactIdsOrQuery);
    ids.push(...(listRes.data || []).map((a) => a.id));
  }

  const results = [];
  for (const id of ids) {
    if (typeof storage.artifacts?.applyRetention === "function") {
      const r = await storage.artifacts.applyRetention(
        id,
        policyDecision.action || "mark_superseded"
      );
      results.push(r);
    } else {
      // Fallback: emit a lifecycle artifact recording the policy application
      // (the original artifact row stays for audit; "forget" is a projection/view concern)
      const res = await emitCopArtifact({
        artifactType: "artifact.retention",
        artifactKind: "policy_applied",
        content: {
          targetArtifactId: id,
          decision: policyDecision,
          appliedAt: new Date().toISOString(),
        },
        metadata: { target: id, ...policyDecision },
        stabilityLevel: "stable", // the retention decision itself is durable
        agent: policyDecision.decidedBy || { agentName: "retention-policy-engine" },
      });
      results.push(res);
    }
  }
  return { ok: results.every((r) => r.ok), results, affected: ids.length };
}

/**
 * Garbage collection / retention sweep helper.
 * Walks artifacts matching criteria and applies policy (e.g. mark superseded or emit forget events).
 * Intended to be called by a scheduled Job or a dedicated retention Cogitor.
 * Respects legal_hold and different policy types.
 */
export async function runRetentionSweep(
  criteria = { stabilityLevel: "transient" },
  defaultPolicy = { action: "mark_superseded" }
) {
  const storage = getStorage();
  if (typeof storage.artifacts?.list !== "function") {
    return { ok: false, error: "storage does not support artifact listing for GC" };
  }
  const candidates = await storage.artifacts.list(criteria);
  const toProcess = (candidates.data || []).filter((a) => {
    if (a.legal_hold) return false;
    if (a.retention_policy?.type === "forever") return false;
    if (a.retention_expires_at && new Date(a.retention_expires_at) > new Date()) return false;
    return true;
  });

  const actions = [];
  for (const art of toProcess) {
    const decision = art.retention_policy || defaultPolicy;
    const r = await applyRetentionPolicy([art.id], { ...decision, decidedBy: "retention-sweep" });
    actions.push(r);
  }
  return { ok: true, swept: toProcess.length, actions };
}
