#!/usr/bin/env node
/**
 * Run a command in a conda env without loading the PowerShell profile hook.
 * Used by npm scripts (e.g. packages/models model:pull).
 *
 * Usage:
 *   node scripts/conda-run.js --env inseme python scripts/download.py
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function parseArgs(argv) {
  let envName = "inseme";
  const command = [];
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === "--env" || arg === "-n") && argv[i + 1]) {
      envName = argv[++i];
      continue;
    }
    command.push(arg);
  }
  return { envName, command };
}

function resolveCondaExe() {
  const configured = String(process.env.CONDA_EXE || "").trim();
  if (configured && fs.existsSync(configured)) return configured;
  const fallback = path.join(os.homedir(), "miniconda3", "Scripts", "conda.exe");
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

function main() {
  const { envName, command } = parseArgs(process.argv);
  if (!command.length) {
    console.error("conda-run.js: command required");
    process.exit(1);
  }

  const condaExe = resolveCondaExe();
  if (!condaExe) {
    console.error("conda.exe not found — set CONDA_EXE or install miniconda3");
    process.exit(1);
  }

  const result = spawnSync(
    condaExe,
    ["run", "-n", envName, "--no-capture-output", ...command],
    { stdio: "inherit", windowsHide: true },
  );
  process.exit(result.status ?? 1);
}

main();