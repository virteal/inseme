#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const hooksDir = ".githooks";

if (!existsSync(resolve(repoRoot, ".git"))) {
  console.warn("[inseme] Git directory not found. Skipping hook installation.");
  process.exit(0);
}

const result = spawnSync("git", ["config", "core.hooksPath", hooksDir], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.warn(`[inseme] Could not configure Git hooks: ${result.error.message}`);
  process.exit(0);
}

if (result.status !== 0) {
  console.warn("[inseme] git config core.hooksPath failed. Hooks were not installed.");
  process.exit(0);
}

console.log(`[inseme] Git hooks installed from ${hooksDir}.`);
