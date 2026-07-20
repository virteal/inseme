#!/usr/bin/env node
// scripts/push-env-to-vault.js
//
// Push workstation secrets from inseme/.env into instance_config (vault)
// so Netlify edge/backend can load them via service-role client.
//
// Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for the *target* project (JHN).
//
// Usage:
//   node scripts/push-env-to-vault.js           # dry-run plan
//   node scripts/push-env-to-vault.js --apply   # write vault
//   node scripts/push-env-to-vault.js --apply --verbose

import minimist from "minimist";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = minimist(process.argv.slice(2), {
  boolean: ["apply", "dry-run", "verbose", "help", "force"],
  alias: { h: "help", n: "dry-run", v: "verbose" },
});

if (argv.help) {
  console.log(`Usage: node scripts/push-env-to-vault.js [--apply] [--verbose]

Source of truth: monorepo .env (and apps/platform/.env via dotenv load order).
Target: public.instance_config on SUPABASE_URL (must be JHN for dogfood).

Dry-run by default. --apply performs upsert with is_secret inference.
`);
  process.exit(0);
}

const isApply = Boolean(argv.apply) && !argv["dry-run"];

function mask(v) {
  if (v == null || v === "") return "(empty)";
  const s = String(v);
  if (s.length <= 10) return "***";
  return s.slice(0, 6) + "…(" + s.length + ")";
}

async function main() {
  const { pushEnvSecretsToVault, loadConfig, getConfig, createSupabaseClient } = await import(
    "./lib/config.js"
  );

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const hasService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("🎯 Target project URL:", url || "(missing)");
  console.log("🔑 SERVICE_ROLE present:", hasService ? "yes" : "NO");
  if (url && !String(url).includes("ndiysuhzmztatpxbkezn")) {
    console.warn("⚠️  URL does not look like JHN (ndiysuh…). Abort unless intentional.");
    if (!argv.force) {
      console.error("Pass --force to push to a non-JHN project.");
      process.exit(2);
    }
  }
  if (!hasService) {
    console.error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Fetch with:\n" +
        "  supabase projects api-keys --project-ref ndiysuhzmztatpxbkezn\n" +
        "and put it in inseme/.env"
    );
    process.exit(1);
  }

  // Probe client
  createSupabaseClient();

  await loadConfig(true);
  // loadConfig already attempts align when service role is set — but only on first cache.
  // Explicit apply path uses pushEnvSecretsToVault for a full pass.
  if (!isApply) {
    console.log("\nMode: DRY-RUN (no extra write beyond loadConfig align if any)");
    console.log("Run with --apply to force full .env → vault push.\n");
    // Show which secret-ish keys are now in vault vs env
    const sample = [
      "openai_api_key",
      "anthropic_api_key",
      "zai_api_key",
      "github_token",
      "axiom_token",
      "supabase_service_role_key",
      "supabase_anon_key",
      "supabase_url",
      "facebook_client_secret",
      "openrouter_api_key",
      "gradium_api_key",
      "cartesia_api_key",
      "context7_api_key",
      "legalize_api_key",
    ];
    console.log("Vault presence (masked):");
    for (const k of sample) {
      const v = getConfig(k);
      console.log(`  ${k}: ${v ? mask(v) : "(missing)"}`);
    }
    process.exit(0);
  }

  console.log("\nMode: APPLY — pushing .env → vault…");
  const summary = await pushEnvSecretsToVault();
  console.log("\n✅ Push complete");
  console.log(`   env keys considered: ${summary.envKeys}`);
  console.log(`   vault keys now:      ${summary.vaultKeys}`);
  console.log(`   secret-classified:   ${summary.secretKeys}`);
  if (argv.verbose) {
    console.log("   secret key names:", summary.secretKeyNames.join(", "));
  } else {
    console.log("   (use --verbose to list secret key names)");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
