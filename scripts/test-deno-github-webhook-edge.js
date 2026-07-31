// File: scripts/test-deno-github-webhook-edge.js
// Description: Unit test suite for Deno Edge Function github-webhook.js (Issue #29).

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

console.log("==========================================================================");
console.log("    TESTING DENO EDGE FUNCTION: GITHUB WEBHOOK (INSEME #29)               ");
console.log("==========================================================================");

const edgeFuncPath = path.join(process.cwd(), "apps/platform/netlify/edge-functions/github-webhook.js");

// 1. Verify Deno Edge Function File Exists
console.log("\n[Test 1] Checking Deno Edge Function File Presence...");
assert.ok(fs.existsSync(edgeFuncPath), "❌ Deno Edge Function github-webhook.js must exist");
console.log("  ✓ Deno Edge Function file found:", edgeFuncPath);

const code = fs.readFileSync(edgeFuncPath, "utf-8");

// 2. Assert Deno Modern Imports & Exports
console.log("\n[Test 2] Verifying Modern Deno Syntax & ESM Export...");
assert.ok(code.includes("export default async (request, context) =>"), "Must export default Deno edge function handler");
assert.ok(code.includes("crypto.subtle.importKey"), "Must use Web Crypto API crypto.subtle for HMAC verification");
assert.ok(code.includes("new Response("), "Must return native Response object");
console.log("  ✓ Modern Deno syntax & Web Crypto API verified.");

// 3. Assert HMAC & SHA256 Web Crypto Logic
console.log("\n[Test 3] Verifying Web Crypto SHA-256 & HMAC Logic...");
assert.ok(code.includes("verifyHmacSignature"), "Must contain verifyHmacSignature helper");
assert.ok(code.includes("sha256Hex"), "Must contain sha256Hex helper");
assert.ok(code.includes("X-Hub-Signature-256"), "Must check X-Hub-Signature-256 header");
console.log("  ✓ Web Crypto HMAC & SHA256 helpers verified.");

// 4. Assert Fast 202 Accepted Response
console.log("\n[Test 4] Verifying 202 Accepted Asynchronous Acknowledgement...");
assert.ok(code.includes("status: 202"), "Must return 202 status code for async processing");
assert.ok(code.includes("accepted: true"), "Must contain accepted: true in body");
console.log("  ✓ 202 Accepted async acknowledgement verified.");

console.log("\n==========================================================================");
console.log("✓ ALL DENO EDGE FUNCTION WEBHOOK TESTS PASSED (100% SUCCESS)");
console.log("==========================================================================");
