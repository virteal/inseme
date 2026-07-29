#!/usr/bin/env node
// scripts/get-api-keys.js
//
// CLI tool to read API keys from instance_config (Supabase)
// Usage: node scripts/get-api-keys.js [--copy] [--env-file <path>] [--key <key_name>]

import minimist from "minimist";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = minimist(process.argv.slice(2), {
  boolean: ["copy", "help", "quiet"],
  string: ["env-file", "key"],
  alias: { h: "help", q: "quiet" },
});

if (argv.help) {
  console.log(`Usage: node scripts/get-api-keys.js [options]

Read API keys from the Inseme instance_config vault.

Options:
  --key <name>         Show only this key (e.g., anthropic_api_key, zai_api_key)
  --copy               Print full .env lines to stdout for manual copy
  --env-file <path>    Update or create the target .env file without printing secrets
  --quiet, -q          Minimal output (for scripting)
  --help, -h          Show this help message

Available keys:
  anthropic_api_key   Anthropic official API key
  zai_api_key         Z.AI proxy API key (GLM models)
  openai_api_key      OpenAI API key
  mistral_api_key     Mistral API key
  gemini_api_key      Google Gemini API key
`);
  process.exit(0);
}

async function main() {
  const quiet = argv.quiet;
  const requestedKey = argv.key;

  // For quiet mode with single key, read directly from .env (faster, no output)
  if (quiet && requestedKey) {
    const fs = await import("fs");
    const path = await import("path");
    const insemeEnv = path.join(__dirname, "../../../.env");

    try {
      const envContent = fs.readFileSync(insemeEnv, "utf8");
      const lines = envContent.split("\n");
      // Convert vault key to env key (e.g., zai_api_key → ZAI_API_KEY)
      const envKey = requestedKey.toUpperCase();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const [key, ...valueParts] = trimmed.split("=");
        if (valueParts.length === 0) continue;

        if (key === envKey) {
          const value = valueParts.join("=");
          console.log(value);
          process.exit(0);
        }
      }
      // Not found in .env
      process.exit(1);
    } catch (err) {
      process.exit(1);
    }
  }

  const { loadConfig, getConfig } = await import("./lib/config.js");
  await loadConfig();

  // Read all API keys from vault
  const keys = {
    anthropic_api_key: getConfig("anthropic_api_key"),
    zai_api_key: getConfig("zai_api_key"),
    openai_api_key: getConfig("openai_api_key"),
    mistral_api_key: getConfig("mistral_api_key"),
    gemini_api_key: getConfig("gemini_api_key"),
  };

  // If --key specified, show only that key
  if (requestedKey) {
    const value = keys[requestedKey];
    if (!value) {
      if (!quiet) console.error(`❌ Key '${requestedKey}' not found in vault`);
      process.exit(1);
    }
    // Print just the value for scripting
    console.log(value);
    process.exit(0);
  }

  // Display all keys
  if (!quiet) console.log("🔍 Reading API keys from instance_config...\n");

  const foundKeys = Object.entries(keys).filter(([_, v]) => v);
  const missingKeys = Object.entries(keys).filter(([_, v]) => !v);

  for (const [key, value] of foundKeys) {
    const masked = value ? value.substring(0, Math.min(20, value.length)) + "..." : "(not set)";
    console.log(`✅ ${key}: ${masked}`);
  }

  for (const [key] of missingKeys) {
    console.log(`❌ ${key}: (not found)`);
  }

  // If requested, build .env content
  if (argv.copy || argv["env-file"]) {
    let envContent = "";
    for (const [key, value] of foundKeys) {
      if (value) {
        const envKey = key.toUpperCase(); // anthropic_api_key -> ANTHROPIC_API_KEY
        envContent += `${envKey}=${value}\n`;
      }
    }

    if (!envContent.trim()) {
      if (!quiet) console.warn("\n⚠️ No API keys found; nothing to copy or write.");
      return;
    }

    if (argv.copy) {
      console.log("\n--- .env format ---");
      console.log(envContent);
    }

    // If --env-file, write to target file
    if (argv["env-file"]) {
      const targetPath = argv["env-file"];
      const fullPath = path.isAbsolute(targetPath)
        ? targetPath
        : path.resolve(__dirname, "../../../", targetPath);

      try {
        let existingContent = "";
        if (fs.existsSync(fullPath)) {
          existingContent = fs.readFileSync(fullPath, "utf8");
        }

        // Append or update keys
        const lines = envContent.trim().split("\n");
        for (const line of lines) {
          const [key, ...valueParts] = line.split("=");
          const value = valueParts.join("=");
          const regex = new RegExp(`^${key}=.*`, "m");

          if (regex.test(existingContent)) {
            existingContent = existingContent.replace(regex, line);
          } else {
            existingContent = existingContent.trimEnd() + "\n" + line + "\n";
          }
        }

        fs.writeFileSync(fullPath, existingContent);
        if (!quiet) console.log(`\n✅ Written to: ${fullPath}`);
      } catch (err) {
        console.error(`\n❌ Failed to write to ${fullPath}:`, err.message);
        process.exit(1);
      }
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
