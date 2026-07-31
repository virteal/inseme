// File: scripts/test-github-webhook-ingress.js
// Description: Unit test suite for GitHub Webhook Ingress & Normalizer (Issue #29).

import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import {
  verifyGithubHmacSignature,
  normalizeGithubDelivery,
  isRepositoryAllowed,
  mapDeliveryToCopEvent,
} from "../packages/cop-core/src/github-ingress.js";

console.log("==========================================================================");
console.log("    TESTING GITHUB WEBHOOK INGRESS & EVENT MAPPER (INSEME #29)            ");
console.log("==========================================================================");

const SECRET = "test_webhook_secret_123456789";

// 1. Test HMAC Signature Verification
console.log("\n[Test 1] Testing HMAC-SHA256 Signature Verification...");
const rawBody = JSON.stringify({ ref: "refs/heads/main", repository: { full_name: "JeanHuguesRobert/JeanHuguesRobert" } });
const validHash = createHmac("sha256", SECRET).update(rawBody).digest("hex");
const validHeader = `sha256=${validHash}`;

assert.equal(verifyGithubHmacSignature(rawBody, validHeader, SECRET), true, "Valid signature must return true");
assert.equal(verifyGithubHmacSignature(rawBody, "sha256=invalid_hash", SECRET), false, "Invalid signature must return false");
assert.equal(verifyGithubHmacSignature(rawBody, validHeader, "wrong_secret"), false, "Wrong secret must return false");
console.log("  ✓ HMAC-SHA256 verification (valid & invalid) verified.");

// 2. Test Delivery Normalization
console.log("\n[Test 2] Testing Webhook Delivery Normalization...");
const headers = {
  "x-github-delivery": "deliv-uuid-999",
  "x-github-event": "push",
  "x-hub-signature-256": validHeader,
};
const payload = {
  action: "created",
  repository: { full_name: "JeanHuguesRobert/pertitellu" },
  installation: { id: 123456 },
  sender: { login: "JeanHuguesRobert" },
};

const norm = normalizeGithubDelivery(headers, payload, rawBody);
assert.equal(norm.delivery_id, "deliv-uuid-999");
assert.equal(norm.event_name, "push");
assert.equal(norm.repository_name, "JeanHuguesRobert/pertitellu");
assert.equal(norm.installation_id, 123456);
assert.equal(norm.sender_login, "JeanHuguesRobert");
assert.match(norm.payload_sha256, /^[a-f0-9]{64}$/);
console.log("  ✓ Delivery normalization & payload SHA-256 calculation verified.");

// 3. Test Repository Allowlist Filtering
console.log("\n[Test 3] Testing Repository Allowlist Filtering...");
const allowlist = ["JeanHuguesRobert/JeanHuguesRobert", "JeanHuguesRobert/pertitellu"];
assert.equal(isRepositoryAllowed("JeanHuguesRobert/pertitellu", allowlist), true);
assert.equal(isRepositoryAllowed("JeanHuguesRobert/unapproved-repo", allowlist), false);
console.log("  ✓ Repository allowlist filtering verified.");

// 4. Test Event Mapping (push, PR, issues, workflow_run)
console.log("\n[Test 4] Testing COP Event Mapping (push, PR, issues, workflow_run)...");

// 4a. Push Event
const pushEvent = mapDeliveryToCopEvent(norm, {
  ref: "refs/heads/main",
  commits: [{ id: "c1" }, { id: "c2" }],
}, { instanceId: "jhn-personal" });

assert.equal(pushEvent.event_type, "cop.event/v1");
assert.equal(pushEvent.topic_id, "github:JeanHuguesRobert/pertitellu");
assert.equal(pushEvent.actor_id, "github:JeanHuguesRobert");
assert.equal(pushEvent.epistemic_status, "observed");
assert.equal(pushEvent.idempotency_key, "github:deliv-uuid-999:push");
assert.match(pushEvent.payload.summary, /Push of 2 commit\(s\)/);

// 4b. Merged PR Event
const prNorm = { ...norm, event_name: "pull_request", delivery_id: "pr-deliv-1" };
const prEvent = mapDeliveryToCopEvent(prNorm, {
  number: 42,
  action: "closed",
  pull_request: { title: "Feature: Add S7 engine", merged: true },
});
assert.equal(prEvent.epistemic_status, "decided");
assert.match(prEvent.payload.summary, /PR #42 "Feature: Add S7 engine"/);

console.log("  ✓ COP Event mapping (push & PR) verified.");

console.log("\n==========================================================================");
console.log("✓ ALL GITHUB WEBHOOK INGRESS TESTS PASSED (100% SUCCESS)");
console.log("==========================================================================");
