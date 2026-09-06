/**
 * Reactive Corpus Architecture & Temporal Projection (COP 2.x — Issues #61, #64).
 *
 * Implements:
 * 1. Strict time semantics (valid-time occurred_at vs trace_created_at vs observed_or_ingested_at)
 * 2. Bounded ReactiveDependencyGraph (Trace -> Assertion -> Continuation -> Projection)
 * 3. TemporalProjector producing reconstructible derived Timeline Views
 * 4. ReactiveCorpus coordinator managing trace ingestion, non-destructive contradiction,
 *    and targeted invalidation without global recomputation.
 */

import { createHash } from "node:crypto";
import {
  EvidenceGraph,
  createTraceObservationEvent,
  validateAssertion,
  validateEvidenceRelation,
  validateTraceDescriptor,
  validateTraceRef,
} from "./trace.js";

export const COP_TEMPORAL_PROJECTION_SCHEMA = "cop.temporal-projection/v1";

export const TEMPORAL_PRECISIONS = Object.freeze([
  "exact",
  "day",
  "month",
  "year",
  "interval",
  "approximate",
  "unknown",
]);

export const DEPENDENT_TYPES = Object.freeze(["assertion", "continuation", "projection", "index"]);

export const SOURCE_TYPES = Object.freeze(["trace", "assertion", "subject", "topic"]);

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

// ----------------------------------------------------------------------
// 1. Time Semantics & Claim Parsing
// ----------------------------------------------------------------------

const YEAR_REGEX = /^(\d{4})$/;
const MONTH_REGEX = /^(\d{4})-(\d{2})$/;
const DAY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse and normalize a temporal claim into structured valid-time representation.
 * Preserves imprecise time without collapsing distinct temporal boundaries.
 *
 * @param {unknown} input - ISO string, year/month/day string, interval object, or approximate descriptor.
 * @returns {{ value: string, precision: string, sort_key_ms: number, interval_end_ms: number | null }}
 */
export function parseTemporalClaim(input) {
  if (input == null) {
    return {
      value: "unknown",
      precision: "unknown",
      sort_key_ms: 0,
      interval_end_ms: null,
    };
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return {
        value: "unknown",
        precision: "unknown",
        sort_key_ms: 0,
        interval_end_ms: null,
      };
    }

    // Year precision
    const yearMatch = trimmed.match(YEAR_REGEX);
    if (yearMatch) {
      const yr = Number.parseInt(yearMatch[1], 10);
      const startMs = Date.UTC(yr, 0, 1, 0, 0, 0, 0);
      const endMs = Date.UTC(yr, 11, 31, 23, 59, 59, 999);
      return {
        value: trimmed,
        precision: "year",
        sort_key_ms: startMs,
        interval_end_ms: endMs,
      };
    }

    // Month precision
    const monthMatch = trimmed.match(MONTH_REGEX);
    if (monthMatch) {
      const yr = Number.parseInt(monthMatch[1], 10);
      const mo = Number.parseInt(monthMatch[2], 10) - 1;
      const startMs = Date.UTC(yr, mo, 1, 0, 0, 0, 0);
      // Day 0 of next month is last day of current month
      const endMs = Date.UTC(yr, mo + 1, 0, 23, 59, 59, 999);
      return {
        value: trimmed,
        precision: "month",
        sort_key_ms: startMs,
        interval_end_ms: endMs,
      };
    }

    // Day precision
    const dayMatch = trimmed.match(DAY_REGEX);
    if (dayMatch) {
      const yr = Number.parseInt(dayMatch[1], 10);
      const mo = Number.parseInt(dayMatch[2], 10) - 1;
      const day = Number.parseInt(dayMatch[3], 10);
      const startMs = Date.UTC(yr, mo, day, 0, 0, 0, 0);
      const endMs = Date.UTC(yr, mo, day, 23, 59, 59, 999);
      return {
        value: trimmed,
        precision: "day",
        sort_key_ms: startMs,
        interval_end_ms: endMs,
      };
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return {
        value: new Date(parsed).toISOString(),
        precision: "exact",
        sort_key_ms: parsed,
        interval_end_ms: null,
      };
    }

    return {
      value: trimmed,
      precision: "approximate",
      sort_key_ms: 0,
      interval_end_ms: null,
    };
  }

  if (typeof input === "object") {
    const obj = /** @type {Record<string, any>} */ (input);
    if (obj.start && obj.end) {
      const startParsed = parseTemporalClaim(obj.start);
      const endParsed = parseTemporalClaim(obj.end);
      return {
        value: `${startParsed.value}..${endParsed.value}`,
        precision: "interval",
        sort_key_ms: startParsed.sort_key_ms,
        interval_end_ms: endParsed.interval_end_ms || endParsed.sort_key_ms,
      };
    }

    if (obj.value) {
      const sub = parseTemporalClaim(obj.value);
      const precision =
        obj.precision && TEMPORAL_PRECISIONS.includes(obj.precision)
          ? obj.precision
          : obj.approximate
            ? "approximate"
            : sub.precision;
      return {
        value: String(obj.value),
        precision,
        sort_key_ms: typeof obj.sort_key_ms === "number" ? obj.sort_key_ms : sub.sort_key_ms,
        interval_end_ms:
          typeof obj.interval_end_ms === "number" ? obj.interval_end_ms : sub.interval_end_ms,
      };
    }
  }

  return {
    value: "unknown",
    precision: "unknown",
    sort_key_ms: 0,
    interval_end_ms: null,
  };
}

// ----------------------------------------------------------------------
// 2. ReactiveDependencyGraph (Bounded Invalidation)
// ----------------------------------------------------------------------

/**
 * Tracks directional dependencies between Traces, Assertions, Continuations, and Projections.
 * Enables fine-grained invalidation without global corpus recomputation.
 */
export class ReactiveDependencyGraph {
  constructor() {
    /** @type {Map<string, Map<string, { dependent_type: string, dependent_id: string, meta: object }>>} */
    this.dependentsBySource = new Map();
    /** @type {Map<string, Set<string>>} dependentId -> Set of sourceKeys */
    this.sourcesByDependent = new Map();
  }

  /**
   * Register a dependency: dependent relies upon source.
   *
   * @param {object} options
   * @param {'assertion'|'continuation'|'projection'|'index'} options.dependent_type
   * @param {string} options.dependent_id
   * @param {'trace'|'assertion'|'subject'|'topic'} options.source_type
   * @param {string} options.source_id
   * @param {object} [options.meta]
   */
  registerDependency({ dependent_type, dependent_id, source_type, source_id, meta = {} }) {
    if (!DEPENDENT_TYPES.includes(dependent_type)) {
      throw new TypeError(`dependent_type must be one of: ${DEPENDENT_TYPES.join(", ")}`);
    }
    requireNonEmptyString(dependent_id, "dependent_id");
    if (!SOURCE_TYPES.includes(source_type)) {
      throw new TypeError(`source_type must be one of: ${SOURCE_TYPES.join(", ")}`);
    }
    requireNonEmptyString(source_id, "source_id");

    const sourceKey = `${source_type}:${source_id}`;

    if (!this.dependentsBySource.has(sourceKey)) {
      this.dependentsBySource.set(sourceKey, new Map());
    }
    this.dependentsBySource.get(sourceKey)?.set(dependent_id, {
      dependent_type,
      dependent_id,
      meta,
    });

    if (!this.sourcesByDependent.has(dependent_id)) {
      this.sourcesByDependent.set(dependent_id, new Set());
    }
    this.sourcesByDependent.get(dependent_id)?.add(sourceKey);
  }

  /**
   * Remove all dependencies for a given dependent (e.g. before cache rebuild or discard).
   *
   * @param {string} dependent_id
   */
  unregisterDependent(dependent_id) {
    const sourceKeys = this.sourcesByDependent.get(dependent_id);
    if (!sourceKeys) return;

    for (const sourceKey of sourceKeys) {
      this.dependentsBySource.get(sourceKey)?.delete(dependent_id);
      if (this.dependentsBySource.get(sourceKey)?.size === 0) {
        this.dependentsBySource.delete(sourceKey);
      }
    }
    this.sourcesByDependent.delete(dependent_id);
  }

  /**
   * Traverse the dependency graph to find all affected entities triggered by a change in source.
   * Performs bounded transitive closure (e.g. trace -> assertion -> projection & continuation).
   *
   * @param {string} sourceType - "trace", "assertion", "subject", or "topic"
   * @param {string} sourceId - The source identifier
   * @returns {{ assertions: string[], continuations: string[], projections: string[], indexes: string[] }}
   */
  getAffectedEntities(sourceType, sourceId) {
    const affectedAssertions = new Set();
    const affectedContinuations = new Set();
    const affectedProjections = new Set();
    const affectedIndexes = new Set();

    const queue = [`${sourceType}:${sourceId}`];
    const visited = new Set();

    while (queue.length > 0) {
      const currentKey = queue.shift();
      if (!currentKey || visited.has(currentKey)) continue;
      visited.add(currentKey);

      const dependents = this.dependentsBySource.get(currentKey);
      if (!dependents) continue;

      for (const [depId, entry] of dependents.entries()) {
        switch (entry.dependent_type) {
          case "assertion":
            if (!affectedAssertions.has(depId)) {
              affectedAssertions.add(depId);
              // Transitive propagation: dependents of this assertion are also affected!
              queue.push(`assertion:${depId}`);
            }
            break;
          case "continuation":
            affectedContinuations.add(depId);
            break;
          case "projection":
            affectedProjections.add(depId);
            break;
          case "index":
            affectedIndexes.add(depId);
            break;
        }
      }
    }

    return {
      assertions: Array.from(affectedAssertions),
      continuations: Array.from(affectedContinuations),
      projections: Array.from(affectedProjections),
      indexes: Array.from(affectedIndexes),
    };
  }

  /**
   * Helper: get assertions affected by a trace reference or ID.
   *
   * @param {string|object} traceRefOrId
   * @returns {string[]}
   */
  getAffectedAssertions(traceRefOrId) {
    const traceId = typeof traceRefOrId === "object" ? traceRefOrId.trace_id : traceRefOrId;
    return this.getAffectedEntities("trace", traceId).assertions;
  }

  /**
   * Helper: get continuations affected by a trace reference or ID.
   *
   * @param {string|object} traceRefOrId
   * @returns {string[]}
   */
  getAffectedContinuations(traceRefOrId) {
    const traceId = typeof traceRefOrId === "object" ? traceRefOrId.trace_id : traceRefOrId;
    return this.getAffectedEntities("trace", traceId).continuations;
  }

  /**
   * Helper: get projections affected by a trace reference or ID.
   *
   * @param {string|object} traceRefOrId
   * @returns {string[]}
   */
  getAffectedProjections(traceRefOrId) {
    const traceId = typeof traceRefOrId === "object" ? traceRefOrId.trace_id : traceRefOrId;
    return this.getAffectedEntities("trace", traceId).projections;
  }
}

// ----------------------------------------------------------------------
// 3. TemporalProjector (Derives Timeline Views from Authoritative Sources)
// ----------------------------------------------------------------------

/**
 * Projector producing derived, reconstructible Temporal Projections and Timeline Views.
 * Projections are accelerators with explicit metadata, never authoritative sources.
 */
export class TemporalProjector {
  /**
   * @param {object} [options]
   * @param {string} [options.projector_id] - Unique projector identifier.
   * @param {string} [options.projector_version] - Semantic version of this projector.
   * @param {object} [options.defaultPolicy] - Default epistemic/filter policy.
   */
  constructor({
    projector_id = "temporal-projector:core",
    projector_version = "1.0.0",
    defaultPolicy = {},
  } = {}) {
    this.projector_id = projector_id;
    this.projector_version = projector_version;
    this.defaultPolicy = {
      include_contradicted: true,
      mark_disputed_on_contradiction: true,
      ...defaultPolicy,
    };
  }

  /**
   * Build a TemporalProjection from authoritative Traces and Assertions.
   *
   * @param {object} options
   * @param {string} options.projection_id - Unique identifier for the projection.
   * @param {string|null} [options.subject_ref] - Subject/entity filter.
   * @param {string|null} [options.topic_ref] - Topic filter.
   * @param {object[]} [options.assertions] - Authoritative assertions to project.
   * @param {object[]} [options.traces] - Authoritative traces with descriptors.
   * @param {EvidenceGraph|null} [options.evidenceGraph] - Epistemic graph holding relations.
   * @param {object} [options.policy] - Epistemic and filtering policy.
   * @returns {object} Canonical TemporalProjection conforming to cop.temporal-projection/v1
   */
  buildProjection({
    projection_id,
    subject_ref = null,
    topic_ref = null,
    assertions = [],
    traces = [],
    evidenceGraph = null,
    policy = {},
  }) {
    requireNonEmptyString(projection_id, "projection_id");
    const mergedPolicy = { ...this.defaultPolicy, ...policy };

    const timelineItems = [];
    const sourceRefs = new Set();

    // 1. Process Assertions
    for (const ast of assertions) {
      if (subject_ref && ast.subject_ref && ast.subject_ref !== subject_ref) {
        continue;
      }
      sourceRefs.add(ast.assertion_id);

      // Extract valid-time claim: check claim.occurred_at, meta.occurred_at, or fall back to asserted_at
      const rawOccurred = ast.claim?.occurred_at || ast.meta?.occurred_at || ast.asserted_at;
      const occurred = parseTemporalClaim(rawOccurred);

      // Epistemic summary from EvidenceGraph
      let epistemicSummary = null;
      let epistemicStatus = ast.epistemic_status;
      const sourceTraceRefs = [];

      if (evidenceGraph) {
        const relations = evidenceGraph.getRelationsForAssertion(ast.assertion_id);
        const summary =
          typeof evidenceGraph.getAssertionEpistemicSummary === "function"
            ? evidenceGraph.getAssertionEpistemicSummary(ast.assertion_id)
            : {
                supports_count: relations.supports?.length || 0,
                contradicts_count: relations.contradicts?.length || 0,
                has_contradiction: (relations.contradicts?.length || 0) > 0,
              };
        epistemicSummary = {
          supports_count: summary.supports_count,
          contradicts_count: summary.contradicts_count,
          has_contradiction: summary.has_contradiction,
        };

        for (const rel of [
          ...relations.supports,
          ...relations.contradicts,
          ...relations.contextualizes,
        ]) {
          sourceTraceRefs.push(rel.trace_ref);
          sourceRefs.add(rel.trace_ref.trace_id);
        }

        if (
          mergedPolicy.mark_disputed_on_contradiction &&
          summary.has_contradiction &&
          summary.contradicts_count > 0
        ) {
          epistemicStatus = "disputed";
        }
      }

      // Determine observation/knowledge acquisition time vs creation time
      let observedAt = ast.asserted_at;
      let traceCreatedAt = null;

      if (sourceTraceRefs.length > 0) {
        // Earliest trace observation timestamp
        for (const tr of sourceTraceRefs) {
          if (tr.resolution_hints?.observed_at) {
            observedAt = tr.resolution_hints.observed_at;
          }
          if (tr.resolution_hints?.created_at) {
            traceCreatedAt = tr.resolution_hints.created_at;
          }
        }
      }

      timelineItems.push({
        item_id: ast.assertion_id,
        subject_ref: ast.subject_ref || subject_ref,
        occurred_at: occurred,
        trace_created_at: traceCreatedAt,
        observed_or_ingested_at: observedAt,
        source_trace_refs: sourceTraceRefs,
        assertion_ref: ast.assertion_id,
        epistemic_status: epistemicStatus,
        epistemic_summary: epistemicSummary,
        claim: ast.claim,
        description: typeof ast.claim === "string" ? ast.claim : ast.meta?.description,
      });
    }

    // 2. Process Standalone Traces (that might not be wrapped in an assertion yet)
    for (const traceEntry of traces) {
      const traceRef = traceEntry.trace_ref || traceEntry;
      const desc = traceEntry.descriptor || traceEntry;
      if (!traceRef || !traceRef.trace_id) continue;

      // Skip if this trace is already represented by an assertion's sourceTraceRefs
      const alreadyPresent = timelineItems.some((item) =>
        item.source_trace_refs?.some((r) => r.trace_id === traceRef.trace_id)
      );
      if (alreadyPresent) continue;

      sourceRefs.add(traceRef.trace_id);
      const rawOccurred = desc.occurred_at || desc.created_at || desc.observed_at;
      const occurred = parseTemporalClaim(rawOccurred);

      timelineItems.push({
        item_id: traceRef.trace_id,
        subject_ref: desc.meta?.subject_ref || subject_ref,
        occurred_at: occurred,
        trace_created_at: desc.created_at || null,
        observed_or_ingested_at: desc.observed_at || new Date().toISOString(),
        source_trace_refs: [traceRef],
        assertion_ref: null,
        epistemic_status: desc.meta?.epistemic_status || "observed",
        epistemic_summary: null,
        claim: desc.meta?.claim || { kind: desc.kind, origin: desc.origin },
        description: desc.meta?.description || `Trace ${desc.kind} from ${desc.origin}`,
      });
    }

    // 3. Sort timeline chronologically by valid-time sort_key_ms
    timelineItems.sort((a, b) => {
      const diff = a.occurred_at.sort_key_ms - b.occurred_at.sort_key_ms;
      if (diff !== 0) return diff;
      // Secondary sort by observation timestamp if occurrences coincide
      return Date.parse(a.observed_or_ingested_at) - Date.parse(b.observed_or_ingested_at);
    });

    // 4. Compute source commitments
    const sortedSources = Array.from(sourceRefs).sort();
    const digestHasher = createHash("sha256");
    for (const ref of sortedSources) {
      digestHasher.update(ref);
    }
    const digest = `sha256:${digestHasher.digest("hex")}`;

    return {
      schema: COP_TEMPORAL_PROJECTION_SCHEMA,
      projection_id,
      subject_ref,
      topic_ref,
      projector_id: this.projector_id,
      projector_version: this.projector_version,
      policy: mergedPolicy,
      built_at: new Date().toISOString(),
      // INVARIANT: Projections are derived accelerators, never authoritative sources.
      is_authoritative: false,
      is_derived: true,
      stale: false,
      invalidation_cause: null,
      source_commitments: {
        assertion_count: assertions.length,
        trace_count: traces.length,
        source_refs: sortedSources,
        digest,
      },
      timeline: timelineItems,
    };
  }

  /**
   * Check if a projection is stale against this projector's version or explicit invalidation.
   *
   * @param {object} projection
   * @returns {{ is_stale: boolean, reason: string | null }}
   */
  checkStaleness(projection) {
    if (!projection) return { is_stale: true, reason: "projection_missing" };
    if (projection.stale) {
      return {
        is_stale: true,
        reason: projection.invalidation_cause?.reason || "marked_stale",
      };
    }
    if (projection.projector_version !== this.projector_version) {
      return {
        is_stale: true,
        reason: `projector_version_mismatch: built with ${projection.projector_version}, current is ${this.projector_version}`,
      };
    }
    return { is_stale: false, reason: null };
  }
}

// ----------------------------------------------------------------------
// 4. ReactiveCorpus (High-level Coordinator)
// ----------------------------------------------------------------------

/**
 * Coordinator uniting the append-only store, evidence graph, dependency graph,
 * and temporal projectors into a reactive knowledge layer.
 */
export class ReactiveCorpus {
  /**
   * @param {object} [options]
   * @param {object|null} [options.store] - Append-only COP store.
   * @param {EvidenceGraph} [options.evidenceGraph] - Epistemic graph.
   * @param {ReactiveDependencyGraph} [options.dependencyGraph] - Dependency tracker.
   * @param {TemporalProjector} [options.projector] - Default temporal projector.
   */
  constructor({
    store = null,
    evidenceGraph = new EvidenceGraph(),
    dependencyGraph = new ReactiveDependencyGraph(),
    projector = new TemporalProjector(),
  } = {}) {
    this.store = store;
    this.evidenceGraph = evidenceGraph;
    this.dependencyGraph = dependencyGraph;
    this.projector = projector;

    /** @type {Map<string, object>} assertion_id -> Assertion */
    this.assertions = new Map();
    /** @type {Map<string, { trace_ref: object, descriptor: object }>} trace_id -> TraceData */
    this.traces = new Map();
    /** @type {Map<string, object>} projection_id -> TemporalProjection */
    this.projections = new Map();
    /** @type {Map<string, { subject_ref?: string, topic_ref?: string, policy?: object }>} */
    this.projectionConfigs = new Map();
  }

  /**
   * Ingest an external or procedural Trace into the Reactive Corpus.
   * Automatically derives dependencies and invalidates affected projections.
   *
   * @param {object} options
   * @param {object} options.trace_ref - Canonical TraceRef.
   * @param {object} options.trace_descriptor - Metadata TraceDescriptor.
   * @param {string} options.observer_ref - Attributable observer identifier.
   * @param {string} options.topic_id - Event topic ID.
   * @param {string|null} [options.subject_ref] - Subject/entity reference.
   * @param {string|null} [options.mandate_ref] - Mandate governing observation.
   * @param {string|null} [options.principal_ref] - Principal governing authority.
   * @param {string|null} [options.logical_agent_ref] - Logical agent identity.
   * @returns {{ event: object, affected: { assertions: string[], continuations: string[], projections: string[] } }}
   */
  ingestTrace({
    trace_ref,
    trace_descriptor,
    observer_ref,
    topic_id,
    subject_ref = null,
    mandate_ref = null,
    principal_ref = null,
    logical_agent_ref = null,
  }) {
    const refVal = validateTraceRef(trace_ref);
    if (!refVal.ok) throw new TypeError(`Invalid trace_ref: ${refVal.errors.join(", ")}`);
    const descVal = validateTraceDescriptor(trace_descriptor);
    if (!descVal.ok) throw new TypeError(`Invalid trace_descriptor: ${descVal.errors.join(", ")}`);

    const event = createTraceObservationEvent({
      trace_ref: refVal.trace_ref,
      trace_descriptor: descVal.descriptor,
      observer_ref,
      topic_id,
      mandate_ref,
      principal_ref,
      logical_agent_ref,
    });

    if (this.store && typeof this.store.append === "function") {
      this.store.append(event);
    }

    this.traces.set(refVal.trace_ref.trace_id, {
      trace_ref: refVal.trace_ref,
      descriptor: descVal.descriptor,
    });

    // If trace pertains to a subject, register dependency
    const effectiveSubject = subject_ref || descVal.descriptor.meta?.subject_ref;
    if (effectiveSubject) {
      this.dependencyGraph.registerDependency({
        dependent_type: "index",
        dependent_id: `subject-index:${effectiveSubject}`,
        source_type: "trace",
        source_id: refVal.trace_ref.trace_id,
      });
    }

    // Compute bounded invalidation
    const affected = this.dependencyGraph.getAffectedEntities("trace", refVal.trace_ref.trace_id);
    this._markProjectionsStale(affected.projections, refVal.trace_ref.trace_id, "trace_ingestion");

    return { event, affected };
  }

  /**
   * Ingest a typed EvidenceRelation connecting a Trace to an Assertion.
   * Updates the EvidenceGraph, registers dependencies, and invalidates affected projections.
   *
   * @param {object} relation - Canonical EvidenceRelation.
   * @returns {{ relation: object, affected: { assertions: string[], continuations: string[], projections: string[] } }}
   */
  ingestEvidenceRelation(relation) {
    const val = validateEvidenceRelation(relation);
    if (!val.ok) throw new TypeError(`Invalid evidence_relation: ${val.errors.join(", ")}`);

    const storedRel = this.evidenceGraph.addRelation(val.relation);

    // Register that the assertion depends on this trace
    this.dependencyGraph.registerDependency({
      dependent_type: "assertion",
      dependent_id: storedRel.assertion_id,
      source_type: "trace",
      source_id: storedRel.trace_ref.trace_id,
      meta: { relation_id: storedRel.relation_id, relation_type: storedRel.relation_type },
    });

    // Compute bounded invalidation
    const affected = this.dependencyGraph.getAffectedEntities(
      "trace",
      storedRel.trace_ref.trace_id
    );
    this._markProjectionsStale(
      affected.projections,
      storedRel.relation_id,
      `evidence_relation_${storedRel.relation_type}`
    );

    return { relation: storedRel, affected };
  }

  /**
   * Upsert an Assertion held by the Corpus.
   *
   * @param {object} assertion - Canonical Assertion.
   * @returns {{ assertion: object, affected: { continuations: string[], projections: string[] } }}
   */
  upsertAssertion(assertion) {
    const val = validateAssertion(assertion);
    if (!val.ok) throw new TypeError(`Invalid assertion: ${val.errors.join(", ")}`);

    const ast = val.assertion;
    this.assertions.set(ast.assertion_id, ast);

    // If assertion has a subject, register dependency
    if (ast.subject_ref) {
      this.dependencyGraph.registerDependency({
        dependent_type: "assertion",
        dependent_id: ast.assertion_id,
        source_type: "subject",
        source_id: ast.subject_ref,
      });
    }

    // Invalidate any projections or continuations depending on this assertion or its subject
    const affectedAst = this.dependencyGraph.getAffectedEntities("assertion", ast.assertion_id);
    let affectedSub = { continuations: [], projections: [] };
    if (ast.subject_ref) {
      affectedSub = this.dependencyGraph.getAffectedEntities("subject", ast.subject_ref);
    }

    const combinedProjections = Array.from(
      new Set([...affectedAst.projections, ...affectedSub.projections])
    );
    const combinedContinuations = Array.from(
      new Set([...affectedAst.continuations, ...affectedSub.continuations])
    );

    this._markProjectionsStale(combinedProjections, ast.assertion_id, "assertion_updated");

    return {
      assertion: ast,
      affected: {
        continuations: combinedContinuations,
        projections: combinedProjections,
      },
    };
  }

  /**
   * Register a projection and define its scope/dependencies.
   *
   * @param {object} options
   * @param {string} options.projection_id
   * @param {string|null} [options.subject_ref]
   * @param {string|null} [options.topic_ref]
   * @param {string[]} [options.assertion_ids]
   * @param {string[]} [options.trace_ids]
   * @param {object} [options.policy]
   */
  registerProjection({
    projection_id,
    subject_ref = null,
    topic_ref = null,
    assertion_ids = [],
    trace_ids = [],
    policy = {},
  }) {
    requireNonEmptyString(projection_id, "projection_id");
    this.projectionConfigs.set(projection_id, {
      subject_ref,
      topic_ref,
      policy,
    });

    if (subject_ref) {
      this.dependencyGraph.registerDependency({
        dependent_type: "projection",
        dependent_id: projection_id,
        source_type: "subject",
        source_id: subject_ref,
      });
    }
    if (topic_ref) {
      this.dependencyGraph.registerDependency({
        dependent_type: "projection",
        dependent_id: projection_id,
        source_type: "topic",
        source_id: topic_ref,
      });
    }
    for (const astId of assertion_ids) {
      this.dependencyGraph.registerDependency({
        dependent_type: "projection",
        dependent_id: projection_id,
        source_type: "assertion",
        source_id: astId,
      });
    }
    for (const trId of trace_ids) {
      this.dependencyGraph.registerDependency({
        dependent_type: "projection",
        dependent_id: projection_id,
        source_type: "trace",
        source_id: trId,
      });
    }
  }

  /**
   * Retrieve a projection, with staleness checking and optional lazy rebuild.
   *
   * @param {string} projection_id
   * @param {object} [options]
   * @param {boolean} [options.auto_rebuild] - If true, rebuild lazily when stale.
   * @param {TemporalProjector|null} [options.projector] - Projector to check version against.
   * @returns {object|null}
   */
  getProjection(projection_id, { auto_rebuild = false, projector = null } = {}) {
    const proj = this.projections.get(projection_id);
    const activeProjector = projector || this.projector;

    if (!proj) {
      if (auto_rebuild && this.projectionConfigs.has(projection_id)) {
        return this.rebuildProjection(projection_id, { projector: activeProjector });
      }
      return null;
    }

    // Check projector version staleness
    const staleness = activeProjector.checkStaleness(proj);
    if (staleness.is_stale && !proj.stale) {
      proj.stale = true;
      proj.invalidation_cause = {
        trigger_ref: activeProjector.projector_id,
        reason: staleness.reason || "projector_staleness",
        invalidated_at: new Date().toISOString(),
      };
    }

    if (proj.stale && auto_rebuild) {
      return this.rebuildProjection(projection_id, { projector: activeProjector });
    }

    return proj;
  }

  /**
   * Rebuild a projection from authoritative sources (demonstrating pure reconstructibility).
   *
   * @param {string} projection_id
   * @param {object} [options]
   * @param {TemporalProjector|null} [options.projector]
   * @param {object|null} [options.policy]
   * @returns {object} Freshly projected TemporalProjection
   */
  rebuildProjection(projection_id, { projector = null, policy = null } = {}) {
    const cfg = this.projectionConfigs.get(projection_id) || {};
    const activeProjector = projector || this.projector;
    const effectivePolicy = policy || cfg.policy || {};

    // Gather authoritative assertions matching scope
    const matchingAssertions = [];
    for (const ast of this.assertions.values()) {
      if (cfg.subject_ref && ast.subject_ref && ast.subject_ref !== cfg.subject_ref) {
        continue;
      }
      matchingAssertions.push(ast);
      this.dependencyGraph.registerDependency({
        dependent_type: "projection",
        dependent_id: projection_id,
        source_type: "assertion",
        source_id: ast.assertion_id,
      });
    }

    // Gather matching traces
    const matchingTraces = [];
    for (const traceEntry of this.traces.values()) {
      const subject = traceEntry.descriptor.meta?.subject_ref;
      if (cfg.subject_ref && subject && subject !== cfg.subject_ref) {
        continue;
      }
      matchingTraces.push(traceEntry);
      this.dependencyGraph.registerDependency({
        dependent_type: "projection",
        dependent_id: projection_id,
        source_type: "trace",
        source_id: traceEntry.trace_ref.trace_id,
      });
    }

    const rebuilt = activeProjector.buildProjection({
      projection_id,
      subject_ref: cfg.subject_ref,
      topic_ref: cfg.topic_ref,
      assertions: matchingAssertions,
      traces: matchingTraces,
      evidenceGraph: this.evidenceGraph,
      policy: effectivePolicy,
    });

    this.projections.set(projection_id, rebuilt);
    return rebuilt;
  }

  /**
   * Discard a cached projection (demonstrates that index/cache is never source of authority).
   *
   * @param {string} projection_id
   */
  discardProjection(projection_id) {
    this.projections.delete(projection_id);
  }

  /**
   * Internal: mark given projection IDs as stale.
   *
   * @private
   */
  _markProjectionsStale(projectionIds, triggerRef, reason) {
    const now = new Date().toISOString();
    for (const id of projectionIds) {
      const proj = this.projections.get(id);
      if (proj && !proj.stale) {
        proj.stale = true;
        proj.invalidation_cause = {
          trigger_ref: triggerRef,
          reason,
          invalidated_at: now,
        };
      }
    }
  }
}
