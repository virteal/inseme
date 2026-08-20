/**
 * Build a Corpus-safe receipt for a retained local working trace.
 *
 * The receipt intentionally carries event identities and integrity hashes, not
 * prompts, streamed deltas, or handler-private payloads. A later authorised
 * process can inspect the local trace while its retention window remains open.
 */

import { createCopEventEnvelope, hashPayload } from "./cop-event-envelope.js";
import { normalizeResourceAssessments } from "./resource-assessment.js";

function text(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`);
  return value;
}

function isoTime(value, name) {
  text(value, name);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be an ISO timestamp`);
  return value;
}

function eventReference(event) {
  text(event?.event_id, "event.event_id");
  text(event?.event_type, "event.event_type");
  text(event?.payload_hash, "event.payload_hash");
  text(event?.topic?.id, "event.topic.id");
  if (!Number.isInteger(event.topic.seq) || event.topic.seq < 1) {
    throw new TypeError("event.topic.seq must be a positive integer");
  }
  return {
    event_id: event.event_id,
    event_type: event.event_type,
    topic_id: event.topic.id,
    topic_seq: event.topic.seq,
    payload_hash: event.payload_hash,
  };
}

/**
 * Construct a summary receipt suitable for the long-term Corpus.
 * `summary` is caller-authored consolidated meaning; it must not contain raw
 * working trace content. The constructor only records proof references.
 */
export function createLocalTraceConsolidationReceipt({
  consolidation_id,
  local_store_ref,
  retained_until,
  events,
  summary,
  artifact_refs = [],
  resource_assessments = [],
  created_at = new Date().toISOString(),
} = {}) {
  text(consolidation_id, "consolidation_id");
  text(local_store_ref, "local_store_ref");
  isoTime(retained_until, "retained_until");
  isoTime(created_at, "created_at");
  if (!Array.isArray(events) || events.length === 0)
    throw new TypeError("events must be a non-empty array");
  if (!summary || typeof summary !== "object" || Array.isArray(summary))
    throw new TypeError("summary is required");
  if (!Array.isArray(artifact_refs)) throw new TypeError("artifact_refs must be an array");
  if (!Array.isArray(resource_assessments))
    throw new TypeError("resource_assessments must be an array");

  const references = events
    .map(eventReference)
    .sort(
      (left, right) =>
        left.topic_id.localeCompare(right.topic_id) || left.topic_seq - right.topic_seq
    );
  return {
    schema: "cop.local-trace-consolidation.receipt.v1",
    consolidation_id,
    created_at,
    local_trace: {
      store_ref: local_store_ref,
      retained_until,
      event_count: references.length,
      first_event_ref: references[0],
      last_event_ref: references.at(-1),
      integrity_hash: hashPayload({ event_references: references }),
    },
    summary: structuredClone(summary),
    artifact_refs: structuredClone(artifact_refs),
    resource_assessments: normalizeResourceAssessments(resource_assessments),
  };
}

/**
 * Record an explicit consolidation act in the caller-selected Corpus store.
 * It deliberately receives an already-consolidated receipt, so this function
 * has no access to the raw local payloads it is proving.
 */
export function recordLocalTraceConsolidation(
  corpusStore,
  {
    receipt,
    principal_ref,
    mandate_ref,
    logical_agent_ref,
    handler_instance_ref = null,
    topic_id,
  } = {}
) {
  if (!corpusStore || typeof corpusStore.append !== "function") {
    throw new TypeError("corpusStore.append is required");
  }
  if (!receipt || receipt.schema !== "cop.local-trace-consolidation.receipt.v1") {
    throw new TypeError("a local trace consolidation receipt is required");
  }
  text(principal_ref, "principal_ref");
  text(mandate_ref, "mandate_ref");
  text(logical_agent_ref, "logical_agent_ref");
  const result = corpusStore.append(
    createCopEventEnvelope({
      event_type: "LocalTraceConsolidated",
      topic_id: topic_id || `consolidation:${receipt.consolidation_id}`,
      actor_ref: logical_agent_ref,
      subject_ref: logical_agent_ref,
      mandate_ref,
      visibility: "restricted",
      epistemic_status: "observed",
      origin_ref: `local-trace:${receipt.local_trace.integrity_hash}`,
      idempotency_key: `local-trace-consolidation:${receipt.consolidation_id}`,
      payload: {
        kind: "LocalTraceConsolidation",
        principal_ref,
        mandate_ref,
        logical_agent_ref,
        handler_instance_ref,
        receipt,
      },
    })
  );
  if (!result.ok) throw new Error(`local_trace_consolidation_append_failed:${result.error}`);
  return {
    ok: true,
    duplicate: Boolean(result.duplicate),
    event: result.event,
    receipt,
  };
}
