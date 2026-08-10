#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const viteCli = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const child = spawn(process.execPath, [viteCli, "build"], {
  env: { ...process.env, INSEME_DEPLOYMENT_PROFILE: "jhn" },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Unable to start JHN Vite build: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`JHN Vite build terminated by signal: ${signal}`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
