/**
 * Trace-Centric Architecture Primitives for COP 2.x (Issue #61, #63).
 *
 * Implements the core primitives:
 * - TraceRef: Universal addressing of internal and external traces without payload duplication.
 * - TraceDescriptor: Metadata sufficient to reason about a trace without materializing its bytes.
 * - Assertion: Proposition held by the Corpus with stable identity and revision history.
 * - EvidenceRelation: Typed epistemic relation (supports, contradicts, contextualizes)
 *   connecting traces to assertions without destructive overwrite.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCopEventEnvelope } from "./cop-event-envelope.js";

export const COP_TRACE_REF_SCHEMA = "cop.trace-ref/v1";
export const COP_TRACE_DESCRIPTOR_SCHEMA = "cop.trace-descriptor/v1";
export const COP_ASSERTION_SCHEMA = "cop.assertion/v1";
export const COP_EVIDENCE_RELATION_SCHEMA = "cop.evidence-relation/v1";

export const TRACE_TARGET_TYPES = Object.freeze(["cop_event", "cop_artifact", "external"]);
export const EVIDENCE_RELATION_TYPES = Object.freeze(["supports", "contradicts", "contextualizes"]);
export const EPISTEMIC_STATUSES = Object.freeze([
  "observed",
  "computed",
  "declared",
  "inferred",
  "normative",
  "proposed",
  "decided",
  "published",
  "hypothesized",
  "disputed",
]);
export const TRACE_VISIBILITY = Object.freeze([
  "open",
  "redacted",
  "restricted",
  "sealed",
  "opaque_but_escrowed",
]);

const HASH_REGEX = /^sha256:[a-f0-9]{64}$/;

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function requireIsoDateTime(value, name) {
  requireNonEmptyString(value, name);
  if (Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${name} must be a valid ISO-8601 date-time string`);
  }
  return value;
}

// ----------------------------------------------------------------------
// 1. TraceRef
// ----------------------------------------------------------------------

/**
 * Construct a valid TraceRef.
 *
 * @param {object} options
 * @param {string} options.trace_id - Stable canonical URI or identifier.
 * @param {'cop_event'|'cop_artifact'|'external'} options.target_type - Target classification.
 * @param {string|null} [options.integrity] - Optional cryptographic digest (e.g. sha256:...).
 * @param {string|null} [options.locator] - Optional resolution locator distinct from identity.
 * @param {object|null} [options.resolution_hints] - Optional resolution metadata.
 * @returns {object}
 */
export function createTraceRef({
  trace_id,
  target_type,
  integrity = null,
  locator = null,
  resolution_hints = null,
} = {}) {
  requireNonEmptyString(trace_id, "trace_id");
  if (!TRACE_TARGET_TYPES.includes(target_type)) {
    throw new TypeError(`target_type must be one of: ${TRACE_TARGET_TYPES.join(", ")}`);
  }
  if (integrity != null) {
    if (typeof integrity !== "string" || !HASH_REGEX.test(integrity)) {
      throw new TypeError("integrity must be a valid sha256:<64 hex chars> string");
    }
  }
  if (locator != null && typeof locator !== "string") {
    throw new TypeError("locator must be a string or null");
  }
  if (
    resolution_hints != null &&
    (typeof resolution_hints !== "object" || Array.isArray(resolution_hints))
  ) {
    throw new TypeError("resolution_hints must be an object or null");
  }

  return {
    schema: COP_TRACE_REF_SCHEMA,
    trace_id,
    target_type,
    integrity: integrity ?? null,
    locator: locator ?? null,
    resolution_hints: resolution_hints ? structuredClone(resolution_hints) : null,
  };
}

/**
 * Validate a TraceRef object.
 *
 * @param {unknown} value
 * @returns {{ ok: true, trace_ref: object } | { ok: false, errors: string[] }}
 */
export function validateTraceRef(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["trace_ref_must_be_object"] };
  }
  const ref = /** @type {Record<string, any>} */ (value);
  if (ref.schema !== COP_TRACE_REF_SCHEMA) {
    errors.push(`schema_must_be_${COP_TRACE_REF_SCHEMA}`);
  }
  if (!ref.trace_id || typeof ref.trace_id !== "string" || ref.trace_id.trim().length === 0) {
    errors.push("trace_id_required");
  }
  if (!TRACE_TARGET_TYPES.includes(ref.target_type)) {
    errors.push("target_type_invalid");
  }
  if (ref.integrity != null && !HASH_REGEX.test(ref.integrity)) {
    errors.push("integrity_invalid");
  }
  if (ref.locator != null && typeof ref.locator !== "string") {
    errors.push("locator_must_be_string");
  }
  if (
    ref.resolution_hints != null &&
    (typeof ref.resolution_hints !== "object" || Array.isArray(ref.resolution_hints))
  ) {
    errors.push("resolution_hints_must_be_object");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, trace_ref: ref };
}

/**
 * Obtain a TraceRef for a COP Event without copying or mutating the Event payload.
 *
 * @param {object} event - A valid COP Event envelope.
 * @returns {object} TraceRef
 */
export function traceRefFromCopEvent(event) {
  if (!event || typeof event !== "object") {
    throw new TypeError("event must be an object");
  }
  const eventId = event.event_id || event.id;
  requireNonEmptyString(eventId, "event.event_id");

  const topicId = event.topic?.id || event.topicId;
  const topicSeq = event.topic?.seq ?? event.topicSeq;
  const integrity = event.payload_hash || null;

  return createTraceRef({
    trace_id: `cop:event:${eventId}`,
    target_type: "cop_event",
    integrity: integrity && HASH_REGEX.test(integrity) ? integrity : null,
    locator: topicId ? `topic:${topicId}` : null,
    resolution_hints: {
      topic_id: topicId ?? null,
      topic_seq: topicSeq ?? null,
      event_type: event.event_type || event.type || null,
      epistemic_status: event.epistemic_status || null,
    },
  });
}

/**
 * Obtain a TraceRef for a COP Artifact.
 *
 * @param {object} artifact - A COP Artifact object.
 * @returns {object} TraceRef
 */
export function traceRefFromCopArtifact(artifact) {
  if (!artifact || typeof artifact !== "object") {
    throw new TypeError("artifact must be an object");
  }
  const artifactId = artifact.id || artifact.artifact_id || artifact.hash;
  requireNonEmptyString(artifactId, "artifact.id");

  const integrity = artifact.hash || artifact.integrity || null;
  const locator = artifact.uri || artifact.path || null;

  return createTraceRef({
    trace_id: `cop:artifact:${artifactId}`,
    target_type: "cop_artifact",
    integrity: integrity && HASH_REGEX.test(integrity) ? integrity : null,
    locator,
    resolution_hints: {
      type: artifact.type || null,
      schema_version: artifact.schemaVersion || artifact.schema_version || null,
    },
  });
}

/**
 * Construct a TraceRef for an external durable trace.
 *
 * @param {object} options
 * @param {string} options.trace_id - Stable external URI or URN.
 * @param {string|null} [options.locator] - URL, file path, or resolution endpoint.
 * @param {string|null} [options.integrity] - Cryptographic digest if available.
 * @param {object|null} [options.resolution_hints] - Contextual resolution hints.
 * @returns {object} TraceRef
 */
export function createExternalTraceRef({
  trace_id,
  locator = null,
  integrity = null,
  resolution_hints = null,
} = {}) {
  return createTraceRef({
    trace_id,
    target_type: "external",
    integrity,
    locator,
    resolution_hints,
  });
}

// ----------------------------------------------------------------------
// 2. TraceDescriptor
// ----------------------------------------------------------------------

/**
 * Construct a TraceDescriptor providing metadata to reason about a trace
 * without materializing its raw payload. MUST NOT contain assertions or interpretations.
 *
 * @param {object} options
 * @param {object} options.trace_ref - Target TraceRef.
 * @param {string} options.kind - Trace classification.
 * @param {string} options.origin - Durable provenance/origin.
 * @param {string} [options.observed_at] - ISO date-time of observation.
 * @param {string|null} [options.occurred_at] - Temporal claim of occurrence.
 * @param {string|null} [options.created_at] - Creation timestamp if distinct.
 * @param {string|null} [options.integrity] - Cryptographic digest.
 * @param {string} [options.visibility] - Access class.
 * @param {string|null} [options.custody] - Authority/custodian holding the bytes.
 * @param {object} [options.meta] - Non-interpretive metadata.
 * @returns {object}
 */
export function createTraceDescriptor({
  trace_ref,
  kind,
  origin,
  observed_at = new Date().toISOString(),
  occurred_at = null,
  created_at = null,
  integrity = null,
  visibility = "restricted",
  custody = null,
  meta = {},
} = {}) {
  const refValidation = validateTraceRef(trace_ref);
  if (!refValidation.ok) {
    throw new TypeError(`Invalid trace_ref: ${refValidation.errors.join(", ")}`);
  }
  requireNonEmptyString(kind, "kind");
  requireNonEmptyString(origin, "origin");
  requireIsoDateTime(observed_at, "observed_at");
  if (occurred_at != null) requireIsoDateTime(occurred_at, "occurred_at");
  if (created_at != null) requireIsoDateTime(created_at, "created_at");
  if (integrity != null && !HASH_REGEX.test(integrity)) {
    throw new TypeError("integrity must be a valid sha256:<hex> string");
  }
  if (!TRACE_VISIBILITY.includes(visibility)) {
    throw new TypeError(`visibility must be one of: ${TRACE_VISIBILITY.join(", ")}`);
  }
  if (custody != null && typeof custody !== "string") {
    throw new TypeError("custody must be a string or null");
  }

  return {
    schema: COP_TRACE_DESCRIPTOR_SCHEMA,
    trace_ref: refValidation.trace_ref,
    kind,
    origin,
    observed_at,
    occurred_at: occurred_at ?? null,
    created_at: created_at ?? null,
    integrity: integrity ?? trace_ref.integrity ?? null,
    visibility,
    custody: custody ?? null,
    meta: meta && typeof meta === "object" ? structuredClone(meta) : {},
  };
}

/**
 * Validate a TraceDescriptor.
 *
 * @param {unknown} value
 * @returns {{ ok: true, descriptor: object } | { ok: false, errors: string[] }}
 */
export function validateTraceDescriptor(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["trace_descriptor_must_be_object"] };
  }
  const desc = /** @type {Record<string, any>} */ (value);
  if (desc.schema !== COP_TRACE_DESCRIPTOR_SCHEMA) {
    errors.push(`schema_must_be_${COP_TRACE_DESCRIPTOR_SCHEMA}`);
  }
  const refValidation = validateTraceRef(desc.trace_ref);
  if (!refValidation.ok) {
    errors.push(...refValidation.errors.map((e) => `trace_ref.${e}`));
  }
  if (!desc.kind || typeof desc.kind !== "string" || desc.kind.trim().length === 0) {
    errors.push("kind_required");
  }
  if (!desc.origin || typeof desc.origin !== "string" || desc.origin.trim().length === 0) {
    errors.push("origin_required");
  }
  if (!desc.observed_at || Number.isNaN(Date.parse(desc.observed_at))) {
    errors.push("observed_at_invalid");
  }
  if (desc.occurred_at != null && Number.isNaN(Date.parse(desc.occurred_at))) {
    errors.push("occurred_at_invalid");
  }
  if (desc.created_at != null && Number.isNaN(Date.parse(desc.created_at))) {
    errors.push("created_at_invalid");
  }
  if (desc.integrity != null && !HASH_REGEX.test(desc.integrity)) {
    errors.push("integrity_invalid");
  }
  if (desc.visibility != null && !TRACE_VISIBILITY.includes(desc.visibility)) {
    errors.push("visibility_invalid");
  }
  if (desc.custody != null && typeof desc.custody !== "string") {
    errors.push("custody_must_be_string");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, descriptor: desc };
}

/**
 * Construct a TraceDescriptor directly from a COP Event without duplicating payload.
 *
 * @param {object} event - COP Event envelope.
 * @returns {object} TraceDescriptor
 */
export function traceDescriptorFromCopEvent(event) {
  const traceRef = traceRefFromCopEvent(event);
  const occurredAt = event.time?.occurred_at || null;
  const observedAt = event.time?.observed_at || event.time?.recorded_at || new Date().toISOString();
  const createdAt = event.time?.recorded_at || null;

  return createTraceDescriptor({
    trace_ref: traceRef,
    kind: event.event_type || "procedural_event",
    origin: event.origin_ref || event.actor_ref || "cop:procedural",
    observed_at: observedAt,
    occurred_at: occurredAt,
    created_at: createdAt,
    integrity: event.payload_hash || null,
    visibility: event.visibility || "restricted",
    custody: "cop:store",
    meta: {
      topic_id: event.topic?.id,
      topic_seq: event.topic?.seq,
      epistemic_status: event.epistemic_status,
    },
  });
}

// ----------------------------------------------------------------------
// 3. Assertion
// ----------------------------------------------------------------------

/**
 * Create a proposition known, held, or considered by the Corpus.
 *
 * @param {object} options
 * @param {string} [options.assertion_id] - Stable identifier (generated if omitted).
 * @param {number} [options.revision] - Monotonic revision number (default: 1).
 * @param {unknown} options.claim - The proposition statement or structured object.
 * @param {string} [options.epistemic_status] - Epistemic classification (default: 'asserted').
 * @param {string|null} [options.subject_ref] - Target entity reference.
 * @param {string} options.asserted_by - Identifier of the asserting agent/twin/rule.
 * @param {string} [options.asserted_at] - ISO date-time of assertion.
 * @param {string|null} [options.supersedes_id] - Prior revision identifier if revised.
 * @param {object} [options.meta] - Auxiliary metadata.
 * @returns {object}
 */
export function createAssertion({
  assertion_id = `ast:${randomUUID()}`,
  revision = 1,
  claim,
  epistemic_status = "declared",
  subject_ref = null,
  asserted_by,
  asserted_at = new Date().toISOString(),
  supersedes_id = null,
  meta = {},
} = {}) {
  requireNonEmptyString(assertion_id, "assertion_id");
  if (!Number.isInteger(revision) || revision < 1) {
    throw new TypeError("revision must be an integer >= 1");
  }
  if (claim === undefined) {
    throw new TypeError("claim is required");
  }
  if (!EPISTEMIC_STATUSES.includes(epistemic_status)) {
    throw new TypeError(`epistemic_status must be one of: ${EPISTEMIC_STATUSES.join(", ")}`);
  }
  requireNonEmptyString(asserted_by, "asserted_by");
  requireIsoDateTime(asserted_at, "asserted_at");
  if (subject_ref != null && typeof subject_ref !== "string") {
    throw new TypeError("subject_ref must be a string or null");
  }
  if (supersedes_id != null && typeof supersedes_id !== "string") {
    throw new TypeError("supersedes_id must be a string or null");
  }

  return {
    schema: COP_ASSERTION_SCHEMA,
    assertion_id,
    revision,
    claim: structuredClone(claim),
    epistemic_status,
    subject_ref: subject_ref ?? null,
    asserted_by,
    asserted_at,
    supersedes_id: supersedes_id ?? null,
    meta: meta && typeof meta === "object" ? structuredClone(meta) : {},
  };
}

/**
 * Revise an existing Assertion, preserving the stable assertion_id and tracking supersession.
 *
 * @param {object} priorAssertion - Existing Assertion object.
 * @param {object} options
 * @param {unknown} [options.claim] - Updated claim (defaults to prior claim).
 * @param {string} [options.epistemic_status] - Updated epistemic status.
 * @param {string} options.asserted_by - Asserting agent of this revision.
 * @param {string} [options.asserted_at] - ISO timestamp.
 * @param {object} [options.meta] - Auxiliary metadata.
 * @returns {object} New revised Assertion
 */
export function reviseAssertion(
  priorAssertion,
  { claim, epistemic_status, asserted_by, asserted_at = new Date().toISOString(), meta = {} }
) {
  const valid = validateAssertion(priorAssertion);
  if (!valid.ok) {
    throw new TypeError(`Invalid priorAssertion: ${valid.errors.join(", ")}`);
  }
  const prior = valid.assertion;
  const newRevision = prior.revision + 1;
  const supersedesId = `${prior.assertion_id}@r${prior.revision}`;

  return createAssertion({
    assertion_id: prior.assertion_id,
    revision: newRevision,
    claim: claim !== undefined ? claim : prior.claim,
    epistemic_status: epistemic_status || prior.epistemic_status,
    subject_ref: prior.subject_ref,
    asserted_by,
    asserted_at,
    supersedes_id: supersedesId,
    meta: {
      ...prior.meta,
      ...meta,
      prior_superseded_at: asserted_at,
    },
  });
}

/**
 * Validate an Assertion.
 *
 * @param {unknown} value
 * @returns {{ ok: true, assertion: object } | { ok: false, errors: string[] }}
 */
export function validateAssertion(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["assertion_must_be_object"] };
  }
  const ast = /** @type {Record<string, any>} */ (value);
  if (ast.schema !== COP_ASSERTION_SCHEMA) {
    errors.push(`schema_must_be_${COP_ASSERTION_SCHEMA}`);
  }
  if (
    !ast.assertion_id ||
    typeof ast.assertion_id !== "string" ||
    ast.assertion_id.trim().length === 0
  ) {
    errors.push("assertion_id_required");
  }
  if (!Number.isInteger(ast.revision) || ast.revision < 1) {
    errors.push("revision_must_be_positive_integer");
  }
  if (ast.claim === undefined) {
    errors.push("claim_required");
  }
  if (!EPISTEMIC_STATUSES.includes(ast.epistemic_status)) {
    errors.push("epistemic_status_invalid");
  }
  if (!ast.asserted_by || typeof ast.asserted_by !== "string") {
    errors.push("asserted_by_required");
  }
  if (!ast.asserted_at || Number.isNaN(Date.parse(ast.asserted_at))) {
    errors.push("asserted_at_invalid");
  }
  if (ast.subject_ref != null && typeof ast.subject_ref !== "string") {
    errors.push("subject_ref_must_be_string");
  }
  if (ast.supersedes_id != null && typeof ast.supersedes_id !== "string") {
    errors.push("supersedes_id_must_be_string");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, assertion: ast };
}

// ----------------------------------------------------------------------
// 4. EvidenceRelation
// ----------------------------------------------------------------------

/**
 * Link a TraceRef to an Assertion via a typed relation (supports, contradicts, contextualizes).
 *
 * @param {object} options
 * @param {string} [options.relation_id] - Unique identifier (generated if omitted).
 * @param {'supports'|'contradicts'|'contextualizes'} options.relation_type - Epistemic link type.
 * @param {object} options.trace_ref - The supporting, contradicting, or contextualizing trace.
 * @param {string} options.assertion_id - Target assertion identifier.
 * @param {'conclusive'|'strong'|'plausible'|'weak'|number|null} [options.strength] - Optional relation strength.
 * @param {unknown} [options.justification] - Rationale or proof explanation.
 * @param {string} options.asserted_by - Entity attributing this link.
 * @param {string} [options.recorded_at] - ISO date-time of relation creation.
 * @param {object} [options.meta] - Auxiliary metadata.
 * @returns {object}
 */
export function createEvidenceRelation({
  relation_id = `evr:${randomUUID()}`,
  relation_type,
  trace_ref,
  assertion_id,
  strength = null,
  justification = null,
  asserted_by,
  recorded_at = new Date().toISOString(),
  meta = {},
} = {}) {
  requireNonEmptyString(relation_id, "relation_id");
  if (!EVIDENCE_RELATION_TYPES.includes(relation_type)) {
    throw new TypeError(`relation_type must be one of: ${EVIDENCE_RELATION_TYPES.join(", ")}`);
  }
  const refVal = validateTraceRef(trace_ref);
  if (!refVal.ok) {
    throw new TypeError(`Invalid trace_ref: ${refVal.errors.join(", ")}`);
  }
  requireNonEmptyString(assertion_id, "assertion_id");
  requireNonEmptyString(asserted_by, "asserted_by");
  requireIsoDateTime(recorded_at, "recorded_at");

  if (strength != null) {
    if (typeof strength === "number") {
      if (strength < 0 || strength > 1) {
        throw new TypeError("numeric strength must be between 0 and 1");
      }
    } else if (typeof strength === "string") {
      const allowed = ["conclusive", "strong", "plausible", "weak"];
      if (!allowed.includes(strength)) {
        throw new TypeError(`string strength must be one of: ${allowed.join(", ")}`);
      }
    } else {
      throw new TypeError("strength must be a string, a number 0..1, or null");
    }
  }

  return {
    schema: COP_EVIDENCE_RELATION_SCHEMA,
    relation_id,
    relation_type,
    trace_ref: refVal.trace_ref,
    assertion_id,
    strength: strength ?? null,
    justification: justification !== undefined ? structuredClone(justification) : null,
    asserted_by,
    recorded_at,
    meta: meta && typeof meta === "object" ? structuredClone(meta) : {},
  };
}

/**
 * Validate an EvidenceRelation.
 *
 * @param {unknown} value
 * @returns {{ ok: true, relation: object } | { ok: false, errors: string[] }}
 */
export function validateEvidenceRelation(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["evidence_relation_must_be_object"] };
  }
  const rel = /** @type {Record<string, any>} */ (value);
  if (rel.schema !== COP_EVIDENCE_RELATION_SCHEMA) {
    errors.push(`schema_must_be_${COP_EVIDENCE_RELATION_SCHEMA}`);
  }
  if (!rel.relation_id || typeof rel.relation_id !== "string") {
    errors.push("relation_id_required");
  }
  if (!EVIDENCE_RELATION_TYPES.includes(rel.relation_type)) {
    errors.push("relation_type_invalid");
  }
  const refVal = validateTraceRef(rel.trace_ref);
  if (!refVal.ok) {
    errors.push(...refVal.errors.map((e) => `trace_ref.${e}`));
  }
  if (!rel.assertion_id || typeof rel.assertion_id !== "string") {
    errors.push("assertion_id_required");
  }
  if (!rel.asserted_by || typeof rel.asserted_by !== "string") {
    errors.push("asserted_by_required");
  }
  if (!rel.recorded_at || Number.isNaN(Date.parse(rel.recorded_at))) {
    errors.push("recorded_at_invalid");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, relation: rel };
}

// ----------------------------------------------------------------------
// 5. External Trace Registration & Ingestion
// ----------------------------------------------------------------------

/**
 * Record the observation or registration of an external trace as a COP Event.
 * Preserves causal provenance: origin_ref points to the external trace identity
 * and explicitly asserts that COP witnessed/registered the trace rather than
 * originating it.
 *
 * @param {object} options
 * @param {object} options.trace_ref - External TraceRef.
 * @param {object} options.trace_descriptor - Metadata descriptor for the external trace.
 * @param {string} options.observer_ref - Attributable observer/agent registering the trace.
 * @param {string} options.topic_id - Event topic ID.
 * @param {string|null} [options.mandate_ref] - Mandate governing the observation.
 * @param {string|null} [options.principal_ref] - Principal governing authority.
 * @param {string|null} [options.logical_agent_ref] - Logical agent identity.
 * @returns {object} Canonical COP Event envelope
 */
export function createTraceObservationEvent({
  trace_ref,
  trace_descriptor,
  observer_ref,
  topic_id,
  mandate_ref = null,
  principal_ref = null,
  logical_agent_ref = null,
}) {
  const refVal = validateTraceRef(trace_ref);
  if (!refVal.ok) throw new TypeError(`Invalid trace_ref: ${refVal.errors.join(", ")}`);
  const descVal = validateTraceDescriptor(trace_descriptor);
  if (!descVal.ok) throw new TypeError(`Invalid trace_descriptor: ${descVal.errors.join(", ")}`);
  requireNonEmptyString(observer_ref, "observer_ref");
  requireNonEmptyString(topic_id, "topic_id");

  return createCopEventEnvelope({
    event_type: "TraceObservation",
    topic_id,
    epistemic_status: "observed",
    // Preserves external provenance: origin is the external trace itself
    origin_ref: trace_ref.trace_id,
    actor_ref: observer_ref,
    subject_ref: logical_agent_ref || observer_ref,
    mandate_ref,
    visibility: trace_descriptor.visibility || "restricted",
    payload: {
      kind: "TraceObservation",
      trace_ref: refVal.trace_ref,
      descriptor: descVal.descriptor,
      observer_ref,
      principal_ref,
      logical_agent_ref,
      // Explicit invariant: COP did not originate the external bytes
      cop_originated: false,
    },
    idempotency_key: `trace-obs:${trace_ref.trace_id}:${observer_ref}`,
  });
}

// ----------------------------------------------------------------------
// 6. EvidenceGraph (In-memory evidence index preserving contradictions)
// ----------------------------------------------------------------------

/**
 * In-memory index supporting query and non-destructive coexistence of contradictory evidence.
 */
export class EvidenceGraph {
  constructor() {
    /** @type {Map<string, object>} */
    this.relations = new Map();
    /** @type {Map<string, Set<string>>} assertionId -> Set of relationIds */
    this.byAssertion = new Map();
    /** @type {Map<string, Set<string>>} traceId -> Set of relationIds */
    this.byTrace = new Map();
  }

  /**
   * Add an EvidenceRelation to the graph.
   *
   * @param {object} relation - An EvidenceRelation object.
   * @returns {object} The stored relation.
   */
  addRelation(relation) {
    const val = validateEvidenceRelation(relation);
    if (!val.ok) throw new TypeError(`Cannot index invalid relation: ${val.errors.join(", ")}`);
    const rel = val.relation;

    this.relations.set(rel.relation_id, rel);

    if (!this.byAssertion.has(rel.assertion_id)) {
      this.byAssertion.set(rel.assertion_id, new Set());
    }
    this.byAssertion.get(rel.assertion_id)?.add(rel.relation_id);

    const traceId = rel.trace_ref.trace_id;
    if (!this.byTrace.has(traceId)) {
      this.byTrace.set(traceId, new Set());
    }
    this.byTrace.get(traceId)?.add(rel.relation_id);

    return rel;
  }

  /**
   * Retrieve all evidence relations linked to an assertion, grouped by relation_type.
   * Contradictory relations co-exist without overwriting one another.
   *
   * @param {string} assertionId
   * @returns {{ supports: object[], contradicts: object[], contextualizes: object[], all: object[] }}
   */
  getRelationsForAssertion(assertionId) {
    const relationIds = this.byAssertion.get(assertionId);
    if (!relationIds) {
      return { supports: [], contradicts: [], contextualizes: [], all: [] };
    }
    const all = Array.from(relationIds)
      .map((id) => this.relations.get(id))
      .filter(Boolean);
    return {
      supports: all.filter((r) => r.relation_type === "supports"),
      contradicts: all.filter((r) => r.relation_type === "contradicts"),
      contextualizes: all.filter((r) => r.relation_type === "contextualizes"),
      all,
    };
  }

  /**
   * Retrieve all relations in which a given trace participates.
   *
   * @param {string} traceId
   * @returns {object[]}
   */
  getRelationsForTrace(traceId) {
    const relationIds = this.byTrace.get(traceId);
    if (!relationIds) return [];
    return Array.from(relationIds)
      .map((id) => this.relations.get(id))
      .filter(Boolean);
  }
}

// ----------------------------------------------------------------------
// 7. Consolidation Provenance Helpers
// ----------------------------------------------------------------------

/**
 * Extract TraceRefs from a local trace consolidation receipt,
 * preserving provenance without authority laundering.
 *
 * @param {object} receipt - A cop.local-trace-consolidation.receipt.v1
 * @returns {object[]} Array of TraceRef
 */
export function extractConsolidationTraceRefs(receipt) {
  if (!receipt || receipt.schema !== "cop.local-trace-consolidation.receipt.v1") {
    throw new TypeError("receipt must be a valid cop.local-trace-consolidation.receipt.v1");
  }
  const storeRef = receipt.local_trace.store_ref;
  const first = receipt.local_trace.first_event_ref;
  const last = receipt.local_trace.last_event_ref;

  const refs = [
    createTraceRef({
      trace_id: `cop:consolidation:${receipt.consolidation_id}`,
      target_type: "cop_artifact",
      integrity: receipt.local_trace.integrity_hash,
      locator: storeRef,
      resolution_hints: {
        event_count: receipt.local_trace.event_count,
        first_event_id: first.event_id,
        last_event_id: last.event_id,
        retained_until: receipt.local_trace.retained_until,
      },
    }),
  ];

  if (Array.isArray(receipt.artifact_refs)) {
    for (const artRef of receipt.artifact_refs) {
      if (typeof artRef === "string") {
        refs.push(
          createTraceRef({
            trace_id: artRef.startsWith("cop:artifact:") ? artRef : `cop:artifact:${artRef}`,
            target_type: "cop_artifact",
          })
        );
      }
    }
  }

  return refs;
}

// ----------------------------------------------------------------------
// 8. Schema Path & Document Loaders
// ----------------------------------------------------------------------

export function getTraceRefSchemaPath() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../schemas/cop.trace-ref.v1.json"
  );
}

export function loadTraceRefSchemaDocument() {
  return JSON.parse(fs.readFileSync(getTraceRefSchemaPath(), "utf8"));
}

export function getTraceDescriptorSchemaPath() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../schemas/cop.trace-descriptor.v1.json"
  );
}

export function loadTraceDescriptorSchemaDocument() {
  return JSON.parse(fs.readFileSync(getTraceDescriptorSchemaPath(), "utf8"));
}

export function getAssertionSchemaPath() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../schemas/cop.assertion.v1.json"
  );
}

export function loadAssertionSchemaDocument() {
  return JSON.parse(fs.readFileSync(getAssertionSchemaPath(), "utf8"));
}

export function getEvidenceRelationSchemaPath() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../schemas/cop.evidence-relation.v1.json"
  );
}

export function loadEvidenceRelationSchemaDocument() {
  return JSON.parse(fs.readFileSync(getEvidenceRelationSchemaPath(), "utf8"));
}
