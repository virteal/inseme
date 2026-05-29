#!/usr/bin/env node
/**
 * Magistral Developer Experience Helper
 *
 * Provides a smooth one-command development experience.
 * Usage:
 *   npm run dev
 *   npm run dev -- --full
 *   node scripts/dev.js --full
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const wantFull = args.includes("--full") || args.includes("-f");

console.log("\n🌀  Magistral — Developer Mode\n");

function run(cmd, args, label) {
  console.log(`→ Starting: ${label}`);
  const child = spawn(cmd, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ ${label} exited with code ${code}`);
    }
  });

  return child;
}

if (wantFull) {
  console.log("Launching pilot + monitor together...\n");

  // Start pilot
  const pilot = run(
    "node",
    [
      "scripts/launcher.js",
      "--pilot",
      "pilots/reference-js/src/main.js",
      "--blueprint",
      "coding",
      "--map",
      "default",
    ],
    "Magistral Pilot"
  );

  // Give the pilot a moment to boot before starting monitor
  setTimeout(() => {
    const monitor = run("node", ["scripts/monitor.js"], "Magistral Monitor");

    // If one dies, kill the other
    pilot.on("exit", () => monitor.kill());
    monitor.on("exit", () => pilot.kill());
  }, 2500);
} else {
  console.log("Launching pilot (use --full to also start the monitor)\n");

  run(
    "node",
    [
      "scripts/launcher.js",
      "--pilot",
      "pilots/reference-js/src/main.js",
      "--blueprint",
      "coding",
      "--map",
      "default",
    ],
    "Magistral Pilot"
  );

  console.log("\n💡 Tip: In another terminal, run:");
  console.log("   npm run dev:monitor\n");
  console.log("   Or start everything together with:");
  console.log("   npm run dev -- --full\n");
}
