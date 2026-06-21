#!/usr/bin/env node
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  return result.status ?? (result.error ? 1 : 0);
}

function commandExists(command) {
  const probe = process.platform === "win32" ? ["where", [command]] : ["command", ["-v", command]];
  const result = spawnSync(probe[0], probe[1], {
    cwd: appRoot,
    stdio: "ignore",
    shell: process.platform !== "win32",
  });
  return result.status === 0;
}

function packageManager() {
  if (commandExists("pnpm")) return ["pnpm", ["install"]];
  if (commandExists("npm")) return ["npm", ["install"]];
  return null;
}

console.log("Setting up Inseme Standalone instance...");

const envPath = join(appRoot, ".env");
const envExamplePath = join(appRoot, ".env.example");
if (!existsSync(envPath)) {
  if (existsSync(envExamplePath)) {
    console.log(".env file not found. Creating from .env.example...");
    copyFileSync(envExamplePath, envPath);
  } else {
    console.warn(
      ".env file not found and .env.example is missing. Create .env manually before running the app."
    );
  }
}

if (commandExists("supabase")) {
  console.log("Running database migrations...");
  const status = run("supabase", ["db", "push"]);
  if (status !== 0) process.exit(status);
} else {
  console.warn(
    "Supabase CLI not found. Run migrations manually from apps/inseme/supabase/migrations."
  );
}

const pm = packageManager();
if (pm) {
  console.log("Installing dependencies...");
  const status = run(pm[0], pm[1]);
  if (status !== 0) process.exit(status);
} else {
  console.warn(
    "No package manager found. Install dependencies manually with pnpm install or npm install."
  );
}

console.log("Standalone setup complete. Run the development script to start.");
