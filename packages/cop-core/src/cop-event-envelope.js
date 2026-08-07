/**
 * cop.event/v1 envelope — create, hash, validate (Inseme #28 residual).
 * Zero external deps. Schema file is authoritative documentation; runtime
 * checks implement the required invariants without a full JSON-Schema engine.
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COP_EVENT_SCHEMA = "cop.event/v1";

const EPISTEMIC = new Set([
  "observed",
  "computed",
  "declared",
  "inferred",
  "normative",
  "proposed",
  "decided",
  "published",
]);

const VISIBILITY = new Set(["open", "redacted", "restricted", "sealed", "opaque_but_escrowed"]);

/**
 * Canonical payload hash over stable JSON (sorted keys).
 * @param {unknown} payload
 * @returns {string} sha256:<hex>
 */
export function hashPayload(payload) {
  const canonical = stableStringify(payload ?? {});
  const hex = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `sha256:${hex}`;
}

/**
 * Build a full envelope from partial / flat mapper output.
 * Assigns event_id and recorded_at when missing. topic.seq may be 0 meaning
 * "assign on append" — stores may overwrite seq.
 *
 * @param {object} partial
 * @returns {object}
 */
export function createCopEventEnvelope(partial = {}) {
  const now = new Date().toISOString();
  const payload = partial.payload && typeof partial.payload === "object" ? partial.payload : {};

  const topicId = partial.topic?.id || partial.topic_id || partial.topicId || "topic:unknown";
  const topicSeq = Number(partial.topic?.seq ?? partial.topic_seq ?? partial.topicSeq ?? 0);

  const envelope = {
    schema: COP_EVENT_SCHEMA,
    event_id: partial.event_id || partial.eventId || randomUUID(),
    event_type: partial.event_type || partial.eventType || COP_EVENT_SCHEMA,
    log_id: partial.log_id ?? partial.logId ?? null,
    topic: {
      id: String(topicId),
      seq: Number.isFinite(topicSeq) && topicSeq > 0 ? topicSeq : 0,
    },
    time: {
      occurred_at: partial.time?.occurred_at ?? partial.occurred_at ?? null,
      observed_at: partial.time?.observed_at ?? partial.observed_at ?? null,
      recorded_at: partial.time?.recorded_at ?? partial.recorded_at ?? now,
    },
    origin_ref: partial.origin_ref ?? partial.originRef ?? null,
    subject_ref: partial.subject_ref ?? partial.subjectRef ?? null,
    actor_ref: partial.actor_ref ?? partial.actorRef ?? partial.actor_id ?? null,
    correlation_id: partial.correlation_id ?? partial.correlationId ?? null,
    causation_id: partial.causation_id ?? partial.causationId ?? null,
    parent_event_ids: Array.isArray(partial.parent_event_ids)
      ? partial.parent_event_ids
      : Array.isArray(partial.causal_refs)
        ? partial.causal_refs
        : [],
    packet_id: partial.packet_id ?? partial.packetId ?? null,
    mandate_ref: partial.mandate_ref ?? partial.mandateRef ?? null,
    visibility: partial.visibility || "restricted",
    epistemic_status: partial.epistemic_status || partial.epistemicStatus || "observed",
    payload,
    payload_hash: partial.payload_hash || hashPayload(payload),
    artifact_ref: partial.artifact_ref ?? partial.artifactRef ?? null,
    idempotency_key: partial.idempotency_key ?? partial.idempotencyKey ?? null,
    meta: partial.meta && typeof partial.meta === "object" ? partial.meta : {},
  };

  return envelope;
}

/**
 * Runtime validation (required fields + enums + payload_hash match).
 * @param {unknown} value
 * @param {{ requirePositiveSeq?: boolean }} [options]
 * @returns {{ ok: true, event: object } | { ok: false, errors: string[] }}
 */
export function validateCopEventEnvelope(value, options = {}) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["envelope_not_object"] };
  }
  const e = /** @type {Record<string, any>} */ (value);

  if (e.schema !== COP_EVENT_SCHEMA) {
    errors.push(`schema_must_be_${COP_EVENT_SCHEMA}`);
  }
  if (!e.event_id || typeof e.event_id !== "string") {
    errors.push("event_id_required");
  }
  if (!e.event_type || typeof e.event_type !== "string") {
    errors.push("event_type_required");
  }
  if (!e.topic || typeof e.topic !== "object") {
    errors.push("topic_required");
  } else {
    if (!e.topic.id || typeof e.topic.id !== "string") {
      errors.push("topic.id_required");
    }
    const seq = Number(e.topic.seq);
    if (!Number.isFinite(seq)) errors.push("topic.seq_must_be_number");
    else if (options.requirePositiveSeq && !(seq > 0)) {
      errors.push("topic.seq_must_be_positive");
    } else if (seq < 0) {
      errors.push("topic.seq_must_be_non_negative");
    }
  }
  if (!e.time || typeof e.time !== "object" || !e.time.recorded_at) {
    errors.push("time.recorded_at_required");
  }
  if (!EPISTEMIC.has(String(e.epistemic_status || ""))) {
    errors.push("epistemic_status_invalid");
  }
  if (e.visibility != null && !VISIBILITY.has(String(e.visibility))) {
    errors.push("visibility_invalid");
  }
  if (!e.payload || typeof e.payload !== "object" || Array.isArray(e.payload)) {
    errors.push("payload_must_be_object");
  }
  if (typeof e.payload_hash !== "string" || !/^sha256:[a-f0-9]{64}$/.test(e.payload_hash)) {
    errors.push("payload_hash_invalid");
  } else if (e.payload && typeof e.payload === "object") {
    const expected = hashPayload(e.payload);
    if (expected !== e.payload_hash) {
      errors.push("payload_hash_mismatch");
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, event: e };
}

/**
 * Load schema document path (for tools / docs).
 */
export function getCopEventSchemaPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../schemas/cop.event.v1.json");
}

export function loadCopEventSchemaDocument() {
  return JSON.parse(fs.readFileSync(getCopEventSchemaPath(), "utf8"));
}

function stableStringify(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortKeys(value[key]);
  }
  return out;
}
