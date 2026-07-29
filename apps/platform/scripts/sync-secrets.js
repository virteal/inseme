#!/usr/bin/env node
// scripts/sync-secrets.js
//
// Secret hygiene helper for workstation dogfooding.
//
// Source of truth (current policy): monorepo root inseme/.env
// Other locations (Claude settings, apps/*/.env, vault) are *copies* or scans.
//
// SAFETY: dry-run by default. Nothing is written unless you pass --apply.
// Vault writes require BOTH --apply and --vault (explicit double opt-in).
//
// Usage:
//   node scripts/sync-secrets.js                 # dry-run report
//   node scripts/sync-secrets.js --dry-run       # same (explicit)
//   node scripts/sync-secrets.js --apply         # write only to inseme/.env (merge)
//   node scripts/sync-secrets.js --apply --vault # also push mapped keys to instance_config
//   node scripts/sync-secrets.js --verbose

import minimist from "minimist";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = minimist(process.argv.slice(2), {
  boolean: ["dry-run", "apply", "vault", "verbose", "help"],
  alias: { h: "help", v: "verbose", n: "dry-run" },
  default: {
    // dry-run is the default whenever --apply is absent
  },
});

const isApply = Boolean(argv.apply);
const isDryRun = !isApply || Boolean(argv["dry-run"]);
const wantVault = Boolean(argv.vault);

if (argv.help) {
  console.log(`Usage: node scripts/sync-secrets.js [options]

Policy: inseme/.env is the source of truth for secrets (for now).
Scans other sources and reports drift. Writes only with --apply.

Options:
  (default)           Dry-run report only — no writes
  --dry-run, -n       Explicit dry-run (same as default without --apply)
  --apply             Merge newly found mapped keys into inseme/.env
  --vault             With --apply: also upload mapped keys to instance_config
  --verbose, -v       Detailed scanning output
  --help, -h          Show this help

Examples:
  node scripts/sync-secrets.js
  node scripts/sync-secrets.js --verbose
  node scripts/sync-secrets.js --apply
  node scripts/sync-secrets.js --apply --vault   # double opt-in
`);
  process.exit(0);
}

// ============================================================================
// 1) SECRET PATTERNS & MAPPINGS
// ============================================================================

const VAULT_KEY_MAPPING = {
  ANTHROPIC_API_KEY: "anthropic_api_key",
  ZAI_API_KEY: "zai_api_key",
  OPENAI_API_KEY: "openai_api_key",
  MISTRAL_API_KEY: "mistral_api_key",
  GEMINI_API_KEY: "gemini_api_key",
  GITHUB_TOKEN: "github_token",
  FACEBOOK_CLIENT_SECRET: "facebook_client_secret",
  FACEBOOK_TOKEN: "facebook_token",
  CLOUDFLARE_TUNNEL_TOKEN: "cloudflare_tunnel_token",
  NGROK_AUTH_TOKEN: "ngrok_auth_token",
  CONTEXT7_API_KEY: "context7_api_key",
  LEGALIZE_API_KEY: "legalize_api_key",
  AXIOM_TOKEN: "axiom_token",
  GRADIUM_API_KEY: "gradium_api_key",
  CARTESIA_API_KEY: "cartesia_api_key",
  // Cogentia system bearer (Magistral coding nodes / Agent CLI Gateway).
  // Edge functions have no FS access to inseme/.env — vault is their authority.
  COGENTIA_API_KEY: "cogentia_api_key",
  AGENT_JHN_WHATSAPP_ALLOWED_SELF_JID: "agent_jhn_whatsapp_allowed_self_jid",
  AGENT_JHN_WHATSAPP_MODE: "agent_jhn_whatsapp_mode",
  AGENT_JHN_WHATSAPP_SEND_ENABLED: "agent_jhn_whatsapp_send_enabled",
  AGENT_JHN_WHATSAPP_NOTICE_URL: "agent_jhn_whatsapp_notice_url",
  AGENT_JHN_WHATSAPP_STATE_DIR: "agent_jhn_whatsapp_state_dir",
  AGENT_JHN_WHATSAPP_PREFERRED_SELF_PEER: "agent_jhn_whatsapp_preferred_self_peer",
  AGENT_JHN_WHATSAPP_USAGE_GRANT_ID: "agent_jhn_whatsapp_grant_id",
  AGENT_JHN_WHATSAPP_GRANT_ID: "agent_jhn_whatsapp_grant_id",
  AGENT_JHN_WHATSAPP_MANDATE_ID: "agent_jhn_whatsapp_mandate_id",
  SUPABASE_URL: "supabase_url",
  VITE_SUPABASE_URL: "supabase_url",
  SUPABASE_ANON_KEY: "supabase_anon_key",
  VITE_SUPABASE_ANON_KEY: "supabase_anon_key",
  SUPABASE_SERVICE_ROLE_KEY: "supabase_service_role_key",
};

function mask(value) {
  if (!value) return "(empty)";
  if (value.length <= 12) return "***";
  return value.slice(0, 10) + "…(" + value.length + " chars)";
}

function scanClaudeSettings() {
  const results = {};
  const claudeDir = path.join(os.homedir(), ".claude");
  if (!fs.existsSync(claudeDir)) return results;

  const settingsFiles = ["settings.json", "settings.zai.json", "settings.anthropic.json"];

  for (const file of settingsFiles) {
    const filePath = path.join(claudeDir, file);
    if (!fs.existsSync(filePath)) continue;
    try {
      const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (content.env?.ANTHROPIC_AUTH_TOKEN) {
        const isZai = content.env.ANTHROPIC_BASE_URL?.includes("z.ai");
        if (isZai) results.ZAI_API_KEY = content.env.ANTHROPIC_AUTH_TOKEN;
        else results.ANTHROPIC_API_KEY = content.env.ANTHROPIC_AUTH_TOKEN;
      }
    } catch (err) {
      if (argv.verbose) console.warn(`  ⚠️  Failed to read ${file}: ${err.message}`);
    }
  }
  return results;
}

function scanEnvFile(filePath) {
  const results = {};
  if (!fs.existsSync(filePath)) return results;
  try {
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (value && !value.startsWith("your_") && !value.includes("REMPLACER")) {
        results[key] = value;
      }
    }
  } catch (err) {
    if (argv.verbose) console.warn(`  ⚠️  Failed to read ${filePath}: ${err.message}`);
  }
  return results;
}

function parseEnvLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/);
}

function upsertEnvKey(lines, key, value) {
  const next = [...lines];
  const re = new RegExp(`^${key}=`);
  let found = false;
  for (let i = 0; i < next.length; i++) {
    if (re.test(next[i])) {
      next[i] = `${key}=${value}`;
      found = true;
      break;
    }
  }
  if (!found) {
    if (next.length && next[next.length - 1] !== "") next.push("");
    next.push(`${key}=${value}`);
  }
  return next;
}

async function main() {
  console.log("🔍 Secret hygiene (inseme/.env is source of truth)\n");
  console.log(
    isDryRun
      ? "Mode: DRY-RUN (no writes). Pass --apply to write .env; --apply --vault for vault.\n"
      : wantVault
        ? "Mode: APPLY + VAULT (will write .env and instance_config)\n"
        : "Mode: APPLY (.env only; vault untouched)\n"
  );

  // apps/platform/scripts → ../../../ = monorepo root; ../ = apps/platform
  const insemeEnv = path.join(__dirname, "../../../.env");
  const platformEnv = path.join(__dirname, "../.env");
  const sources = {};

  console.log("📂 Scanning sources:");
  const rootSecrets = scanEnvFile(insemeEnv);
  sources["inseme/.env (SoT)"] = rootSecrets;
  console.log(`  ✅ inseme/.env: ${Object.keys(rootSecrets).length} keys`);

  const platformSecrets = scanEnvFile(platformEnv);
  sources["apps/platform/.env"] = platformSecrets;
  if (Object.keys(platformSecrets).length) {
    console.log(`  ✅ apps/platform/.env: ${Object.keys(platformSecrets).length} keys`);
  }

  const claudeSecrets = scanClaudeSettings();
  sources["~/.claude settings"] = claudeSecrets;
  if (Object.keys(claudeSecrets).length) {
    console.log(`  ✅ Claude Code settings: ${Object.keys(claudeSecrets).join(", ")}`);
  } else if (argv.verbose) {
    console.log("  · Claude Code settings: none");
  }

  // Alignment check: Supabase target
  console.log("\n🎯 Supabase target alignment:");
  const rootUrl = rootSecrets.SUPABASE_URL || rootSecrets.VITE_SUPABASE_URL || "";
  const platUrl = platformSecrets.SUPABASE_URL || platformSecrets.VITE_SUPABASE_URL || "";
  console.log(`  inseme/.env:          ${rootUrl || "(missing)"}`);
  console.log(`  apps/platform/.env:   ${platUrl || "(missing)"}`);
  if (rootUrl && platUrl && rootUrl !== platUrl) {
    console.log("  ⚠️  MISMATCH between root and platform — fix before dogfooding JHN");
  } else if (rootUrl && rootUrl.includes("ndiysuhzmztatpxbkezn")) {
    console.log("  ✅ Both point at JHN project ref (or platform empty)");
  } else if (rootUrl.includes("opnotbjrbphwcezaqgim")) {
    console.log("  ⚠️  Still on Pertitellu project ref — not JHN");
  }

  // Candidates from non-SoT sources that could enrich SoT
  const candidates = { ...claudeSecrets, ...platformSecrets };
  // SoT wins for display of current; candidates only if missing or different
  const enrichPlan = [];
  for (const [envKey, value] of Object.entries(candidates)) {
    if (
      !VAULT_KEY_MAPPING[envKey] &&
      !envKey.startsWith("SUPABASE") &&
      !envKey.startsWith("VITE_SUPABASE")
    ) {
      continue;
    }
    const current = rootSecrets[envKey];
    if (current === value) continue;
    if (!current) {
      enrichPlan.push({ envKey, value, action: "add-to-sot" });
    } else {
      enrichPlan.push({ envKey, value, action: "differs-from-sot", current });
    }
  }

  console.log("\n📋 Drift / enrich plan vs inseme/.env:");
  if (enrichPlan.length === 0) {
    console.log("  ✅ No candidate keys differ from SoT (among mapped keys)");
  } else {
    for (const item of enrichPlan) {
      if (item.action === "add-to-sot") {
        console.log(`  + ${item.envKey}: missing in SoT, available elsewhere ${mask(item.value)}`);
      } else {
        console.log(
          `  ≠ ${item.envKey}: SoT ${mask(item.current)} vs other ${mask(item.value)} (SoT wins unless you edit manually)`
        );
      }
    }
  }

  // Optional vault read (never write unless --apply --vault)
  let vaultPlan = [];
  try {
    const { loadConfig, getConfig, uploadConfig } = await import("./lib/config.js");
    await loadConfig();
    console.log("\n📦 Vault (instance_config) vs SoT:");
    for (const [envKey, vaultKey] of Object.entries(VAULT_KEY_MAPPING)) {
      const sot = rootSecrets[envKey];
      if (!sot) continue;
      const vaultVal = getConfig(vaultKey);
      if (vaultVal !== sot) {
        vaultPlan.push({ envKey, vaultKey, sot, vaultVal });
        console.log(`  ≠ ${vaultKey}: vault ${mask(vaultVal)} vs SoT ${mask(sot)}`);
      } else if (argv.verbose) {
        console.log(`  ✅ ${vaultKey}: matches SoT`);
      }
    }
    if (vaultPlan.length === 0)
      console.log("  ✅ Mapped SoT keys match vault (or vault empty/unavailable)");

    if (isDryRun) {
      console.log("\n✅ DRY-RUN complete — no files or vault changed.");
      if (enrichPlan.some((i) => i.action === "add-to-sot")) {
        console.log("   To merge missing keys into inseme/.env: --apply");
      }
      if (vaultPlan.length) {
        console.log("   To push SoT → vault: --apply --vault");
      }
      process.exit(0);
    }

    // APPLY: only add missing mapped keys from platform/claude into SoT (never overwrite SoT)
    if (isApply) {
      let lines = parseEnvLines(insemeEnv);
      let added = 0;
      for (const item of enrichPlan) {
        if (item.action !== "add-to-sot") continue;
        // Do not auto-copy service role into root without operator intent
        if (item.envKey.includes("SERVICE_ROLE") || item.envKey.includes("SECRET")) {
          console.log(`  ⏭️  skip auto-add ${item.envKey} (secret — add manually if needed)`);
          continue;
        }
        lines = upsertEnvKey(lines, item.envKey, item.value);
        added++;
        console.log(`  📝 add ${item.envKey} → inseme/.env`);
      }
      if (added > 0) {
        fs.writeFileSync(
          insemeEnv,
          lines.join("\n") + (lines[lines.length - 1] === "" ? "" : "\n")
        );
        console.log(
          `\n✅ Updated inseme/.env (+${added} keys). SoT remains authoritative for conflicts.`
        );
      } else {
        console.log("\n· No keys auto-added to SoT (conflicts require manual edit).");
      }

      // Mirror Supabase public keys to apps/platform/.env for Vite
      if (rootSecrets.SUPABASE_URL || rootUrl) {
        const url = rootSecrets.SUPABASE_URL || rootUrl;
        const anon =
          rootSecrets.SUPABASE_ANON_KEY ||
          rootSecrets.VITE_SUPABASE_ANON_KEY ||
          platformSecrets.SUPABASE_ANON_KEY;
        let pLines = parseEnvLines(platformEnv);
        if (!pLines.length) {
          pLines = ["# Generated copy from inseme/.env (SoT) — local dogfooding", ""];
        }
        pLines = upsertEnvKey(pLines, "SUPABASE_URL", url);
        pLines = upsertEnvKey(pLines, "VITE_SUPABASE_URL", url);
        if (anon) {
          pLines = upsertEnvKey(pLines, "SUPABASE_ANON_KEY", anon);
          pLines = upsertEnvKey(pLines, "VITE_SUPABASE_ANON_KEY", anon);
        }
        fs.writeFileSync(platformEnv, pLines.join("\n") + "\n");
        console.log("  📝 mirrored public Supabase keys → apps/platform/.env");
      }

      if (wantVault) {
        console.log("\n💾 Pushing SoT → vault (explicit --vault)...");
        // reload after possible .env edits
        await loadConfig();
        const fresh = scanEnvFile(insemeEnv);
        for (const [envKey, vaultKey] of Object.entries(VAULT_KEY_MAPPING)) {
          const value = fresh[envKey];
          if (!value) continue;
          if (envKey.includes("SERVICE_ROLE")) {
            console.log(`  ⏭️  skip vault push ${envKey}`);
            continue;
          }
          try {
            await uploadConfig({ [vaultKey]: value });
            console.log(`  ✅ ${vaultKey}`);
          } catch (err) {
            console.error(`  ❌ ${vaultKey}: ${err.message}`);
          }
        }
      } else {
        console.log("\n· Vault not updated (pass --vault with --apply to push).");
      }
    }
  } catch (err) {
    console.warn(`\n⚠️  Vault/config layer unavailable: ${err.message}`);
    if (isDryRun) {
      console.log("✅ DRY-RUN complete (scan-only portion).");
      process.exit(0);
    }
    throw err;
  }

  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
