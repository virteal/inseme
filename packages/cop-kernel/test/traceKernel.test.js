import test from "node:test";
import assert from "node:assert/strict";

import {
  COP_TRACE_REF_SCHEMA,
  COP_TRACE_DESCRIPTOR_SCHEMA,
  COP_ASSERTION_SCHEMA,
  COP_EVIDENCE_RELATION_SCHEMA,
  traceRefFromCopEvent,
  traceDescriptorFromCopEvent,
  createExternalTraceRef,
  createAssertion,
  reviseAssertion,
  createEvidenceRelation,
  EvidenceGraph,
  createCopEventEnvelope,
} from "@inseme/cop-core";

test("cop-kernel integration: Event-as-Trace without payload duplication", () => {
  const event = createCopEventEnvelope({
    event_type: "TaskStepExecuted",
    topic_id: "topic:kernel-demo-01",
    topic_seq: 1,
    actor_ref: "agent:jhn",
    payload: { action: "synthesize_plan", step: 1 },
  });

  const traceRef = traceRefFromCopEvent(event);
  assert.equal(traceRef.schema, COP_TRACE_REF_SCHEMA);
  assert.equal(traceRef.target_type, "cop_event");
  assert.equal(traceRef.trace_id, `cop:event:${event.event_id}`);
  assert.equal(traceRef.integrity, event.payload_hash);
  assert.equal(traceRef.payload, undefined);

  const descriptor = traceDescriptorFromCopEvent(event);
  assert.equal(descriptor.schema, COP_TRACE_DESCRIPTOR_SCHEMA);
  assert.equal(descriptor.kind, "TaskStepExecuted");
  assert.equal(descriptor.custody, "cop:store");
  assert.equal(descriptor.payload, undefined);
});

test("cop-kernel integration: External trace, Assertion and EvidenceRelation with contradiction survival", () => {
  const graph = new EvidenceGraph();

  // Assertion
  const assertion = createAssertion({
    assertion_id: "ast:kernel-governance-01",
    revision: 1,
    claim: "Provider cost is strictly bounded by mandate",
    epistemic_status: "declared",
    asserted_by: "agent:jhn",
  });
  assert.equal(assertion.schema, COP_ASSERTION_SCHEMA);

  // Supporting trace: local metering log
  const traceA = createExternalTraceRef({
    trace_id: "ext:metering:local-audit-log",
    locator: "file:///var/log/audit.jsonl",
  });
  const relSupports = createEvidenceRelation({
    relation_id: "evr:kernel-supports",
    relation_type: "supports",
    trace_ref: traceA,
    assertion_id: assertion.assertion_id,
    strength: "strong",
    justification: "All calls stayed within the micro-budget of 100 steps.",
    asserted_by: "agent:jhn",
  });

  // Contradicting trace: provider billing webhook
  const traceB = createExternalTraceRef({
    trace_id: "ext:provider:openai-usage-receipt",
    locator: "https://api.provider.com/usage/rec-99",
  });
  const relContradicts = createEvidenceRelation({
    relation_id: "evr:kernel-contradicts",
    relation_type: "contradicts",
    trace_ref: traceB,
    assertion_id: assertion.assertion_id,
    strength: "conclusive",
    justification: "External meter recorded out-of-band usage.",
    asserted_by: "agent:auditor",
  });

  graph.addRelation(relSupports);
  graph.addRelation(relContradicts);

  const query = graph.getRelationsForAssertion(assertion.assertion_id);
  assert.equal(query.supports.length, 1);
  assert.equal(query.contradicts.length, 1);
  assert.equal(query.all.length, 2);

  // Revise assertion following contradiction
  const revised = reviseAssertion(assertion, {
    claim: "Provider cost bounded except when out-of-band external meter triggers",
    epistemic_status: "inferred",
    asserted_by: "principal:jhn",
  });
  assert.equal(revised.assertion_id, assertion.assertion_id);
  assert.equal(revised.revision, 2);
  assert.equal(revised.supersedes_id, "ast:kernel-governance-01@r1");
});
