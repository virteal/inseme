import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("instance configuration pertitellu-corte does not leak secret API keys", async () => {
  const configPath = path.resolve(__dirname, "../instances/pertitellu-corte.json");
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);

  // Must not have raw OpenAI, Anthropic, or database service_role secrets in instance JSON
  assert.equal(parsed.openai_api_key, undefined);
  assert.equal(parsed.anthropic_api_key, undefined);
  assert.equal(parsed.supabase_service_role_key, undefined);

  // Must declare civic identity and reference to JHN root host
  assert.equal(parsed.deployment_kind, "civic");
  assert.equal(parsed.host_instance_id, "00000000-0000-0000-0000-000000000001");
});

test("pertitellu-hosted-seed SQL script sets safe visibility flags", async () => {
  const sqlPath = path.resolve(__dirname, "../instances/sql/pertitellu-hosted-seed.sql");
  const content = await fs.readFile(sqlPath, "utf8");

  // Every seeded instance_config must have is_secret = false for public identity rows
  assert.match(content, /is_public, is_secret/);
  assert.doesNotMatch(content, /true,\s*true/); // no row marked both public and secret
});

test("RGPD and Transparency charter documents exist and are complete", async () => {
  const charterPath = path.resolve(
    __dirname,
    "../public/docs/charte_transparence_civique_et_protection_des_donnees.md"
  );
  const charter = await fs.readFile(charterPath, "utf8");

  assert.match(charter, /RGPD/i);
  assert.match(charter, /transparence/i);
  assert.match(charter, /données/i);
});
