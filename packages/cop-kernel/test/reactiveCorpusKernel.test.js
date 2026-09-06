import test from "node:test";
import assert from "node:assert/strict";

import {
  COP_TEMPORAL_PROJECTION_SCHEMA,
  ReactiveCorpus,
  TemporalProjector,
  createAssertion,
  createEvidenceRelation,
  createExternalTraceRef,
  createTraceDescriptor,
} from "@inseme/cop-core";

test("cop-kernel integration: ReactiveCorpus end-to-end trace ingestion, invalidation & rebuild", () => {
  const corpus = new ReactiveCorpus({
    projector: new TemporalProjector({
      projector_id: "temporal:kernel-test",
      projector_version: "1.0.0",
    }),
  });

  // 1. Ingest an external trace witnessed by an observer
  const externalRef = createExternalTraceRef({
    trace_id: "ext:git:commit:a1b2c3d4e5f6",
    integrity: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    resolution_hints: {
      observed_at: "2026-09-06T10:00:00.000Z",
      created_at: "2026-09-01T08:00:00.000Z",
    },
  });

  const descriptor = createTraceDescriptor({
    trace_ref: externalRef,
    kind: "git_commit",
    origin: "https://github.com/JeanHuguesRobert/inseme",
    observed_at: "2026-09-06T10:00:00.000Z",
    occurred_at: "2026-09-01T08:00:00.000Z",
    created_at: "2026-09-01T08:00:00.000Z",
    meta: { subject_ref: "subject:kernel-release" },
  });

  const ingestResult = corpus.ingestTrace({
    trace_ref: externalRef,
    trace_descriptor: descriptor,
    observer_ref: "agent:jhn",
    topic_id: "topic:kernel-ci",
    subject_ref: "subject:kernel-release",
  });

  assert.equal(ingestResult.event.event_type, "TraceObservation");
  assert.equal(ingestResult.event.origin_ref, externalRef.trace_id);

  // 2. Formulate an Assertion linked to this trace
  const assertion = createAssertion({
    assertion_id: "ast:kernel-v2-released",
    subject_ref: "subject:kernel-release",
    claim: { milestone: "v2.0.0-rc1", occurred_at: "2026-09-01T08:00:00.000Z" },
    asserted_by: "agent:jhn",
    asserted_at: "2026-09-06T10:05:00.000Z",
  });

  corpus.upsertAssertion(assertion);

  // Register continuation waiting on assertion confirmation
  corpus.dependencyGraph.registerDependency({
    dependent_type: "continuation",
    dependent_id: "cont:await-release-verification",
    source_type: "assertion",
    source_id: assertion.assertion_id,
  });

  corpus.ingestEvidenceRelation(
    createEvidenceRelation({
      relation_type: "supports",
      trace_ref: externalRef,
      assertion_id: assertion.assertion_id,
      strength: "strong",
      asserted_by: "agent:jhn",
    })
  );

  // 3. Register and build derived projection
  corpus.registerProjection({
    projection_id: "proj:kernel-timeline",
    subject_ref: "subject:kernel-release",
  });

  const proj = corpus.rebuildProjection("proj:kernel-timeline");

  assert.equal(proj.schema, COP_TEMPORAL_PROJECTION_SCHEMA);
  assert.equal(proj.is_authoritative, false);
  assert.equal(proj.is_derived, true);
  assert.equal(proj.stale, false);
  assert.equal(proj.timeline.length, 1);
  assert.equal(proj.timeline[0].item_id, assertion.assertion_id);
  assert.equal(proj.timeline[0].epistemic_summary?.supports_count, 1);
  assert.equal(proj.timeline[0].epistemic_summary?.has_contradiction, false);

  // 4. Ingest contradictory trace
  const disputeTrace = createExternalTraceRef({
    trace_id: "ext:ci:failing-build-tag",
    integrity: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
  });

  const relResult = corpus.ingestEvidenceRelation(
    createEvidenceRelation({
      relation_type: "contradicts",
      trace_ref: disputeTrace,
      assertion_id: assertion.assertion_id,
      strength: "strong",
      justification: "Build pipeline failed at tag commit",
      asserted_by: "agent:ci-watcher",
    })
  );

  // Check bounded reactive impact
  assert(relResult.affected.assertions.includes(assertion.assertion_id));
  assert(relResult.affected.continuations.includes("cont:await-release-verification"));
  assert(relResult.affected.projections.includes("proj:kernel-timeline"));

  // Check projection is marked stale
  const cachedProj = corpus.getProjection("proj:kernel-timeline");
  assert.equal(cachedProj?.stale, true);
  assert.equal(cachedProj?.invalidation_cause?.reason, "evidence_relation_contradicts");

  // 5. Rebuild reflects contradiction non-destructively
  const refreshedProj = corpus.rebuildProjection("proj:kernel-timeline");
  assert.equal(refreshedProj.stale, false);
  assert.equal(refreshedProj.timeline[0].epistemic_summary?.has_contradiction, true);
  assert.equal(refreshedProj.timeline[0].epistemic_summary?.supports_count, 1);
  assert.equal(refreshedProj.timeline[0].epistemic_summary?.contradicts_count, 1);
  assert.equal(refreshedProj.timeline[0].epistemic_status, "disputed");

  // 6. Cache discard & rebuild equivalence
  corpus.discardProjection("proj:kernel-timeline");
  assert.equal(corpus.getProjection("proj:kernel-timeline"), null);
  const reMaterialized = corpus.rebuildProjection("proj:kernel-timeline");
  assert.deepEqual(reMaterialized.timeline, refreshedProj.timeline);
  assert.equal(reMaterialized.source_commitments.digest, refreshedProj.source_commitments.digest);
});
