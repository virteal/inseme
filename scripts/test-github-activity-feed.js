#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  evaluateGithubIngress,
  GITHUB_EVENT_SUBSCRIPTIONS,
  mapDeliveryToCopEvents,
  isEventSubscribed,
} from "../packages/cop-core/src/github-ingress.js";
import {
  buildActivityFeed,
  formatActivityLine,
} from "../packages/cop-core/src/github-activity-feed.js";
import { createMemoryCopEventStore } from "../packages/cop-core/src/cop-event-spool.js";
import { createCopEventEnvelope } from "../packages/cop-core/src/cop-event-envelope.js";
import { replayDeliveryIntoStore } from "../packages/cop-core/src/github-delivery-replay.js";
import { reconcileGithubObservation } from "../packages/cop-core/src/github-reconcile.js";
import { createHmac } from "node:crypto";

console.log("==========================================================================");
console.log("    GITHUB ACTIVITY FEED + INGRESS (#29)");
console.log("==========================================================================");

const SECRET = "test_webhook_secret_123456789";

console.log("\n[Test 1] Subscription set...");
assert.ok(GITHUB_EVENT_SUBSCRIPTIONS.includes("ping"));
assert.ok(GITHUB_EVENT_SUBSCRIPTIONS.includes("pull_request_review"));
assert.equal(isEventSubscribed("push"), true);
assert.equal(isEventSubscribed("gollum"), false);
console.log(`  ✓ ${GITHUB_EVENT_SUBSCRIPTIONS.length} subscribed event types`);

console.log("\n[Test 2] evaluateGithubIngress HMAC + allowlist...");
const body = JSON.stringify({
  action: "opened",
  repository: { full_name: "JeanHuguesRobert/inseme" },
  sender: { login: "alice" },
  issue: { number: 29, title: "webhook" },
});
const sig = "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
const headers = {
  "x-github-delivery": "del-99",
  "x-github-event": "issues",
  "x-hub-signature-256": sig,
};
const bad = evaluateGithubIngress({
  headers: { ...headers, "x-hub-signature-256": "sha256:dead" },
  payload: JSON.parse(body),
  rawBody: body,
  webhookSecret: SECRET,
  allowlist: ["JeanHuguesRobert/inseme"],
});
assert.equal(bad.status, 401);

const good = evaluateGithubIngress({
  headers,
  payload: JSON.parse(body),
  rawBody: body,
  webhookSecret: SECRET,
  allowlist: ["JeanHuguesRobert/inseme"],
  options: { instanceId: "jhn-personal" },
});
assert.equal(good.status, 202);
assert.equal(good.events.length, 1);
assert.equal(good.events[0].payload.activity_kind, "work_proposal");

const denied = evaluateGithubIngress({
  headers: {
    ...headers,
    "x-github-delivery": "del-100",
    "x-hub-signature-256":
      "sha256=" +
      createHmac("sha256", SECRET)
        .update(
          JSON.stringify({
            repository: { full_name: "other/repo" },
            sender: { login: "x" },
          })
        )
        .digest("hex"),
  },
  payload: { repository: { full_name: "other/repo" }, sender: { login: "x" } },
  rawBody: JSON.stringify({
    repository: { full_name: "other/repo" },
    sender: { login: "x" },
  }),
  webhookSecret: SECRET,
  allowlist: ["JeanHuguesRobert/inseme"],
});
// re-sign properly
const deniedBody = JSON.stringify({
  repository: { full_name: "other/repo" },
  sender: { login: "x" },
});
const deniedEval = evaluateGithubIngress({
  headers: {
    "x-github-delivery": "del-100",
    "x-github-event": "push",
    "x-hub-signature-256":
      "sha256=" + createHmac("sha256", SECRET).update(deniedBody).digest("hex"),
  },
  payload: JSON.parse(deniedBody),
  rawBody: deniedBody,
  webhookSecret: SECRET,
  allowlist: ["JeanHuguesRobert/inseme"],
});
assert.equal(deniedEval.outcome, "ignored_allowlist");
assert.equal(deniedEval.events.length, 0);
console.log("  ✓ HMAC, map, allowlist");

console.log("\n[Test 3] Full subscription mappers produce events...");
for (const name of GITHUB_EVENT_SUBSCRIPTIONS) {
  const [ev] = mapDeliveryToCopEvents(
    {
      delivery_id: `d-${name}`,
      event_name: name,
      action: "opened",
      repository_name: "JeanHuguesRobert/inseme",
      sender_login: "bob",
      installation_id: 1,
      payload_sha256: "ab",
    },
    { action: "opened", repository: { full_name: "JeanHuguesRobert/inseme" } },
    { instanceId: "jhn-personal" }
  );
  assert.ok(ev.payload.summary);
  assert.ok(ev.payload.activity_kind);
}
console.log("  ✓ all subscribed types map");

console.log("\n[Test 4] Activity feed projection...");
const store = createMemoryCopEventStore();
for (const partial of good.events) {
  store.append(createCopEventEnvelope(partial));
}
// sealed event should redact for restricted viewer
store.append(
  createCopEventEnvelope({
    topic_id: "github:JeanHuguesRobert/inseme",
    visibility: "sealed",
    payload: {
      summary: "secret",
      activity_kind: "security",
      github_event: "secret_scanning_alert",
      repository: "JeanHuguesRobert/inseme",
    },
    epistemic_status: "observed",
  })
);
const feed = buildActivityFeed(store, { viewer_clearance: "restricted", limit: 20 });
assert.equal(feed.schema, "cop.activity-feed.v1");
assert.ok(feed.count >= 1);
assert.ok(formatActivityLine(feed.items[0]).includes("["));
const sealedItem = feed.items.find((i) => i.activity_kind === "security");
if (sealedItem) {
  assert.equal(sealedItem.payload_redacted, true);
}
console.log("  ✓ feed + redaction");

console.log("\n[Test 5] Delivery replay...");
const replayStore = createMemoryCopEventStore();
const rep = replayDeliveryIntoStore(good.delivery, JSON.parse(body), replayStore, {
  instanceId: "jhn-personal",
});
assert.equal(rep.ok, true);
assert.equal(rep.event_count, 1);
const rep2 = replayDeliveryIntoStore(good.delivery, JSON.parse(body), replayStore, {
  instanceId: "jhn-personal",
});
assert.equal(rep2.duplicates, 1);
console.log("  ✓ replay + idempotent");

console.log("\n[Test 6] Reconcile gap detection...");
const report = await reconcileGithubObservation({
  repositories: ["JeanHuguesRobert/inseme"],
  knownDeliveries: [
    {
      delivery_id: "del-99",
      repository_name: "JeanHuguesRobert/inseme",
      event_name: "issues",
      received_at: new Date().toISOString(),
    },
  ],
  listRecentEvents: async () => [
    { id: "missing-1", type: "PushEvent", created_at: new Date().toISOString() },
  ],
});
assert.equal(report.schema, "cop.github-reconcile.v1");
assert.ok(report.gaps.length >= 1);
console.log("  ✓ reconcile reports gaps");

console.log("\n==========================================================================");
console.log("✓ ALL #29 ACTIVITY / INGRESS TESTS PASSED");
console.log("==========================================================================");
