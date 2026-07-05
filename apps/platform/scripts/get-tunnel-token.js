#!/usr/bin/env node
// scripts/get-tunnel-token.js
//
// CLI tool to read and display tunnel tokens from instance_config (Supabase)
// Usage: node scripts/get-tunnel-token.js [--copy] [--env-file <path>]

import minimist from "minimist";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = minimist(process.argv.slice(2), {
  boolean: ["copy", "help"],
  string: ["env-file"],
  alias: { h: "help" },
});

if (argv.help) {
  console.log(`Usage: node scripts/get-tunnel-token.js [options]

Read tunnel tokens from the Inseme instance_config vault.

Options:
  --copy              Print full .env lines to stdout for manual copy
  --env-file <path>   Update or create the target .env file without printing secrets
  --help, -h          Show this help message
`);
  process.exit(0);
}

async function main() {
  console.log("🔍 Reading tunnel tokens from instance_config...\n");

  const { loadConfig, getConfig } = await import("./lib/config.js");
  await loadConfig();

  const cloudflareToken = getConfig("cloudflare_tunnel_token");
  const cloudflareDomain = getConfig("cloudflare_domain");
  const ngrokToken = getConfig("ngrok_auth_token");

  // Display results
  if (cloudflareToken) {
    console.log("✅ Cloudflare Tunnel (Preferred):");
    console.log(`   CLOUDFLARE_TUNNEL_TOKEN=${cloudflareToken.substring(0, 20)}...`);
    if (cloudflareDomain) {
      console.log(`   CLOUDFLARE_DOMAIN=${cloudflareDomain}`);
    }
  } else {
    console.log("❌ No Cloudflare tunnel token found");
  }

  console.log();

  if (ngrokToken) {
    console.log("✅ Ngrok (Fallback):");
    console.log(`   NGROK_AUTH_TOKEN=${ngrokToken.substring(0, 20)}...`);
  } else {
    console.log("❌ No Ngrok token found");
  }

  // If requested, build .env content for manual copy or direct file update.
  if (argv.copy || argv["env-file"]) {
    let envContent = "";
    if (cloudflareToken) {
      envContent += `CLOUDFLARE_TUNNEL_TOKEN=${cloudflareToken}\n`;
      if (cloudflareDomain) {
        envContent += `CLOUDFLARE_DOMAIN=${cloudflareDomain}\n`;
      }
    }
    if (ngrokToken) {
      envContent += `NGROK_AUTH_TOKEN=${ngrokToken}\n`;
    }
    if (!envContent.trim()) {
      console.warn("\n⚠️ No tunnel token found; nothing to copy or write.");
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
        // Check if file exists
        let existingContent = "";
        if (fs.existsSync(fullPath)) {
          existingContent = fs.readFileSync(fullPath, "utf8");
        }

        // Append or update tunnel tokens
        const lines = envContent.trim().split("\n");
        for (const line of lines) {
          const [key, ...valueParts] = line.split("=");
          const value = valueParts.join("=");
          const regex = new RegExp(`^${key}=.*`, "m");

          if (regex.test(existingContent)) {
            // Replace existing
            existingContent = existingContent.replace(regex, line);
          } else {
            // Append
            existingContent = existingContent.trimEnd() + "\n" + line + "\n";
          }
        }

        fs.writeFileSync(fullPath, existingContent);
        console.log(`\n✅ Written to: ${fullPath}`);
      } catch (err) {
        console.error(`\n❌ Failed to write to ${fullPath}:`, err.message);
      }
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
