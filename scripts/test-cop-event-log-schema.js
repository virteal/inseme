// File: scripts/test-cop-event-log-schema.js
// Description: Unit test suite for COP Append-Only Event Log & Webhook Ingress (Issues #28 & #29).

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

console.log("==========================================================================");
console.log("    TESTING COP APPEND-ONLY EVENT LOG SCHEMA (INSEME #28 & #29)          ");
console.log("==========================================================================");

const migrationPath = path.join(
  process.cwd(),
  "apps/platform/supabase/migrations/20260731180000_cop_append_only_event_log.sql"
);

// 1. Verify Migration File Exists
console.log("\n[Test 1] Checking Migration File Presence...");
assert.ok(fs.existsSync(migrationPath), "❌ Migration SQL file must exist");
console.log("  ✓ Migration file found:", migrationPath);

const sqlContent = fs.readFileSync(migrationPath, "utf-8");

// 2. Assert Key Tables Defined
console.log("\n[Test 2] Verifying Core Table Definitions...");
assert.ok(
  sqlContent.includes("CREATE TABLE IF NOT EXISTS public.github_webhook_deliveries"),
  "Missing github_webhook_deliveries table"
);
assert.ok(
  sqlContent.includes("CREATE TABLE IF NOT EXISTS public.cop_event_log"),
  "Missing cop_event_log table"
);
assert.ok(
  sqlContent.includes("CREATE TABLE IF NOT EXISTS public.cop_spool_queue"),
  "Missing cop_spool_queue table"
);
console.log("  ✓ All 3 core tables (deliveries, event_log, spool_queue) defined.");

// 3. Assert Immutability Trigger Defined
console.log("\n[Test 3] Verifying Strict Append-Only Immutability Trigger...");
assert.ok(
  sqlContent.includes("enforce_cop_event_log_immutability"),
  "Missing immutability trigger function"
);
assert.ok(
  sqlContent.includes("BEFORE UPDATE OR DELETE ON public.cop_event_log"),
  "Immutability trigger must intercept UPDATE and DELETE"
);
console.log("  ✓ Strict append-only trigger intercepting UPDATE/DELETE verified.");

// Optional: envelope columns migration present
const envelopeMig = path.join(
  process.cwd(),
  "apps/platform/supabase/migrations/20260807120000_cop_event_log_envelope_columns.sql"
);
if (fs.existsSync(envelopeMig)) {
  const envSql = fs.readFileSync(envelopeMig, "utf8");
  assert.ok(envSql.includes("cop_event_append"), "Envelope migration must define cop_event_append");
  assert.ok(envSql.includes("payload_hash"), "Envelope migration must add payload_hash");
  assert.ok(envSql.includes("visibility"), "Envelope migration must add visibility");
  console.log("  ✓ Envelope columns + cop_event_append migration present.");
}

// 4. Assert Topic Sequence Uniqueness Constraint
console.log("\n[Test 4] Verifying Topic Sequence Uniqueness Constraint...");
assert.ok(
  sqlContent.includes("CONSTRAINT cop_event_log_topic_seq_uniq UNIQUE (topic_id, topic_seq)"),
  "Missing UNIQUE(topic_id, topic_seq) constraint"
);
console.log("  ✓ UNIQUE(topic_id, topic_seq) constraint verified.");

// 5. Assert RLS Policies Defined
console.log("\n[Test 5] Verifying Row Level Security Policies...");
assert.ok(
  sqlContent.includes("ALTER TABLE public.cop_event_log ENABLE ROW LEVEL SECURITY"),
  "RLS must be enabled on cop_event_log"
);
assert.ok(sqlContent.includes("FOR ALL TO service_role"), "Service role policy missing");
console.log("  ✓ RLS enabled and service_role policies verified.");

console.log("\n==========================================================================");
console.log("✓ ALL COP APPEND-ONLY EVENT LOG SCHEMA TESTS PASSED (100% SUCCESS)");
console.log("==========================================================================");
