import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COP_TEMPORAL_PROJECTION_SCHEMA,
  parseTemporalClaim,
  ReactiveDependencyGraph,
  TemporalProjector,
  ReactiveCorpus,
} from "../src/reactive-corpus.js";
import {
  createAssertion,
  createEvidenceRelation,
  createExternalTraceRef,
  createTraceDescriptor,
  EvidenceGraph,
} from "../src/trace.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("COP 2.x Reactive Corpus & Temporal Projections (Issue #61, #64)", () => {
  it("verifies cop.temporal-projection/v1 schema file exists and is valid JSON", () => {
    const schemaPath = path.resolve(__dirname, "../schemas/cop.temporal-projection.v1.json");
    expect(fs.existsSync(schemaPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    expect(content.title).toBe(COP_TEMPORAL_PROJECTION_SCHEMA);
    expect(content.properties.is_authoritative.const).toBe(false);
    expect(content.properties.is_derived.const).toBe(true);
  });

  describe("1. Time Semantics & Claim Parsing", () => {
    it("parses year-only precision", () => {
      const parsed = parseTemporalClaim("2024");
      expect(parsed.precision).toBe("year");
      expect(parsed.value).toBe("2024");
      expect(parsed.sort_key_ms).toBe(Date.UTC(2024, 0, 1));
      expect(parsed.interval_end_ms).toBe(Date.UTC(2024, 11, 31, 23, 59, 59, 999));
    });

    it("parses month precision", () => {
      const parsed = parseTemporalClaim("2024-05");
      expect(parsed.precision).toBe("month");
      expect(parsed.value).toBe("2024-05");
      expect(parsed.sort_key_ms).toBe(Date.UTC(2024, 4, 1));
      expect(parsed.interval_end_ms).toBe(Date.UTC(2024, 5, 0, 23, 59, 59, 999));
    });

    it("parses day precision", () => {
      const parsed = parseTemporalClaim("2024-05-15");
      expect(parsed.precision).toBe("day");
      expect(parsed.value).toBe("2024-05-15");
      expect(parsed.sort_key_ms).toBe(Date.UTC(2024, 4, 15));
      expect(parsed.interval_end_ms).toBe(Date.UTC(2024, 4, 15, 23, 59, 59, 999));
    });

    it("parses exact ISO-8601 date-time", () => {
      const ts = "2024-05-15T14:30:00.000Z";
      const parsed = parseTemporalClaim(ts);
      expect(parsed.precision).toBe("exact");
      expect(parsed.value).toBe(ts);
      expect(parsed.sort_key_ms).toBe(Date.parse(ts));
      expect(parsed.interval_end_ms).toBeNull();
    });

    it("parses interval and approximate descriptors", () => {
      const interval = parseTemporalClaim({ start: "2020", end: "2022" });
      expect(interval.precision).toBe("interval");
      expect(interval.sort_key_ms).toBe(Date.UTC(2020, 0, 1));
      expect(interval.interval_end_ms).toBe(Date.UTC(2022, 11, 31, 23, 59, 59, 999));

      const approx = parseTemporalClaim({ value: "circa 1980", approximate: true });
      expect(approx.precision).toBe("approximate");
    });
  });

  describe("2. Reactive Dependency Tracking & Bounded Invalidation", () => {
    it("propagates transitively from trace to assertion, continuation, and projection", () => {
      const graph = new ReactiveDependencyGraph();

      // Assertion ast:1 depends on Trace tr:1
      graph.registerDependency({
        dependent_type: "assertion",
        dependent_id: "ast:1",
        source_type: "trace",
        source_id: "tr:1",
      });

      // Continuation cont:check-1 depends on Assertion ast:1
      graph.registerDependency({
        dependent_type: "continuation",
        dependent_id: "cont:check-1",
        source_type: "assertion",
        source_id: "ast:1",
      });

      // Projection proj:timeline-1 depends on Assertion ast:1
      graph.registerDependency({
        dependent_type: "projection",
        dependent_id: "proj:timeline-1",
        source_type: "assertion",
        source_id: "ast:1",
      });

      // Projection proj:unrelated depends on Trace tr:999
      graph.registerDependency({
        dependent_type: "projection",
        dependent_id: "proj:unrelated",
        source_type: "trace",
        source_id: "tr:999",
      });

      const affected = graph.getAffectedEntities("trace", "tr:1");

      expect(affected.assertions).toEqual(["ast:1"]);
      expect(affected.continuations).toEqual(["cont:check-1"]);
      expect(affected.projections).toEqual(["proj:timeline-1"]);
      expect(affected.projections).not.toContain("proj:unrelated");
    });
  });

  describe("3. Required Fixtures (Issue #64)", () => {
    // ------------------------------------------------------------------
    // Fixture A — Simple temporal reconstruction
    // ------------------------------------------------------------------
    it("Fixture A: reconstructs deterministic and chronological Timeline View across dates", () => {
      const corpus = new ReactiveCorpus();

      const ast1 = createAssertion({
        assertion_id: "ast:event-1990",
        claim: { title: "Company Founded", occurred_at: "1990-06-01" },
        subject_ref: "subject:corp-alpha",
        asserted_by: "agent:archivist",
      });

      const ast2 = createAssertion({
        assertion_id: "ast:event-2010",
        claim: { title: "Global Expansion", occurred_at: "2010-09-15" },
        subject_ref: "subject:corp-alpha",
        asserted_by: "agent:archivist",
      });

      const ast3 = createAssertion({
        assertion_id: "ast:event-2000",
        claim: { title: "IPO Milestone", occurred_at: "2000-01-20" },
        subject_ref: "subject:corp-alpha",
        asserted_by: "agent:archivist",
      });

      // Upsert in arbitrary non-chronological order
      corpus.upsertAssertion(ast2);
      corpus.upsertAssertion(ast1);
      corpus.upsertAssertion(ast3);

      corpus.registerProjection({
        projection_id: "proj:timeline:corp-alpha",
        subject_ref: "subject:corp-alpha",
      });

      const projection = corpus.rebuildProjection("proj:timeline:corp-alpha");

      expect(projection.schema).toBe(COP_TEMPORAL_PROJECTION_SCHEMA);
      expect(projection.is_authoritative).toBe(false);
      expect(projection.is_derived).toBe(true);
      expect(projection.stale).toBe(false);
      expect(projection.timeline.length).toBe(3);

      // Verify strictly chronological ordering
      expect(projection.timeline[0].item_id).toBe("ast:event-1990");
      expect(projection.timeline[0].occurred_at.value).toBe("1990-06-01");
      expect(projection.timeline[1].item_id).toBe("ast:event-2000");
      expect(projection.timeline[1].occurred_at.value).toBe("2000-01-20");
      expect(projection.timeline[2].item_id).toBe("ast:event-2010");
      expect(projection.timeline[2].occurred_at.value).toBe("2010-09-15");
    });

    // ------------------------------------------------------------------
    // Fixture B — Late discovery (Separation of 3 times)
    // ------------------------------------------------------------------
    it("Fixture B: separates historical time (T1) from authoring (T2) and ingestion time (T3)", () => {
      const corpus = new ReactiveCorpus();

      const T1_OCCURRED = "1999-07-14";
      const T2_CREATED = "2005-04-12T08:00:00.000Z";
      const T3_INGESTED = "2026-09-06T10:00:00.000Z";

      const externalTraceRef = createExternalTraceRef({
        trace_id: "ext:archive:treaty-scan-1999",
        integrity: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
        resolution_hints: {
          created_at: T2_CREATED,
          observed_at: T3_INGESTED,
        },
      });

      const descriptor = createTraceDescriptor({
        trace_ref: externalTraceRef,
        kind: "historical_document",
        origin: "national_archives",
        observed_at: T3_INGESTED,
        occurred_at: T1_OCCURRED,
        created_at: T2_CREATED,
      });

      corpus.ingestTrace({
        trace_ref: externalTraceRef,
        trace_descriptor: descriptor,
        observer_ref: "agent:historian",
        topic_id: "topic:history",
        subject_ref: "subject:peace-treaty",
      });

      const treatyAssertion = createAssertion({
        assertion_id: "ast:treaty-1999",
        claim: { title: "Treaty Signed", occurred_at: T1_OCCURRED },
        subject_ref: "subject:peace-treaty",
        asserted_by: "agent:historian",
        asserted_at: T3_INGESTED,
      });

      corpus.upsertAssertion(treatyAssertion);

      corpus.ingestEvidenceRelation(
        createEvidenceRelation({
          relation_type: "supports",
          trace_ref: externalTraceRef,
          assertion_id: "ast:treaty-1999",
          asserted_by: "agent:historian",
          strength: "conclusive",
        })
      );

      corpus.registerProjection({
        projection_id: "proj:treaty",
        subject_ref: "subject:peace-treaty",
      });

      const proj = corpus.rebuildProjection("proj:treaty");
      expect(proj.timeline.length).toBe(1);
      const item = proj.timeline[0];

      // T1: Valid time is preserved in the past
      expect(item.occurred_at.value).toBe(T1_OCCURRED);
      expect(item.occurred_at.sort_key_ms).toBe(Date.UTC(1999, 6, 14));

      // T2: Authoring/creation timestamp preserved
      expect(item.trace_created_at).toBe(T2_CREATED);

      // T3: Ingestion/observation timestamp preserved in 2026
      expect(item.observed_or_ingested_at).toBe(T3_INGESTED);

      // Distinct times: none was collapsed into the other
      expect(item.occurred_at.value).not.toBe(item.observed_or_ingested_at);
      expect(item.trace_created_at).not.toBe(item.observed_or_ingested_at);
    });

    // ------------------------------------------------------------------
    // Fixture C — Identity / Relationship correction & Bounded Invalidation
    // ------------------------------------------------------------------
    it("Fixture C: invalidates only dependent projection portions without global corpus recomputation", () => {
      const corpus = new ReactiveCorpus();

      // Projections for two distinct subjects
      corpus.registerProjection({
        projection_id: "proj:alice",
        subject_ref: "subject:alice",
      });
      corpus.registerProjection({
        projection_id: "proj:bob",
        subject_ref: "subject:bob",
      });

      corpus.upsertAssertion(
        createAssertion({
          assertion_id: "ast:alice-role",
          subject_ref: "subject:alice",
          claim: { role: "Engineer", occurred_at: "2022-01-01" },
          asserted_by: "agent:hr",
        })
      );

      corpus.upsertAssertion(
        createAssertion({
          assertion_id: "ast:bob-role",
          subject_ref: "subject:bob",
          claim: { role: "Designer", occurred_at: "2023-01-01" },
          asserted_by: "agent:hr",
        })
      );

      corpus.rebuildProjection("proj:alice");
      corpus.rebuildProjection("proj:bob");

      expect(corpus.getProjection("proj:alice").stale).toBe(false);
      expect(corpus.getProjection("proj:bob").stale).toBe(false);

      // Ingest a trace correcting Alice's relationship/role
      const correctionTrace = createExternalTraceRef({
        trace_id: "ext:hr:alice-promotion-2024",
        integrity: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
      });

      corpus.ingestTrace({
        trace_ref: correctionTrace,
        trace_descriptor: createTraceDescriptor({
          trace_ref: correctionTrace,
          kind: "hr_amendment",
          origin: "hr_portal",
          observed_at: new Date().toISOString(),
          meta: { subject_ref: "subject:alice" },
        }),
        observer_ref: "agent:hr",
        topic_id: "topic:hr",
        subject_ref: "subject:alice",
      });

      // Alice's assertion is updated
      corpus.upsertAssertion(
        createAssertion({
          assertion_id: "ast:alice-role",
          revision: 2,
          subject_ref: "subject:alice",
          claim: { role: "Lead Architect", occurred_at: "2024-01-01" },
          asserted_by: "agent:hr",
          supersedes_id: "ast:alice-role@r1",
        })
      );

      // Result: Alice's projection is marked stale, but Bob's remains clean!
      expect(corpus.getProjection("proj:alice").stale).toBe(true);
      expect(corpus.getProjection("proj:alice").invalidation_cause?.reason).toBe(
        "assertion_updated"
      );
      expect(corpus.getProjection("proj:bob").stale).toBe(false);
    });

    // ------------------------------------------------------------------
    // Fixture D — Non-destructive Contradiction
    // ------------------------------------------------------------------
    it("Fixture D: preserves contradictory evidence without destructive overwrite", () => {
      const corpus = new ReactiveCorpus();

      const claimAssertion = createAssertion({
        assertion_id: "ast:graduation-date",
        subject_ref: "subject:charlie",
        claim: { degree: "M.Sc.", occurred_at: "2020-06-25" },
        epistemic_status: "declared",
        asserted_by: "agent:registrar",
      });
      corpus.upsertAssertion(claimAssertion);

      // Supporting Trace
      const traceDiploma = createExternalTraceRef({
        trace_id: "ext:diploma:charlie",
        integrity: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
      });
      corpus.ingestEvidenceRelation(
        createEvidenceRelation({
          relation_type: "supports",
          trace_ref: traceDiploma,
          assertion_id: "ast:graduation-date",
          strength: "strong",
          justification: "Issued degree certificate scan",
          asserted_by: "agent:registrar",
        })
      );

      // Contradicting Trace arrives later
      const traceAuditDispute = createExternalTraceRef({
        trace_id: "ext:audit:university-dispute",
        integrity: "sha256:4444444444444444444444444444444444444444444444444444444444444444",
      });
      corpus.ingestEvidenceRelation(
        createEvidenceRelation({
          relation_type: "contradicts",
          trace_ref: traceAuditDispute,
          assertion_id: "ast:graduation-date",
          strength: "strong",
          justification: "Registry records show course requirements incomplete",
          asserted_by: "agent:audit",
        })
      );

      corpus.registerProjection({
        projection_id: "proj:charlie",
        subject_ref: "subject:charlie",
      });

      const proj = corpus.rebuildProjection("proj:charlie");
      expect(proj.timeline.length).toBe(1);
      const item = proj.timeline[0];

      // Invariant: Both supporting and contradicting traces are preserved!
      expect(item.source_trace_refs.length).toBe(2);
      expect(item.epistemic_summary.has_contradiction).toBe(true);
      expect(item.epistemic_summary.supports_count).toBe(1);
      expect(item.epistemic_summary.contradicts_count).toBe(1);

      // Epistemic status transparently transitions to disputed without losing history
      expect(item.epistemic_status).toBe("disputed");
    });

    // ------------------------------------------------------------------
    // Fixture E — Cache Discard & Pure Rebuild Equivalence
    // ------------------------------------------------------------------
    it("Fixture E: deleting cache and rebuilding from authoritative inputs yields equivalent view", () => {
      const corpus = new ReactiveCorpus();

      corpus.upsertAssertion(
        createAssertion({
          assertion_id: "ast:step-1",
          subject_ref: "subject:pipeline",
          claim: { name: "Ingestion Started", occurred_at: "2025-01-01T00:00:00Z" },
          asserted_by: "agent:pipeline",
        })
      );
      corpus.upsertAssertion(
        createAssertion({
          assertion_id: "ast:step-2",
          subject_ref: "subject:pipeline",
          claim: { name: "Processing Completed", occurred_at: "2025-01-01T01:00:00Z" },
          asserted_by: "agent:pipeline",
        })
      );

      corpus.registerProjection({
        projection_id: "proj:pipeline-log",
        subject_ref: "subject:pipeline",
      });

      const viewInitial = corpus.rebuildProjection("proj:pipeline-log");

      // Discard / delete cache entirely
      corpus.discardProjection("proj:pipeline-log");
      expect(corpus.getProjection("proj:pipeline-log")).toBeNull();

      // Rebuild from authoritative inputs
      const viewRebuilt = corpus.rebuildProjection("proj:pipeline-log");

      expect(viewRebuilt.projection_id).toBe(viewInitial.projection_id);
      expect(viewRebuilt.source_commitments.digest).toBe(viewInitial.source_commitments.digest);
      expect(viewRebuilt.timeline.length).toBe(viewInitial.timeline.length);
      expect(viewRebuilt.timeline[0].item_id).toBe(viewInitial.timeline[0].item_id);
      expect(viewRebuilt.timeline[1].item_id).toBe(viewInitial.timeline[1].item_id);
      expect(viewRebuilt.timeline[0].occurred_at.sort_key_ms).toBe(
        viewInitial.timeline[0].occurred_at.sort_key_ms
      );
    });

    // ------------------------------------------------------------------
    // Fixture F — Projector Version Upgrade Staleness
    // ------------------------------------------------------------------
    it("Fixture F: projector version upgrade marks cached projections stale", () => {
      const corpus = new ReactiveCorpus();

      const projectorV1 = new TemporalProjector({
        projector_id: "temporal:core",
        projector_version: "1.0.0",
      });

      const projectorV2 = new TemporalProjector({
        projector_id: "temporal:core",
        projector_version: "2.0.0",
      });

      corpus.upsertAssertion(
        createAssertion({
          assertion_id: "ast:item-1",
          subject_ref: "subject:project-x",
          claim: { milestone: "Alpha", occurred_at: "2024-03-01" },
          asserted_by: "agent:pm",
        })
      );

      corpus.registerProjection({
        projection_id: "proj:project-x",
        subject_ref: "subject:project-x",
      });

      // Built with projector v1
      const projV1 = corpus.rebuildProjection("proj:project-x", { projector: projectorV1 });
      expect(projV1.projector_version).toBe("1.0.0");
      expect(projV1.stale).toBe(false);

      // Checked against projector v2: must be flagged stale due to version mismatch!
      const fetched = corpus.getProjection("proj:project-x", { projector: projectorV2 });
      expect(fetched.stale).toBe(true);
      expect(fetched.invalidation_cause?.reason).toContain("projector_version_mismatch");

      // Auto-rebuild with v2 clears staleness and updates version
      const refreshed = corpus.getProjection("proj:project-x", {
        projector: projectorV2,
        auto_rebuild: true,
      });
      expect(refreshed.stale).toBe(false);
      expect(refreshed.projector_version).toBe("2.0.0");
    });
  });
});
