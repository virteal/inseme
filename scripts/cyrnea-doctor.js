#!/usr/bin/env node
/**
 * Cyrnea Dev Doctor
 *
 * Helps you get ready for fast iterative development sessions.
 * Focus: "Am I in a good state to run pnpm cyrnea:dev:fast / --dev --no-compile all day?"
 *
 * Usage:
 *   pnpm cyrnea:doctor
 *   node scripts/cyrnea-doctor.js
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const isWindows = process.platform === "win32";

function section(title) {
  console.log(`\n━━━ ${title} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

function ok(msg) {
  console.log(`  ✅  ${msg}`);
}
function warn(msg) {
  console.log(`  ⚠️   ${msg}`);
}
function fail(msg) {
  console.log(`  ❌  ${msg}`);
}
function info(msg) {
  console.log(`     ${msg}`);
}

async function main() {
  console.log("\n🍷  Cyrnea Dev Doctor — Iterative Development Readiness\n");

  let score = 0;
  let maxScore = 0;

  // 1. Basic environment
  section("Environment");
  maxScore += 3;

  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split(".")[0]);
  if (major >= 20) {
    ok(`Node ${nodeVersion}`);
    score++;
  } else {
    warn(`Node ${nodeVersion} (20+ recommended)`);
  }

  try {
    const pnpmVersion = execSync("pnpm --version", { encoding: "utf8" }).trim();
    ok(`pnpm ${pnpmVersion}`);
    score++;
  } catch {
    fail("pnpm not found in PATH");
  }

  if (fs.existsSync(path.join(ROOT, "pnpm-workspace.yaml"))) {
    ok("Monorepo root detected");
    score++;
  } else {
    fail("Not running from inseme monorepo root");
  }

  // 2. Git status & change analysis (very relevant for iterative dev)
  section("Git & Change Analysis (for --no-compile decisions)");
  maxScore += 2;

  try {
    const status = execSync("git status --porcelain", { cwd: ROOT, encoding: "utf8" });
    const changed = status.trim().split("\n").filter(Boolean);

    if (changed.length === 0) {
      ok("Working tree clean");
      info("   → Very safe to use --dev --no-compile");
      score++;
    } else {
      ok(`${changed.length} modified file(s)`);

      const structural = changed.some((line) => {
        const f = line.replace(/^.. /, "");
        return (
          /brique\.config\.js$/.test(f) ||
          /public\/prompts\//.test(f) ||
          /\/edge\//.test(f) ||
          /cop-host\//.test(f)
        );
      });

      if (!structural) {
        ok("Changes look UI-only (components, hooks, src/)");
        info("   → Strongly recommended: pnpm cyrnea:dev:fast");
        score++;
      } else {
        warn("Structural changes detected (brique.config / prompts / edge)");
        info("   → You should probably run without --no-compile this time");
      }
    }
  } catch {
    warn("Could not read git status (not a git repo or git missing)");
  }

  // 3. Generated files freshness (important for fast dev)
  section("Brique Compilation State");
  maxScore += 2;

  const registryPath = path.join(ROOT, "apps/cyrnea/src/generated/brique-registry.js");
  if (fs.existsSync(registryPath)) {
    const stat = fs.statSync(registryPath);
    const ageMin = Math.round((Date.now() - stat.mtimeMs) / 1000 / 60);
    ok(`brique-registry.js exists (last generated ~${ageMin} min ago)`);
    score++;

    if (ageMin < 60) {
      ok("Compilation is reasonably fresh");
      score++;
    } else {
      warn("Compilation is old — consider running once with compile");
    }
  } else {
    fail("No brique-registry.js found — you must run compile at least once");
  }

  // 4. .env and basic secrets
  section(".env & Configuration");
  maxScore += 2;

  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    ok(".env file present");

    const content = fs.readFileSync(envPath, "utf8");
    const hasSupabase = content.includes("SUPABASE_URL") || content.includes("VITE_SUPABASE");
    const hasProxy = content.includes("HTTP_PROXY") || content.includes("HTTPS_PROXY");

    if (hasSupabase) {
      ok("Supabase URL appears to be configured");
      score++;
    } else {
      warn("No obvious Supabase configuration found");
    }

    if (hasProxy) {
      warn("Proxy variables detected in .env — check-tunnel.js may block startup");
      info("   → Make sure your tunnel is running or remove the proxy for local dev");
    } else {
      ok("No problematic proxy variables detected");
      score++;
    }
  } else {
    warn(".env file is missing (you may need one for Supabase / AI keys)");
  }

  // 5. Key tools
  section("Useful Tools for Cyrnea Dev");
  maxScore += 1;

  try {
    execSync("netlify --version", { stdio: "ignore" });
    ok("Netlify CLI available (required for --full mode)");
    score++;
  } catch {
    warn("Netlify CLI not found (needed for pnpm cyrnea:launch --full)");
  }

  // Final report
  section("Readiness for Iterative Development");

  const percentage = Math.round((score / maxScore) * 100);

  console.log(`\n  Iterative Dev Readiness: ${score}/${maxScore} (${percentage}%)\n`);

  if (percentage >= 80) {
    console.log("  🎉  Excellent. You are well set up for fast iterative work.\n");
    console.log("  Recommended daily command:");
    console.log("    pnpm cyrnea:dev:fast     (or pnpm cyrnea:launch --dev --no-compile)\n");
  } else if (percentage >= 55) {
    console.log("  👍  Good enough for development, but a few things could be smoother.\n");
  } else {
    console.log("  ⚠️   Several things may slow you down. Address the ❌ and ⚠️ above.\n");
  }

  console.log("  Quick commands:");
  console.log("    pnpm cyrnea:doctor           # this check");
  console.log("    pnpm cyrnea:dev:fast         # fastest iteration mode");
  console.log("    pnpm cyrnea:launch --help    # see all options\n");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("Doctor failed:", err);
  process.exit(1);
});
