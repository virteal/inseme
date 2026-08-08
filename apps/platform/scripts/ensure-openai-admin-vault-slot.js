#!/usr/bin/env node
/**
 * Prepare JHN vault slot for OpenAI Admin API key (usage/costs).
 * Does NOT invent a secret — leaves value empty for principal to fill.
 *
 * Usage (from apps/platform or monorepo with JHN SUPABASE_* in inseme/.env):
 *   node scripts/ensure-openai-admin-vault-slot.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../..");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnv(path.join(monorepoRoot, ".env"));
loadEnv(path.join(monorepoRoot, "apps/platform/.env"));

const VAULT_KEY = "openai_admin_key";
const ENV_NAME = "OPENAI_ADMIN_KEY";
const DESCRIPTION =
  "OpenAI Organization Admin API key (usage/costs only; not for chat). Create at https://platform.openai.com/settings/organization/admin-keys — fill value manually.";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!url || !service) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "missing_supabase_bootstrap",
      need: ["SUPABASE_URL or VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    })
  );
  process.exit(1);
}

const sb = createClient(url, service);
const now = new Date().toISOString();

const { data: existing, error: readErr } = await sb
  .from("instance_config")
  .select("key,value,is_secret,category,description,updated_at")
  .eq("key", VAULT_KEY)
  .maybeSingle();

if (readErr) {
  console.error(JSON.stringify({ ok: false, error: readErr.message }));
  process.exit(1);
}

if (existing) {
  // Refresh metadata; do not wipe a value the principal already set
  const patch = {
    is_secret: true,
    is_public: false,
    category: "secrets",
    description: DESCRIPTION,
    updated_at: now,
  };
  const { error: upErr } = await sb.from("instance_config").update(patch).eq("key", VAULT_KEY);
  if (upErr) {
    console.error(JSON.stringify({ ok: false, error: upErr.message }));
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: "metadata_refreshed",
        vault_key: VAULT_KEY,
        env: ENV_NAME,
        value_present: Boolean(String(existing.value || "").trim()),
        supabase_host: new URL(url).host,
        note: existing.value
          ? "Value already set — left unchanged."
          : "Value empty — fill in Supabase instance_config or set OPENAI_ADMIN_KEY in inseme/.env then push-env-to-vault --apply.",
      },
      null,
      2
    )
  );
  process.exit(0);
}

const row = {
  key: VAULT_KEY,
  value: "",
  category: "secrets",
  description: DESCRIPTION,
  is_secret: true,
  is_public: false,
  version: 1,
  created_at: now,
  updated_at: now,
};

const { error: insErr } = await sb.from("instance_config").insert(row);
if (insErr) {
  console.error(JSON.stringify({ ok: false, error: insErr.message }));
  process.exit(1);
}

// Ensure empty slot in workstation .env for documentation (no fake secret)
const envPath = path.join(monorepoRoot, ".env");
if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, "utf8");
  if (!/^\s*OPENAI_ADMIN_KEY\s*=/m.test(text)) {
    const block = `\n# OpenAI Organization Admin API (usage/costs only — not chat). Fill then: push-env-to-vault --apply\nOPENAI_ADMIN_KEY=\n`;
    fs.appendFileSync(envPath, block, "utf8");
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      action: "inserted_empty_slot",
      vault_key: VAULT_KEY,
      env: ENV_NAME,
      value_present: false,
      supabase_host: new URL(url).host,
      how_to_fill: [
        "1. Create Admin key: https://platform.openai.com/settings/organization/admin-keys",
        "2a. Supabase → instance_config → openai_admin_key → paste value (is_secret=true)",
        "2b. Or set OPENAI_ADMIN_KEY=sk-admin-… in inseme/.env then: node scripts/push-env-to-vault.js --apply",
        "3. Usage: GET https://api.openai.com/v1/organization/costs?start_time=<unix> with Authorization: Bearer $OPENAI_ADMIN_KEY",
      ],
    },
    null,
    2
  )
);
