#!/usr/bin/env node
/**
 * Inseme #28 residual: envelope validation + memory store + NDJSON spool/replay.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createCopEventEnvelope,
  hashPayload,
  loadCopEventSchemaDocument,
  validateCopEventEnvelope,
} from "../packages/cop-core/src/cop-event-envelope.js";
import {
  createMemoryCopEventStore,
  createNdjsonCopEventSpool,
} from "../packages/cop-core/src/cop-event-spool.js";
import { mapDeliveryToCopEvent } from "../packages/cop-core/src/github-ingress.js";

console.log("==========================================================================");
console.log("    COP EVENT ENVELOPE + SPOOL / REPLAY (INSEME #28 residual)");
console.log("==========================================================================");

// --- Schema document ---
console.log("\n[Test 1] Schema document present...");
const schema = loadCopEventSchemaDocument();
assert.equal(schema.title, "cop.event/v1");
assert.ok(schema.required.includes("payload_hash"));
console.log("  ✓ schema cop.event.v1.json loads");

// --- Envelope create + validate ---
console.log("\n[Test 2] Envelope create + payload_hash...");
const env = createCopEventEnvelope({
  topic_id: "github:acme/demo",
  actor_id: "github:alice",
  origin_ref: "github:delivery:d1",
  epistemic_status: "observed",
  payload: { summary: "hello" },
  idempotency_key: "d1:push",
});
assert.equal(env.schema, "cop.event/v1");
assert.equal(env.payload_hash, hashPayload({ summary: "hello" }));
const ok = validateCopEventEnvelope(env);
assert.equal(ok.ok, true);
const badHash = { ...env, payload_hash: "sha256:" + "0".repeat(64) };
assert.equal(validateCopEventEnvelope(badHash).ok, false);
console.log("  ✓ hash + validation");

// --- Memory store append-only ---
console.log("\n[Test 3] Memory store topic order + idempotency...");
const store = createMemoryCopEventStore();
const a1 = store.append({
  topic_id: "t1",
  payload: { n: 1 },
  idempotency_key: "k1",
});
const a2 = store.append({
  topic_id: "t1",
  payload: { n: 2 },
  idempotency_key: "k2",
});
const dup = store.append({
  topic_id: "t1",
  payload: { n: 1 },
  idempotency_key: "k1",
});
assert.equal(a1.ok, true);
assert.equal(a1.event.topic.seq, 1);
assert.equal(a2.event.topic.seq, 2);
assert.equal(dup.duplicate, true);
assert.equal(dup.event.event_id, a1.event.event_id);
const topic = store.listTopic("t1");
assert.equal(topic.length, 2);
assert.deepEqual(
  topic.map((e) => e.topic.seq),
  [1, 2]
);
console.log("  ✓ topic seq + duplicate safe");

// --- Reject update/delete ---
console.log("\n[Test 4] UPDATE/DELETE forbidden...");
assert.throws(() => store.update(), /append-only/i);
assert.throws(() => store.delete(), /append-only/i);
console.log("  ✓ update/delete throw");

// --- Export / import ---
console.log("\n[Test 5] Export/import...");
const bundle = store.exportAll();
assert.equal(bundle.schema, "cop.event-log.export.v1");
assert.equal(bundle.events.length, 2);
const store2 = createMemoryCopEventStore();
const imp = store2.importAll(bundle);
assert.equal(imp.ok, true);
assert.equal(imp.appended, 2);
assert.equal(store2.listTopic("t1").length, 2);
const imp2 = store2.importAll(bundle);
assert.equal(imp2.duplicates, 2);
console.log("  ✓ export/import + reimport duplicates");

// --- NDJSON spool + replay ---
console.log("\n[Test 6] NDJSON spool enqueue + replayInto...");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cop-spool-"));
try {
  const spoolPath = path.join(tmp, "spool.ndjson");
  const spool = createNdjsonCopEventSpool({ filePath: spoolPath });
  const e1 = spool.enqueue({
    topic_id: "github:r/x",
    payload: { github_event: "push" },
    idempotency_key: "del-1",
  });
  const e2 = spool.enqueue({
    topic_id: "github:r/x",
    payload: { github_event: "issues" },
    idempotency_key: "del-2",
  });
  assert.equal(e1.ok, true);
  assert.equal(e2.ok, true);
  const durable = createMemoryCopEventStore();
  const replay = spool.replayInto(durable);
  assert.equal(replay.ok, true);
  assert.equal(replay.appended, 2);
  assert.equal(durable.listTopic("github:r/x").length, 2);
  // second replay is idempotent via idempotency keys
  const replay2 = spool.replayInto(durable);
  assert.equal(replay2.duplicates, 2);
  assert.equal(durable.listTopic("github:r/x").length, 2);
  console.log("  ✓ spool replay + idempotent re-replay");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// --- Mapper → envelope ---
console.log("\n[Test 7] GitHub mapper output normalizes to envelope...");
const delivery = {
  delivery_id: "abc-123",
  event_name: "push",
  action: null,
  repository_name: "JeanHuguesRobert/demo",
  installation_id: 1,
  sender_login: "alice",
};
const mapped = mapDeliveryToCopEvent(delivery, {
  ref: "refs/heads/main",
  commits: [{ id: "deadbeef" }],
  head_commit: { id: "deadbeef" },
});
const envelope = createCopEventEnvelope({
  ...mapped,
  idempotency_key: `${delivery.delivery_id}:${delivery.event_name}`,
});
const v = validateCopEventEnvelope(envelope);
assert.equal(v.ok, true, JSON.stringify(v.errors));
assert.equal(envelope.topic.id, "github:JeanHuguesRobert/demo");
console.log("  ✓ mapper → envelope valid");

console.log("\n==========================================================================");
console.log("✓ ALL COP EVENT SPOOL / ENVELOPE TESTS PASSED");
console.log("==========================================================================");
