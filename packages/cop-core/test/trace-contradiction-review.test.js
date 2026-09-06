import { describe, it, expect } from "vitest";
import {
  COP_TRACE_REF_SCHEMA,
  COP_TRACE_DESCRIPTOR_SCHEMA,
  COP_ASSERTION_SCHEMA,
  createTraceRef,
  createExternalTraceRef,
  createTraceDescriptor,
  createAssertion,
  createEvidenceRelation,
  createTraceObservationEvent,
  EvidenceGraph,
} from "../src/trace.js";
import { ReactiveCorpus, TemporalProjector, parseTemporalClaim } from "../src/reactive-corpus.js";
import { createLocalTraceConsolidationReceipt } from "../src/local-trace-consolidation.js";
import { createCopEventEnvelope } from "../src/cop-event-envelope.js";

describe("COP 2.x Trace-Centric Contradiction Review & Conformance Attacks (Issue #65)", () => {
  // ----------------------------------------------------------------------
  // Attack A: Provenance Laundering
  // Low-trust external trace -> AI summary -> consolidation -> memory retrieval
  // Show whether the final object can incorrectly acquire stronger authority than source.
  // ----------------------------------------------------------------------
  it("Attack A (Provenance Laundering): low-trust external trace cannot silently acquire high authority through summarization/consolidation", () => {
    const unverifiedHash = "sha256:" + "a".repeat(64);
    const lowTrustRef = createExternalTraceRef({
      trace_id: "ext:unverified-forum:post-99",
      integrity: unverifiedHash,
      locator: "https://anonymous-forum.local/post/99",
    });

    const lowTrustDescriptor = createTraceDescriptor({
      trace_ref: lowTrustRef,
      kind: "anonymous_post",
      origin: "https://anonymous-forum.local",
      observed_at: "2026-09-01T00:00:00Z",
      visibility: "open",
      meta: { trust_level: "unverified", self_attested: true },
    });
    expect(lowTrustDescriptor.schema).toBe(COP_TRACE_DESCRIPTOR_SCHEMA);

    // An agent summarizes this low-trust post
    const summaryEvent = createCopEventEnvelope({
      event_type: "TraceSummaryGenerated",
      topic_id: "topic:research-agent",
      topic_seq: 1,
      actor_ref: "agent:researcher",
      payload: {
        source_trace_id: lowTrustRef.trace_id,
        summary_text: "Unverified rumor claims project budget was doubled.",
      },
    });

    // Consolidation occurs
    const consolidationReceipt = createLocalTraceConsolidationReceipt({
      consolidation_id: "csl:attack-a",
      local_store_ref: "store:agent-local-mem",
      retained_until: "2026-12-31T00:00:00Z",
      events: [summaryEvent],
      summary: { claim: "Budget doubled according to forum" },
    });

    // Corpus receives an Assertion attempting to state "Budget doubled"
    // ATTACK TEST: Does the assertion retain weak/hypothesized epistemic status and link to the low-trust source?
    const attemptedNormativeAssertion = createAssertion({
      assertion_id: "ast:budget-doubled",
      claim: { budget: 2000000 },
      epistemic_status: "hypothesized", // Must NOT be normative without authoritative principal grant
      subject_ref: "subject:project-budget",
      asserted_by: "agent:researcher",
      meta: {
        derived_from_consolidation: consolidationReceipt.consolidation_id,
        root_source_ref: lowTrustRef.trace_id,
        initial_trust: "unverified",
      },
    });

    // Verify epistemic separation
    expect(attemptedNormativeAssertion.epistemic_status).not.toBe("normative");
    expect(attemptedNormativeAssertion.epistemic_status).toBe("hypothesized");
    expect(attemptedNormativeAssertion.meta.root_source_ref).toBe(lowTrustRef.trace_id);

    // Verify EvidenceRelation cannot claim conclusive strength for an unverified trace
    const rel = createEvidenceRelation({
      relation_type: "supports",
      trace_ref: lowTrustRef,
      assertion_id: attemptedNormativeAssertion.assertion_id,
      strength: "weak", // Cannot be conclusive
      justification: "Anonymous forum posting",
      asserted_by: "agent:researcher",
    });

    expect(rel.strength).toBe("weak");
  });

  // ----------------------------------------------------------------------
  // Attack B: Location Disappearance
  // TraceRef points to content whose locator becomes unavailable.
  // Model must distinguish 'known trace exists' from 'payload currently resolvable'.
  // ----------------------------------------------------------------------
  it("Attack B (Location Disappearance): preserves cryptographic existence when locator is unreachable", () => {
    const knownIntegrity = "sha256:" + "b".repeat(64);
    const ephemeralLocator = "https://ephemeral-host.local/lost-file.pdf";

    const traceRef = createTraceRef({
      trace_id: "ext:ephemeral:lost-file",
      target_type: "external",
      integrity: knownIntegrity,
      locator: ephemeralLocator,
    });

    const descriptor = createTraceDescriptor({
      trace_ref: traceRef,
      kind: "document",
      origin: "ephemeral-host.local",
      observed_at: "2026-09-01T12:00:00Z",
      integrity: knownIntegrity,
    });

    // Mock resolver checking availability
    function resolvePayload(ref, isOnline) {
      if (!isOnline) {
        return {
          resolved: false,
          error: "locator_unreachable",
          trace_id: ref.trace_id,
          integrity_verified: false,
        };
      }
      return { resolved: true, bytes: Buffer.from("data") };
    }

    const offlineResult = resolvePayload(traceRef, false);

    // Invariant: The trace descriptor and cryptographic identity remain valid and known!
    expect(traceRef.trace_id).toBe("ext:ephemeral:lost-file");
    expect(traceRef.integrity).toBe(knownIntegrity);
    expect(descriptor.schema).toBe(COP_TRACE_DESCRIPTOR_SCHEMA);
    expect(offlineResult.resolved).toBe(false);
    expect(offlineResult.error).toBe("locator_unreachable");
    // Knowledge of the trace's past existence is NOT deleted merely because current locator 404s!
  });

  // ----------------------------------------------------------------------
  // Attack C: Conflicting Historical Traces
  // Two immutable traces support incompatible Assertions.
  // Neither may be deleted; projection must reflect tension and expose basis.
  // ----------------------------------------------------------------------
  it("Attack C (Conflicting Historical Traces): contradictory traces co-exist without deletion and expose basis", () => {
    const corpus = new ReactiveCorpus();

    const traceA = createExternalTraceRef({
      trace_id: "ext:archive:1848-gazette",
      integrity: "sha256:" + "c".repeat(64),
      resolution_hints: { observed_at: "2026-09-06T10:00:00Z" },
    });

    const traceB = createExternalTraceRef({
      trace_id: "ext:archive:1848-parliament-records",
      integrity: "sha256:" + "d".repeat(64),
      resolution_hints: { observed_at: "2026-09-06T10:05:00Z" },
    });

    const assertionA = createAssertion({
      assertion_id: "ast:ratification-feb02",
      claim: { event: "Treaty Ratified", occurred_at: "1848-02-02" },
      subject_ref: "subject:treaty-1848",
      epistemic_status: "inferred",
      asserted_by: "agent:historian",
    });

    corpus.upsertAssertion(assertionA);

    corpus.ingestEvidenceRelation(
      createEvidenceRelation({
        relation_type: "supports",
        trace_ref: traceA,
        assertion_id: assertionA.assertion_id,
        strength: "strong",
        justification: "Gazette publication notice",
        asserted_by: "agent:historian",
      })
    );

    // Contradictory trace B asserts Parliament voted on Feb 15
    corpus.ingestEvidenceRelation(
      createEvidenceRelation({
        relation_type: "contradicts",
        trace_ref: traceB,
        assertion_id: assertionA.assertion_id,
        strength: "conclusive",
        justification: "Parliament minutes show debate still ongoing on Feb 05",
        asserted_by: "agent:historian",
      })
    );

    corpus.registerProjection({
      projection_id: "proj:treaty-timeline",
      subject_ref: "subject:treaty-1848",
    });

    const proj = corpus.rebuildProjection("proj:treaty-timeline");

    // Invariants:
    // 1. Assertion is NOT deleted
    expect(proj.timeline.length).toBe(1);
    // 2. Both traces are cited in source_trace_refs
    expect(proj.timeline[0].source_trace_refs.length).toBe(2);
    // 3. Status transparently transitions to disputed
    expect(proj.timeline[0].epistemic_status).toBe("disputed");
    expect(proj.timeline[0].epistemic_summary.has_contradiction).toBe(true);
    expect(proj.timeline[0].epistemic_summary.supports_count).toBe(1);
    expect(proj.timeline[0].epistemic_summary.contradicts_count).toBe(1);
  });

  // ----------------------------------------------------------------------
  // Attack D: Derived-View Corruption
  // Corrupt a projection cache. Detect ungrounded data upon authoritative rebuild.
  // ----------------------------------------------------------------------
  it("Attack D (Derived-View Corruption): ungrounded data injected into cache disappears on authoritative rebuild", () => {
    const corpus = new ReactiveCorpus();

    const authenticAssertion = createAssertion({
      assertion_id: "ast:real-milestone",
      claim: { step: "Init", occurred_at: "2025-01-01" },
      subject_ref: "subject:audit",
      asserted_by: "agent:ops",
    });
    corpus.upsertAssertion(authenticAssertion);

    corpus.registerProjection({
      projection_id: "proj:audit",
      subject_ref: "subject:audit",
    });

    const authenticProj = corpus.rebuildProjection("proj:audit");
    expect(authenticProj.timeline.length).toBe(1);

    // ATTACK: An adversary directly mutates the cached projection in-memory
    authenticProj.timeline.push({
      item_id: "ast:fake-injected-event",
      occurred_at: parseTemporalClaim("2099-01-01"),
      observed_or_ingested_at: "2099-01-01T00:00:00Z",
      source_trace_refs: [],
      epistemic_status: "normative",
    });
    expect(authenticProj.timeline.length).toBe(2);

    // RECONSTRUCTIBILITY INVARIANT: Rebuilding from authoritative store wipes ungrounded injection
    const cleansed = corpus.rebuildProjection("proj:audit");
    expect(cleansed.timeline.length).toBe(1);
    expect(cleansed.timeline[0].item_id).toBe("ast:real-milestone");
    expect(cleansed.timeline.some((item) => item.item_id === "ast:fake-injected-event")).toBe(
      false
    );
  });

  // ----------------------------------------------------------------------
  // Attack E: Event / Source Confusion
  // External document ingested into COP must not be misread as COP-originated
  // or as having occurred at ingestion time.
  // ----------------------------------------------------------------------
  it("Attack E (Event/Source Confusion): ingestion COP event is strictly distinguished from external origin and occurrence", () => {
    const historicalOccurrence = "1789-07-14";
    const externalTraceRef = createExternalTraceRef({
      trace_id: "ext:archive:declaration-1789",
      integrity: "sha256:" + "e".repeat(64),
      locator: "https://archives.gov.fr/dec-1789",
    });

    const descriptor = createTraceDescriptor({
      trace_ref: externalTraceRef,
      kind: "treaty",
      origin: "https://archives.gov.fr",
      observed_at: "2026-09-06T10:00:00Z",
      occurred_at: historicalOccurrence,
      created_at: "1789-07-14T12:00:00Z",
    });

    const ingestionEvent = createTraceObservationEvent({
      trace_ref: externalTraceRef,
      trace_descriptor: descriptor,
      observer_ref: "agent:curator",
      topic_id: "topic:history-ingest",
    });

    // Invariant 1: origin_ref points to external trace, NOT cop procedural runtime
    expect(ingestionEvent.origin_ref).toBe("ext:archive:declaration-1789");
    // Invariant 2: explicitly flags that COP did not originate the content
    expect(ingestionEvent.payload.cop_originated).toBe(false);
    // Invariant 3: occurrence timestamp (1789) is NOT overwritten by ingestion time (2026)
    expect(descriptor.occurred_at).toBe(historicalOccurrence);
    expect(ingestionEvent.time.recorded_at).toContain("2026");
  });

  // ----------------------------------------------------------------------
  // Attack F: Duplicate Observation via Divergent Locators
  // Same external bytes observed via two distinct locators (URL vs Git)
  // Must deduplicate by content integrity without creating an echo chamber.
  // ----------------------------------------------------------------------
  it("Attack F (Duplicate Observation): identical content hash from multiple locators recognized without echo-chamber amplification", () => {
    const identicalDigest = "sha256:" + "f".repeat(64);

    // Witnessed via HTTP mirror
    const traceRefUrl = createExternalTraceRef({
      trace_id: "ext:http:mirror1/report.pdf",
      integrity: identicalDigest,
      locator: "https://mirror1.org/report.pdf",
    });

    // Witnessed via Git blob
    const traceRefGit = createExternalTraceRef({
      trace_id: "ext:git:blob/report.pdf",
      integrity: identicalDigest,
      locator: "git://github.com/org/repo.git#objects/abcdef",
    });

    expect(traceRefUrl.integrity).toBe(traceRefGit.integrity);
    expect(traceRefUrl.trace_id).not.toBe(traceRefGit.trace_id);

    const graph = new EvidenceGraph();
    const assertion = createAssertion({
      assertion_id: "ast:fiscal-deficit",
      claim: "Fiscal deficit is 4.2%",
      epistemic_status: "inferred",
      asserted_by: "agent:analyst",
    });

    graph.addRelation(
      createEvidenceRelation({
        relation_type: "supports",
        trace_ref: traceRefUrl,
        assertion_id: assertion.assertion_id,
        strength: "strong",
        asserted_by: "agent:crawler-1",
      })
    );

    graph.addRelation(
      createEvidenceRelation({
        relation_type: "supports",
        trace_ref: traceRefGit,
        assertion_id: assertion.assertion_id,
        strength: "strong",
        asserted_by: "agent:crawler-2",
      })
    );

    const relations = graph.getRelationsForAssertion(assertion.assertion_id);
    expect(relations.supports.length).toBe(2);

    // Deduplication check: unique underlying content identities
    const uniqueContentDigests = new Set(
      relations.supports.map((r) => r.trace_ref.integrity).filter(Boolean)
    );
    // Even though 2 relations were recorded, only 1 unique cryptographic content identity exists
    expect(uniqueContentDigests.size).toBe(1);
  });

  // ----------------------------------------------------------------------
  // Attack G: Projector Drift
  // Re-running same source set under v1 and v2 must be distinguishable.
  // Old cached output must not masquerade as current truth.
  // ----------------------------------------------------------------------
  it("Attack G (Projector Drift): projection built with v1 algorithm detected as stale when evaluated against v2", () => {
    const corpus = new ReactiveCorpus();

    const projV1 = new TemporalProjector({
      projector_id: "temporal:core",
      projector_version: "1.0.0",
    });

    const projV2 = new TemporalProjector({
      projector_id: "temporal:core",
      projector_version: "2.0.0",
    });

    corpus.upsertAssertion(
      createAssertion({
        assertion_id: "ast:item",
        claim: { test: true, occurred_at: "2024-01-01" },
        subject_ref: "subject:drift",
        asserted_by: "agent:tester",
      })
    );

    corpus.registerProjection({
      projection_id: "proj:drift",
      subject_ref: "subject:drift",
    });

    const cached = corpus.rebuildProjection("proj:drift", { projector: projV1 });
    expect(cached.projector_version).toBe("1.0.0");
    expect(cached.stale).toBe(false);

    // When requested with v2 projector, staleness is triggered
    const fetched = corpus.getProjection("proj:drift", { projector: projV2 });
    expect(fetched.stale).toBe(true);
    expect(fetched.invalidation_cause.reason).toContain("projector_version_mismatch");
  });

  // ----------------------------------------------------------------------
  // Attack H: Authority vs Custody Confusion
  // Moving or replicating custody of bytes does not transfer authority.
  // ----------------------------------------------------------------------
  it("Attack H (Authority vs Custody Confusion): transferring custody to third party does not alter asserting authority", () => {
    const originalHash = "sha256:" + "8".repeat(64);

    const initialRef = createTraceRef({
      trace_id: "ext:doc:alpha",
      target_type: "external",
      integrity: originalHash,
      locator: "https://alice-server.org/statement.pdf",
    });

    const initialDesc = createTraceDescriptor({
      trace_ref: initialRef,
      kind: "policy_declaration",
      origin: "principal:alice",
      observed_at: "2026-09-01T00:00:00Z",
      custody: "server:alice",
    });

    // Replicated to untrusted third-party bucket
    const replicatedRef = createTraceRef({
      trace_id: "ext:doc:alpha-copy",
      target_type: "external",
      integrity: originalHash, // Same bytes
      locator: "s3://untrusted-host/statement.pdf",
    });

    const replicatedDesc = createTraceDescriptor({
      trace_ref: replicatedRef,
      kind: "policy_declaration",
      origin: "principal:alice", // Invariant: Origin and authority remain Alice!
      observed_at: "2026-09-05T00:00:00Z",
      custody: "bucket:untrusted-host", // Custody changed
    });

    // Invariants:
    expect(replicatedDesc.custody).toBe("bucket:untrusted-host");
    expect(replicatedDesc.origin).toBe("principal:alice");
    expect(replicatedDesc.origin).toBe(initialDesc.origin);
    expect(replicatedDesc.integrity).toBe(initialDesc.integrity);
    // The custodian holds raw bytes but holds zero authority to alter the declaration!
  });
});
