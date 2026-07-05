#!/usr/bin/env node
/**
 * Inseme/Cyrnea wrapper for the shared COP tunnel runtime.
 *
 * The reusable implementation lives in:
 * packages/cop-host/src/tunnel/runtime.js
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");
const args = process.argv.slice(2);
const isStandalone = args.includes("--standalone");
const isHelp = args.includes("--help") || args.includes("-h");

let configAdapter = {};
if (!isStandalone && !isHelp) {
  const { loadConfig, getConfig } = await import("./lib/config.js");
  configAdapter = { loadConfig, getConfig };
}

globalThis.__COP_TUNNEL_CONFIG_ADAPTER = {
  ...configAdapter,
  rootDir,
  envPath: path.join(rootDir, ".env"),
  staticDir: __dirname,
};

await import("@inseme/cop-host/tunnel");
