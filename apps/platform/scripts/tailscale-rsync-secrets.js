#!/usr/bin/env node
// scripts/tailscale-rsync-secrets.js
//
// Sync secrets across Tailscale mesh machines using rsync/scp/rclone
// Assumes Tailscale is trustable and provides secure point-to-point connections
//
// Usage: node scripts/tailscale-rsync-secrets.js [--push] [--pull] [--dry-run] [--tool rsync|scp|rclone]

import minimist from "minimist";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = minimist(process.argv.slice(2), {
  boolean: ["dry-run", "push", "pull", "list", "help", "verbose"],
  string: ["tool", "host"],
  alias: { h: "help", v: "verbose", n: "dry-run" },
  default: { tool: "rsync" },
});

if (argv.help) {
  console.log(`Usage: node scripts/tailscale-rsync-secrets.js [options]

Sync secrets across Tailscale mesh machines.

Options:
  --push              Push local secrets to remote machines
  --pull              Pull secrets from a remote machine
  --list              List available Tailscale hosts
  --tool <name>       Use rsync (default), scp, or rclone
  --host <name>       Specific Tailscale hostname (for --pull)
  --dry-run, -n       Show what would be done without doing it
  --verbose, -v       Detailed output
  --help, -h          Show this help

Examples:
  # List available Tailscale hosts
  node scripts/tailscale-rsync-secrets.js --list

  # Push local .env to all machines
  node scripts/tailscale-rsync-secrets.js --push

  # Pull from specific machine
  node scripts/tailscale-rsync-secrets.js --pull --host rossignol

  # Use scp instead of rsync
  node scripts/tailscale-rsync-secrets.js --push --tool scp
`);
  process.exit(0);
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Tailscale hostnames (update with your actual mesh hosts)
const TAILSCALE_HOSTS = [
  "rossignol", // Primary machine in Corte
  "thinkpad", // Portable/field machine
  // Add your other Tailscale hostnames here
];

// Files to sync (relative to inseme root)
const SECRET_FILES = [
  ".env",
  // Add other secret files if needed, e.g.:
  // ".secrets/service-account.json",
];

// Local paths
const INSEME_ROOT = path.join(__dirname, "../../../");
const LOCAL_SECRET_DIR = INSEME_ROOT;

// ============================================================================
// TAILSCALE UTILITIES
// ============================================================================

function getTailscaleHosts() {
  try {
    const output = execSync("tailscale status --json", { encoding: "utf8" });
    const status = JSON.parse(output);
    const peers = status.Peer || {};

    return Object.entries(peers)
      .filter(([_, info]) => info.Online && info.HostName)
      .map(([ip, info]) => ({
        hostname: info.HostName,
        ip: ip,
        dnsName: info.DNSName || `${info.HostName}.tailnet-${status.Self.OwnerName}`,
      }));
  } catch (err) {
    if (argv.verbose) console.warn(`Could not get Tailscale hosts: ${err.message}`);
    // Fallback to configured list
    return TAILSCALE_HOSTS.map((name) => ({ hostname: name, ip: null, dnsName: `${name}` }));
  }
}

function listHosts() {
  console.log("🌐 Tailscale Mesh Status:\n");
  const hosts = getTailscaleHosts();

  if (hosts.length === 0) {
    console.log("  No online hosts found. Using configured list:");
    TAILSCALE_HOSTS.forEach((name) => console.log(`   - ${name}`));
    return;
  }

  const localHostname = os.hostname();
  console.log(`  Local: ${localHostname}\n`);
  console.log("  Remote hosts:");
  hosts.forEach((host) => {
    const isLocal = host.hostname.toLowerCase() === localHostname.toLowerCase();
    console.log(
      `   ${isLocal ? "(local)" : "       "} ${host.hostname.padEnd(20)} ${host.dnsName || host.ip || ""}`
    );
  });
}

// ============================================================================
// SYNC IMPLEMENTATIONS
// ============================================================================

class SyncTool {
  constructor(dryRun = false, verbose = false) {
    this.dryRun = dryRun;
    this.verbose = verbose;
  }

  log(command) {
    if (this.dryRun || this.verbose) {
      console.log(`$ ${command}`);
    }
  }

  run(command) {
    this.log(command);
    if (!this.dryRun) {
      try {
        execSync(command, { stdio: this.verbose ? "inherit" : "pipe" });
        return true;
      } catch (err) {
        console.error(`  ❌ Failed: ${err.message}`);
        return false;
      }
    }
    return true;
  }
}

class RsyncSync extends SyncTool {
  push(localPath, remoteHost, remotePath) {
    const remote = `${remoteHost}:${remotePath}`;
    return this.run(`rsync -avz --progress "${localPath}" "${remote}"`);
  }

  pull(remoteHost, remotePath, localPath) {
    const remote = `${remoteHost}:${remotePath}`;
    return this.run(`rsync -avz --progress "${remote}" "${localPath}"`);
  }
}

class ScpSync extends SyncTool {
  push(localPath, remoteHost, remotePath) {
    return this.run(`scp "${localPath}" "${remoteHost}:${remotePath}"`);
  }

  pull(remoteHost, remotePath, localPath) {
    return this.run(`scp "${remoteHost}:${remotePath}" "${localPath}"`);
  }
}

class RcloneSync extends SyncTool {
  push(localPath, remoteHost, remotePath) {
    // rclone syntax: rclone copy source:path dest:path
    return this.run(`rclone copy "${localPath}" ":ssh,host=${remoteHost}:${remotePath}"`);
  }

  pull(remoteHost, remotePath, localPath) {
    return this.run(`rclone copy ":ssh,host=${remoteHost}:${remotePath}" "${localPath}"`);
  }
}

function getSyncTool(toolName, dryRun, verbose) {
  switch (toolName.toLowerCase()) {
    case "rsync":
      return new RsyncSync(dryRun, verbose);
    case "scp":
      return new ScpSync(dryRun, verbose);
    case "rclone":
      return new RcloneSync(dryRun, verbose);
    default:
      throw new Error(`Unknown tool: ${toolName}. Use: rsync, scp, or rclone`);
  }
}

// ============================================================================
// MAIN SYNC LOGIC
// ============================================================================

async function main() {
  if (argv.list) {
    listHosts();
    process.exit(0);
  }

  if (!argv.push && !argv.pull) {
    console.error("Error: Specify --push or --pull (or --list to see hosts)");
    console.log("Run with --help for usage.");
    process.exit(1);
  }

  const tool = getSyncTool(argv.tool, argv["dry-run"], argv.verbose);
  const hosts = getTailscaleHosts();
  const localHostname = os.hostname().toLowerCase();

  // Filter out local host from remote list
  const remoteHosts = argv.host
    ? [{ hostname: argv.host, ip: null, dnsName: argv.host }]
    : hosts.filter((h) => h.hostname.toLowerCase() !== localHostname);

  if (remoteHosts.length === 0 && !argv.host) {
    console.log("No remote hosts available.");
    process.exit(0);
  }

  console.log(`\n🔧 Sync tool: ${argv.tool}`);
  if (argv["dry-run"]) console.log("⚠️  DRY RUN - No actual changes will be made\n");

  let successCount = 0;
  let failCount = 0;

  for (const secretFile of SECRET_FILES) {
    const localPath = path.join(LOCAL_SECRET_DIR, secretFile);

    if (!fs.existsSync(localPath)) {
      console.warn(`⚠️  Local file not found: ${secretFile}`);
      continue;
    }

    console.log(`\n📄 Syncing: ${secretFile}`);

    if (argv.push) {
      // Push to all remote hosts
      for (const host of remoteHosts) {
        const hostName = host.dnsName || host.hostname;
        const remotePath = path.join("~/tweesic/inseme", secretFile);

        console.log(`  → ${hostName}`);
        if (tool.push(localPath, hostName, remotePath)) {
          successCount++;
          console.log(`  ✅ Pushed to ${hostName}`);
        } else {
          failCount++;
          console.log(`  ❌ Failed to push to ${hostName}`);
        }
      }
    } else if (argv.pull) {
      // Pull from specified host
      const targetHost = remoteHosts[0];
      if (!targetHost) {
        console.error("Error: No remote host specified. Use --host <name>");
        process.exit(1);
      }

      const hostName = targetHost.dnsName || targetHost.hostname;
      const remotePath = path.join("~/tweesic/inseme", secretFile);

      console.log(`  ← ${hostName}`);
      if (tool.pull(hostName, remotePath, localPath)) {
        successCount++;
        console.log(`  ✅ Pulled from ${hostName}`);
      } else {
        failCount++;
        console.log(`  ❌ Failed to pull from ${hostName}`);
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Summary: ${successCount} succeeded, ${failCount} failed`);

  if (argv["dry-run"]) {
    console.log("\n⚠️  DRY RUN - No files were actually modified");
    console.log("Run without --dry-run to apply changes.");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
