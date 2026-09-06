import { describe, it, expect } from "vitest";
import {
  COP_TRACE_REF_SCHEMA,
  COP_TRACE_DESCRIPTOR_SCHEMA,
  COP_ASSERTION_SCHEMA,
  COP_EVIDENCE_RELATION_SCHEMA,
  createTraceRef,
  validateTraceRef,
  traceRefFromCopEvent,
  traceDescriptorFromCopEvent,
  traceRefFromCopArtifact,
  createExternalTraceRef,
  createTraceDescriptor,
  validateTraceDescriptor,
  createAssertion,
  reviseAssertion,
  validateAssertion,
  createEvidenceRelation,
  validateEvidenceRelation,
  createTraceObservationEvent,
  EvidenceGraph,
  extractConsolidationTraceRefs,
  loadTraceRefSchemaDocument,
  loadTraceDescriptorSchemaDocument,
  loadAssertionSchemaDocument,
  loadEvidenceRelationSchemaDocument,
} from "../src/trace.js";
import { createCopEventEnvelope, validateCopEventEnvelope } from "../src/cop-event-envelope.js";
import { createLocalTraceConsolidationReceipt } from "../src/local-trace-consolidation.js";

describe("COP 2.x Trace-Centric Architecture Primitives (Issue #61, #63)", () => {
  describe("1. Event-as-Trace (Native Procedural Trace)", () => {
    it("creates a standalone TraceRef with explicit integrity and locator", () => {
      const ref = createTraceRef({
        trace_id: "urn:isbn:0451450523",
        target_type: "external",
        integrity: "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        locator: "https://example.org/books/0451450523",
      });
      expect(ref.schema).toBe(COP_TRACE_REF_SCHEMA);
      expect(validateTraceRef(ref).ok).toBe(true);
    });

    it("addresses a COP Event as a TraceRef without duplicating payload", () => {
      const event = createCopEventEnvelope({
        event_type: "ChatMessageSent",
        topic_id: "topic:jhn-chat-42",
        topic_seq: 1,
        actor_ref: "agent:jhn",
        subject_ref: "twin:jhn",
        payload: {
          text: "Bonjour Minesteggio",
          sender: "human:jhn",
        },
      });

      const traceRef = traceRefFromCopEvent(event);

      expect(traceRef.schema).toBe(COP_TRACE_REF_SCHEMA);
      expect(traceRef.target_type).toBe("cop_event");
      expect(traceRef.trace_id).toBe(`cop:event:${event.event_id}`);
      expect(traceRef.integrity).toBe(event.payload_hash);
      expect(traceRef.locator).toBe("topic:topic:jhn-chat-42");
      expect(traceRef.resolution_hints?.topic_id).toBe("topic:jhn-chat-42");
      expect(traceRef.resolution_hints?.topic_seq).toBe(1);
      expect(traceRef.resolution_hints?.event_type).toBe("ChatMessageSent");

      // Invariant: TraceRef does NOT store or duplicate the event payload
      expect(traceRef).not.toHaveProperty("payload");

      const validation = validateTraceRef(traceRef);
      expect(validation.ok).toBe(true);
    });

    it("generates a TraceDescriptor from a COP Event without payload materialization", () => {
      const event = createCopEventEnvelope({
        event_type: "ToolInvoked",
        topic_id: "topic:task-100",
        topic_seq: 5,
        actor_ref: "handler:weather",
        origin_ref: "capability:get_weather",
        payload: {
          city: "Bastia",
          temperature_c: 24,
        },
      });

      const descriptor = traceDescriptorFromCopEvent(event);

      expect(descriptor.schema).toBe(COP_TRACE_DESCRIPTOR_SCHEMA);
      expect(descriptor.kind).toBe("ToolInvoked");
      expect(descriptor.origin).toBe("capability:get_weather");
      expect(descriptor.integrity).toBe(event.payload_hash);
      expect(descriptor.custody).toBe("cop:store");
      expect(descriptor.meta?.topic_id).toBe("topic:task-100");
      expect(descriptor.meta?.topic_seq).toBe(5);

      // Invariant: TraceDescriptor does not duplicate payload or claim truth
      expect(descriptor).not.toHaveProperty("payload");
      expect(descriptor).not.toHaveProperty("claim");

      const validation = validateTraceDescriptor(descriptor);
      expect(validation.ok).toBe(true);
    });

    it("addresses a COP Artifact as a TraceRef", () => {
      const artifact = {
        id: "art:analysis-report-01",
        type: "text/markdown",
        schemaVersion: "1.0",
        hash: "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        uri: "cop://artifacts/art:analysis-report-01",
      };

      const traceRef = traceRefFromCopArtifact(artifact);
      expect(traceRef.target_type).toBe("cop_artifact");
      expect(traceRef.trace_id).toBe("cop:artifact:art:analysis-report-01");
      expect(traceRef.integrity).toBe(artifact.hash);
      expect(traceRef.locator).toBe(artifact.uri);
      expect(validateTraceRef(traceRef).ok).toBe(true);
    });
  });

  describe("2. External Trace Registration & Ingestion", () => {
    it("registers external trace without claiming COP origination", () => {
      // 1. External trace metadata (e.g. Git commit or Senat public record)
      const externalRef = createExternalTraceRef({
        trace_id: "git:commit:5dd1dc89b8830176d6345862d2a4505fcfecb2a4",
        locator:
          "https://github.com/JeanHuguesRobert/barons-Mariani/commit/5dd1dc89b8830176d6345862d2a4505fcfecb2a4",
        integrity: "sha256:5dd1dc89b8830176d6345862d2a4505fcfecb2a4000000000000000000000000",
        resolution_hints: {
          repo: "JeanHuguesRobert/barons-Mariani",
          branch: "main",
        },
      });

      const descriptor = createTraceDescriptor({
        trace_ref: externalRef,
        kind: "git_commit",
        origin: "https://github.com/JeanHuguesRobert/barons-Mariani",
        observed_at: "2026-09-06T06:00:00.000Z",
        occurred_at: "2026-09-06T05:59:30.000Z",
        integrity: "sha256:5dd1dc89b8830176d6345862d2a4505fcfecb2a4000000000000000000000000",
        visibility: "open",
        custody: "github.com",
      });

      // 2. Record COP observation Event
      const obsEvent = createTraceObservationEvent({
        trace_ref: externalRef,
        trace_descriptor: descriptor,
        observer_ref: "agent:jhn",
        topic_id: "topic:external-audit",
        mandate_ref: "mandate:mnd-jhn-2026@v1",
        logical_agent_ref: "agent:jhn",
      });

      const eventValidation = validateCopEventEnvelope(obsEvent);
      expect(eventValidation.ok).toBe(true);

      // Invariant: origin_ref points to external trace, and cop_originated is explicitly false
      expect(obsEvent.origin_ref).toBe(externalRef.trace_id);
      expect(obsEvent.payload.cop_originated).toBe(false);
      expect(obsEvent.payload.trace_ref.trace_id).toBe(externalRef.trace_id);

      // 3. Connect external trace to an Assertion via EvidenceRelation
      const assertion = createAssertion({
        assertion_id: "ast:senatoriales-doctrine-updated",
        claim: {
          topic: "Rossignol Principle Integration",
          status: "published",
        },
        epistemic_status: "observed",
        asserted_by: "agent:jhn",
      });

      const evidence = createEvidenceRelation({
        relation_type: "supports",
        trace_ref: externalRef,
        assertion_id: assertion.assertion_id,
        strength: "conclusive",
        justification: "Commit 5dd1dc8 updates principe_rossignol.md with 4 incarnation echelons.",
        asserted_by: "agent:jhn",
      });

      expect(validateEvidenceRelation(evidence).ok).toBe(true);
      expect(evidence.trace_ref.trace_id).toBe(externalRef.trace_id);
      expect(evidence.assertion_id).toBe(assertion.assertion_id);
    });
  });

  describe("3. Contradiction Preservation (Non-Destructive Coexistence)", () => {
    it("allows contradictory evidence relations to coexist without overwriting each other", () => {
      const graph = new EvidenceGraph();

      const assertion = createAssertion({
        assertion_id: "ast:weather-claim-bastia",
        claim: "It rained in Bastia on 2026-09-05",
        epistemic_status: "hypothesized",
        asserted_by: "agent:weather-analyst",
      });

      // Trace A: Satellite sensor reading indicates rain
      const traceA = createExternalTraceRef({
        trace_id: "trace:sensor:satellite-meteo-01",
        locator: "urn:meteo:sat:2026-09-05:bastia",
      });
      const relationSupports = createEvidenceRelation({
        relation_id: "evr:supports-rain",
        relation_type: "supports",
        trace_ref: traceA,
        assertion_id: assertion.assertion_id,
        strength: "plausible",
        justification: "Infrared radar shows precipitation cloud over Biguglia/Bastia.",
        asserted_by: "agent:weather-analyst",
      });

      // Trace B: Ground rain gauge indicates 0.0mm
      const traceB = createExternalTraceRef({
        trace_id: "trace:sensor:ground-gauge-bastia-port",
        locator: "urn:meteo:gauge:port-de-bastia",
      });
      const relationContradicts = createEvidenceRelation({
        relation_id: "evr:contradicts-rain",
        relation_type: "contradicts",
        trace_ref: traceB,
        assertion_id: assertion.assertion_id,
        strength: "strong",
        justification: "Port de Bastia ground station recorded 0.0mm accumulation.",
        asserted_by: "agent:ground-auditor",
      });

      // Trace C: Barometric sensor provides context
      const traceC = createExternalTraceRef({
        trace_id: "trace:sensor:barometer-bastia",
      });
      const relationContext = createEvidenceRelation({
        relation_id: "evr:context-barometer",
        relation_type: "contextualizes",
        trace_ref: traceC,
        assertion_id: assertion.assertion_id,
        strength: "weak",
        justification: "Pressure dropped rapidly at 14:00.",
        asserted_by: "agent:analyst",
      });

      // Add all to graph
      graph.addRelation(relationSupports);
      graph.addRelation(relationContradicts);
      graph.addRelation(relationContext);

      // Query evidence for the assertion
      const evidence = graph.getRelationsForAssertion(assertion.assertion_id);

      // Invariant: Both contradictory relationships survive intact!
      expect(evidence.supports).toHaveLength(1);
      expect(evidence.contradicts).toHaveLength(1);
      expect(evidence.contextualizes).toHaveLength(1);
      expect(evidence.all).toHaveLength(3);

      expect(evidence.supports[0].relation_id).toBe("evr:supports-rain");
      expect(evidence.contradicts[0].relation_id).toBe("evr:contradicts-rain");
      expect(evidence.contextualizes[0].relation_id).toBe("evr:context-barometer");

      // Query by trace
      const traceARelations = graph.getRelationsForTrace(traceA.trace_id);
      expect(traceARelations).toHaveLength(1);
      expect(traceARelations[0].relation_type).toBe("supports");
    });
  });

  describe("4. Consolidation Provenance Preservation", () => {
    it("retains source references and integrity without authority laundering", () => {
      const workingEvent1 = createCopEventEnvelope({
        event_id: "evt-work-001",
        event_type: "DraftStepExecuted",
        topic_id: "topic:scratch-42",
        topic_seq: 1,
        actor_ref: "agent:jhn",
        payload: { step: 1, draft: "Drafting constitution notes" },
      });

      const workingEvent2 = createCopEventEnvelope({
        event_id: "evt-work-002",
        event_type: "DraftStepExecuted",
        topic_id: "topic:scratch-42",
        topic_seq: 2,
        actor_ref: "agent:jhn",
        payload: { step: 2, draft: "Refining mandate invariants" },
      });

      const receipt = createLocalTraceConsolidationReceipt({
        consolidation_id: "cons-2026-09-06-001",
        local_store_ref: "local-store:agent-jhn-worker-1",
        retained_until: "2026-09-20T00:00:00.000Z",
        events: [workingEvent1, workingEvent2],
        summary: {
          outcome: "synthesized_doctrine",
          key_findings: ["TraceRef must not copy payload"],
        },
        artifact_refs: ["cop:artifact:art-mandate-v2"],
      });

      const traceRefs = extractConsolidationTraceRefs(receipt);
      expect(traceRefs).toHaveLength(2);

      const consolidationRef = traceRefs[0];
      expect(consolidationRef.trace_id).toBe("cop:consolidation:cons-2026-09-06-001");
      expect(consolidationRef.integrity).toBe(receipt.local_trace.integrity_hash);
      expect(consolidationRef.resolution_hints?.first_event_id).toBe("evt-work-001");
      expect(consolidationRef.resolution_hints?.last_event_id).toBe("evt-work-002");
      expect(consolidationRef.resolution_hints?.event_count).toBe(2);

      const artifactRef = traceRefs[1];
      expect(artifactRef.trace_id).toBe("cop:artifact:art-mandate-v2");
      expect(artifactRef.target_type).toBe("cop_artifact");

      // Validation
      expect(validateTraceRef(consolidationRef).ok).toBe(true);
      expect(validateTraceRef(artifactRef).ok).toBe(true);
    });
  });

  describe("5. Stable Assertion Revision Tracking", () => {
    it("maintains stable identity and supersedes link across revisions", () => {
      const v1 = createAssertion({
        assertion_id: "ast:sovereignty-doctrine",
        revision: 1,
        claim: { status: "draft", autonomy_score: 0.7 },
        epistemic_status: "proposed",
        asserted_by: "agent:jhn",
      });

      const v2 = reviseAssertion(v1, {
        claim: { status: "ratified", autonomy_score: 0.95 },
        epistemic_status: "decided",
        asserted_by: "principal:jhn",
      });

      expect(v2.assertion_id).toBe(v1.assertion_id);
      expect(v2.revision).toBe(2);
      expect(v2.supersedes_id).toBe("ast:sovereignty-doctrine@r1");
      expect(v2.epistemic_status).toBe("decided");
      expect(v2.asserted_by).toBe("principal:jhn");
      expect(validateAssertion(v2).ok).toBe(true);
    });
  });

  describe("6. Schema Validation & Malformed Input Rejection", () => {
    it("validates valid JSON schemas and rejects malformed objects", () => {
      // TraceRef
      expect(validateTraceRef({}).ok).toBe(false);
      expect(validateTraceRef({ schema: COP_TRACE_REF_SCHEMA }).ok).toBe(false);
      expect(
        validateTraceRef({
          schema: COP_TRACE_REF_SCHEMA,
          trace_id: "test",
          target_type: "invalid_type",
        }).ok
      ).toBe(false);
      expect(
        validateTraceRef({
          schema: COP_TRACE_REF_SCHEMA,
          trace_id: "test",
          target_type: "external",
          integrity: "not-a-sha256",
        }).ok
      ).toBe(false);

      // Assertion
      expect(validateAssertion({}).ok).toBe(false);
      expect(
        validateAssertion({
          schema: COP_ASSERTION_SCHEMA,
          assertion_id: "ast:1",
          revision: -1,
          claim: "test",
          epistemic_status: "invalid",
          asserted_by: "agent",
          asserted_at: "2026-09-06T00:00:00Z",
        }).ok
      ).toBe(false);

      // EvidenceRelation
      expect(validateEvidenceRelation({}).ok).toBe(false);
      expect(
        validateEvidenceRelation({
          schema: COP_EVIDENCE_RELATION_SCHEMA,
          relation_id: "evr:1",
          relation_type: "arbitrary_relation",
          trace_ref: { schema: COP_TRACE_REF_SCHEMA, trace_id: "t1", target_type: "external" },
          assertion_id: "ast:1",
          asserted_by: "agent",
          recorded_at: "2026-09-06T00:00:00Z",
        }).ok
      ).toBe(false);
    });

    it("loads schema documents from filesystem without error", () => {
      const traceRefSchema = loadTraceRefSchemaDocument();
      expect(traceRefSchema.title).toBe("cop.trace-ref/v1");

      const traceDescSchema = loadTraceDescriptorSchemaDocument();
      expect(traceDescSchema.title).toBe("cop.trace-descriptor/v1");

      const assertionSchema = loadAssertionSchemaDocument();
      expect(assertionSchema.title).toBe("cop.assertion/v1");

      const evidenceSchema = loadEvidenceRelationSchemaDocument();
      expect(evidenceSchema.title).toBe("cop.evidence-relation/v1");
    });
  });
});
