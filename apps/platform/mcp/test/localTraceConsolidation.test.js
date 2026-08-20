import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryCopEventStore } from "../../../../packages/cop-core/src/cop-event-spool.js";
import {
  createLocalTraceConsolidationReceipt,
  recordLocalTraceConsolidation,
} from "../../../../packages/cop-core/src/local-trace-consolidation.js";

test("local trace consolidation exports proof references instead of working payloads", () => {
  const store = createMemoryCopEventStore();
  const first = store.append({
    event_type: "assistant.delta",
    topic: { id: "run:local", seq: 1 },
    payload: { private_prompt: "not for the Corpus", delta: "intermediate" },
  }).event;
  const second = store.append({
    event_type: "john.run.completed",
    topic: { id: "run:local", seq: 2 },
    payload: { outcome: "partial", result: "consolidated result" },
  }).event;
  const receipt = createLocalTraceConsolidationReceipt({
    consolidation_id: "consolidation:1",
    local_store_ref: "sqlite://instance/jhn/cop-runtime.sqlite#run:local",
    retained_until: "2026-09-20T00:00:00.000Z",
    created_at: "2026-08-20T00:00:00.000Z",
    events: [first, second],
    summary: { outcome: "partial", result: "consolidated result" },
    artifact_refs: ["artifact:result:1"],
  });
  assert.equal(receipt.local_trace.event_count, 2);
  assert.equal(receipt.summary.result, "consolidated result");
  assert.equal(JSON.stringify(receipt).includes("not for the Corpus"), false);
  assert.match(receipt.local_trace.integrity_hash, /^sha256:/);

  const corpus = createMemoryCopEventStore();
  const publication = recordLocalTraceConsolidation(corpus, {
    receipt,
    principal_ref: "principal:jhn",
    mandate_ref: "mandate:jhn:1",
    logical_agent_ref: "agent:jhn",
    handler_instance_ref: "handler:john:local",
  });
  assert.equal(publication.ok, true);
  assert.equal(corpus.replay()[0].payload.kind, "LocalTraceConsolidation");
  assert.equal(JSON.stringify(corpus.replay()).includes("not for the Corpus"), false);
  assert.equal(
    recordLocalTraceConsolidation(corpus, {
      receipt,
      principal_ref: "principal:jhn",
      mandate_ref: "mandate:jhn:1",
      logical_agent_ref: "agent:jhn",
    }).duplicate,
    true
  );
});
