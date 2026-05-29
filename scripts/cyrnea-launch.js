#!/usr/bin/env node
/**
 * Cyrnea DX Launcher — Optimized for Iterative Development
 *
 * This is first and foremost a **developer tool** for fast, repeated edit → reload cycles.
 * Most work on Cyrnea happens inside packages/brique-cyrnea (components, hooks, games, UI).
 *
 * Usage examples (daily iterative development):
 *   pnpm cyrnea:launch --dev                 # Fastest for UI work (recommended for most sessions)
 *   pnpm cyrnea:launch --dev --no-compile    # Even faster when you haven't touched brique structure
 *   pnpm cyrnea:launch --full                # When you need real Ophélia / Edge Functions
 *
 *   pnpm cyrnea:launch --help
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import process from "process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag) || args.includes(`--${flag}`);

const isWindows = process.platform === "win32";
const isCI = !!process.env.CI;

function printHeader() {
  console.log("\n🍷  Cyrnea — Iterative Development Launcher");
  console.log("   Fast feedback loop for working on the bar experience\n");
}

function printHelp() {
  console.log(`
Cyrnea Launcher — Designed for iterative development

DAILY ITERATIVE WORKFLOW (most common):
  pnpm cyrnea:launch --dev                 # Fast Vite + hot reload (default for coding)
  pnpm cyrnea:launch --dev --no-compile    # Skip compile when only editing components/hooks

When you need the full stack:
  pnpm cyrnea:launch --full                # Netlify Dev (real Edge + Ophélia)
  pnpm cyrnea:launch --full --tunnel       # + public tunnel for mobile testing

Other options:
  --dev, --iter       Optimized for repeated edit/reload cycles (UI focused)
  --no-compile        Skip the expensive brique compilation step (very fast restarts)
  --ui, --fast        Legacy alias for --dev
  --full              Full local backend with Netlify + Edge Functions
  --tunnel            Also start tunnel (for external/mobile access)
  --help, -h          This help

Safety note about --no-compile:
  Safe when you are only editing:
    - React components, hooks, styles inside existing briques
    - Game logic, playlist, vibe monitor, etc.
  You MUST run with compile (or without --no-compile) when you:
    - Add/change routes in a brique.config.js
    - Add new prompts, tools, or edge functions
    - Modify brique public assets that must be re-linked

Recommended daily command while actively coding:
  pnpm cyrnea:launch --dev

After launch you will usually work at:
  • Client UI (most iteration):  http://localhost:8888/app/cyrnea
  • Barman dashboard:           http://localhost:8888/bar/cyrnea
`);
}

function run(cmd, cmdArgs = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: options.cwd || ROOT,
      stdio: "inherit",
      shell: isWindows,
      env: { ...process.env, FORCE_COLOR: "1" },
      ...options,
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });

    child.on("error", reject);
  });
}

async function runCompileBriques() {
  console.log("\n🔧  Running brique compiler (generates registries, wrappers, links)...");
  console.log("   This is needed after structural changes (new routes, new prompts, new tools).\n");
  await run("node", ["packages/cop-host/scripts/compile-briques.js"], {
    cwd: ROOT,
  });
}

/**
 * Smart detection for iterative development.
 * Returns true if we can safely skip compile for fast iteration.
 */
async function shouldSkipCompileAutomatically() {
  try {
    // Use git to see what changed (fast and reliable)
    const { execSync } = await import("child_process");
    const output = execSync("git status --porcelain", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });

    const lines = output.trim().split("\n").filter(Boolean);

    if (lines.length === 0) {
      // No changes at all → very safe to skip
      return { skip: true, reason: "no uncommitted changes detected" };
    }

    // Dangerous patterns that require re-compilation
    const structuralPatterns = [
      /brique\.config\.js$/,
      /public\/prompts\//,
      /\/edge\//,
      /\/functions\//,
      /src\/generated\//, // if someone manually touched generated
      /packages\/cop-host\//, // core changes
    ];

    // Safe patterns for pure UI iteration
    const safePatterns = [
      /packages\/brique-cyrnea\/src\//,
      /apps\/cyrnea\/src\//,
      /packages\/brique-.*\/src\//, // other briques UI work
    ];

    let hasStructuralChange = false;
    let hasOnlySafeChanges = true;

    for (const line of lines) {
      const file = line.replace(/^.. /, "").trim();

      if (structuralPatterns.some((p) => p.test(file))) {
        hasStructuralChange = true;
        hasOnlySafeChanges = false;
        break;
      }

      if (!safePatterns.some((p) => p.test(file))) {
        // File changed outside the "safe UI zones"
        hasOnlySafeChanges = false;
      }
    }

    if (hasStructuralChange) {
      return {
        skip: false,
        reason: "structural changes detected (brique.config, prompts, edge, etc.)",
      };
    }

    if (hasOnlySafeChanges) {
      return {
        skip: true,
        reason: "only UI / component / hook changes in brique-cyrnea (or similar)",
      };
    }

    return { skip: false, reason: "mixed or non-UI changes detected" };
  } catch (e) {
    // Git not available or not a repo → be conservative
    return { skip: false, reason: "could not analyze git status (running outside git?)" };
  }
}

async function runViteOnly({ skipCompile = false } = {}) {
  if (skipCompile) {
    console.log("\n⚡  Starting Cyrnea in FAST ITERATIVE mode (Vite only, no compile)");
    console.log("   → This is the recommended path for daily UI/component/hook development.\n");
  } else {
    console.log("\n🚀  Starting Cyrnea in UI mode (Vite + compile)");
    console.log("   → Good when you may have made structural brique changes.\n");
  }

  console.log("   Hot reload is active. Edit files in packages/brique-cyrnea/src and save.\n");
  await run("pnpm", ["--filter", "@inseme/app-cyrnea", "run", "dev:vite"], { cwd: ROOT });
}

async function runFullBackend() {
  console.log("\n🚀  Starting Cyrnea with full local backend (Netlify Dev + Edge)");
  console.log("   → Use this when you need real Ophélia, tools, Prolog, or Edge Functions.\n");
  await run("pnpm", ["cyrnea:backend"], { cwd: ROOT });
}

async function runWithTunnel() {
  console.log("\n🌐  Starting full stack + tunnel (for mobile / external testing)\n");
  await run("pnpm", ["cyrnea:all"], { cwd: ROOT });
}

function printIterativeDevTips() {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ITERATIVE DEVELOPMENT TIPS (Cyrnea)

  Most of your time will be spent here:
    packages/brique-cyrnea/src/

  Common fast iteration loop:
    1. pnpm cyrnea:launch --dev --no-compile
    2. Edit ClientMiniApp.jsx, hooks, GameInterface, etc.
    3. Save → Vite hot reloads instantly
    4. Repeat

  When to drop --no-compile and run a full compile:
    - You changed anything in a brique.config.js
    - You added or modified prompts under public/prompts
    - You added new tools or edge functions
    - You added a new brique that Cyrnea should see

  Useful URLs while developing:
    • Main client (bar vibe):     http://localhost:8888/app/cyrnea
    • Barman dashboard:           http://localhost:8888/bar/cyrnea
    • Vocal conversation test:    http://localhost:8888/vocal/cyrnea

  Pro tip: Keep one terminal with --dev --no-compile running all day.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

async function main() {
  if (hasFlag("help") || hasFlag("h")) {
    printHelp();
    process.exit(0);
  }

  printHeader();

  if (!isCI) {
    console.log(`   OS: ${process.platform}  |  Node: ${process.version}\n`);
  }

  const modeDev = hasFlag("dev") || hasFlag("iter") || hasFlag("ui") || hasFlag("fast");
  const skipCompile = hasFlag("no-compile") || hasFlag("skip-compile") || hasFlag("fast-iter");
  const modeFull = hasFlag("full");
  const modeTunnel = hasFlag("tunnel") || hasFlag("with-tunnel");

  try {
    if (modeDev) {
      // === ITERATIVE DEVELOPMENT PATH (the main use case) ===
      let finalSkip = skipCompile;

      if (!skipCompile) {
        // Try automatic smart detection
        const detection = await shouldSkipCompileAutomatically();

        if (detection.skip) {
          console.log(`\n🧠  Smart detection: ${detection.reason}`);
          console.log("    → Automatically skipping brique compilation for faster iteration.\n");
          console.log("    (You can force it with --compile if you want)\n");
          finalSkip = true;
        } else {
          console.log(`\n🧠  Smart detection: ${detection.reason}`);
          console.log("    → Running brique compilation (safer).\n");
          console.log("    Tip: use --no-compile if you are only doing UI work.\n");
          finalSkip = false;
        }
      } else {
        console.log("   ⚡  --no-compile explicitly requested → skipping brique compiler.\n");
      }

      if (!finalSkip) {
        await runCompileBriques();
      }

      await runViteOnly({ skipCompile: finalSkip });
      printIterativeDevTips();
    } else if (modeTunnel) {
      await runWithTunnel();
    } else if (modeFull) {
      await runFullBackend();
    } else {
      // No specific mode → guide the developer toward the iterative path
      console.log("No mode specified. Optimized guidance for development:\n");
      console.log("  For daily iterative coding (most common):");
      console.log("    pnpm cyrnea:launch --dev");
      console.log("    pnpm cyrnea:launch --dev --no-compile     ← fastest feedback loop\n");
      console.log("  When you need real AI / Edge behavior:");
      console.log("    pnpm cyrnea:launch --full\n");
      console.log("  For mobile testing:");
      console.log("    pnpm cyrnea:launch --full --tunnel\n");

      // Default to smart iterative experience
      console.log("→ Defaulting to smart iterative development mode (--dev)\n");

      const detection = await shouldSkipCompileAutomatically();
      const autoSkip = detection.skip;

      if (autoSkip) {
        console.log(`🧠  Auto-detected safe for fast iteration: ${detection.reason}\n`);
      } else {
        console.log(`🧠  ${detection.reason} → will run compile for safety.\n`);
      }

      if (!autoSkip) await runCompileBriques();
      await runViteOnly({ skipCompile: autoSkip });
      printIterativeDevTips();
    }
  } catch (err) {
    console.error("\n❌  Launch failed:", err.message);
    process.exit(1);
  }
}

main();
