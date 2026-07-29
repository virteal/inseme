#!/usr/bin/env node
// scripts/encrypt-secrets.js
//
// Encrypt secrets using age (age-encryption.org)
// Allows storing encrypted secrets in Git without exposing them
//
// Requirements: age command-line tool (https://age-encryption.org)
// Install: winget install age or cargo install age
//
// Usage:
//   node scripts/encrypt-secrets.js encrypt [--output .env.age]
//   node scripts/encrypt-secrets.js decrypt [--input .env.age] [--output .env]
//   node scripts/encrypt-secrets.js keygen [--output ~/.age-key.txt]

import minimist from "minimist";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = minimist(process.argv.slice(2), {
  boolean: ["help"],
  string: ["output", "input"],
  alias: { h: "help" },
});

if (argv.help) {
  console.log(`Usage: node scripts/encrypt-secrets.js <command> [options]

Commands:
  encrypt     Encrypt .env file to .env.age
  decrypt     Decrypt .env.age file to .env
  keygen      Generate new age key pair

Options:
  --output <path>   Output file path
  --input <path>    Input file path
  --help, -h        Show this help

Examples:
  # Generate age key pair
  node scripts/encrypt-secrets.js keygen

  # Encrypt secrets
  node scripts/encrypt-secrets.js encrypt

  # Decrypt secrets
  node scripts/encrypt-secrets.js decrypt

  # Custom paths
  node scripts/encrypt-secrets.js encrypt --output ../.env.backup.age
`);
  process.exit(0);
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const INSEME_ROOT = path.join(__dirname, "../../../");
const DEFAULT_ENV_FILE = path.join(INSEME_ROOT, ".env");
const DEFAULT_ENCRYPTED_FILE = path.join(INSEME_ROOT, ".env.age");
const DEFAULT_KEY_FILE = path.join(os.homedir(), ".age-key.txt");

// ============================================================================
// AGE TOOL CHECK
// ============================================================================

function checkAgeInstalled() {
  try {
    execSync("age --version", { stdio: "pipe" });
    return true;
  } catch (err) {
    console.error("❌ 'age' is not installed.");
    console.error("\nInstall age:");
    console.error("  Windows: winget install age");
    console.error("  macOS:   brew install age");
    console.error("  Linux:   cargo install age");
    console.error("\nOr visit: https://age-encryption.org");
    return false;
  }
}

// ============================================================================
// COMMANDS
// ============================================================================

async function keygen() {
  const outputFile = argv.output || DEFAULT_KEY_FILE;

  console.log(`🔐 Generating age key pair...`);
  console.log(`   Output: ${outputFile}\n`);

  try {
    const output = execSync(`age-keygen`, { encoding: "utf8" });
    fs.writeFileSync(outputFile, output);

    // Extract public key for display
    const pubKeyMatch = output.match(/Public key: (.+)/);
    if (pubKeyMatch) {
      console.log(`✅ Key generated!`);
      console.log(`\n📌 Public key (add this to .gitignore/README for reference):`);
      console.log(`   ${pubKeyMatch[1]}\n`);
      console.log(`⚠️  Keep the private key (in ${outputFile}) secure!`);
      console.log(`   Never commit ${outputFile} to Git.\n`);
    }
  } catch (err) {
    console.error(`❌ Failed to generate key: ${err.message}`);
    process.exit(1);
  }
}

async function encrypt() {
  if (!checkAgeInstalled()) process.exit(1);

  const inputFile = argv.input || DEFAULT_ENV_FILE;
  const outputFile = argv.output || DEFAULT_ENCRYPTED_FILE;
  const keyFile = DEFAULT_KEY_FILE;

  // Check files
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    process.exit(1);
  }

  if (!fs.existsSync(keyFile)) {
    console.error(`❌ Age key not found: ${keyFile}`);
    console.error(`   Run: node scripts/encrypt-secrets.js keygen`);
    process.exit(1);
  }

  console.log(`🔒 Encrypting secrets...`);
  console.log(`   Input:  ${inputFile}`);
  console.log(`   Output: ${outputFile}`);
  console.log(`   Key:    ${keyFile}\n`);

  try {
    // Read public key from key file
    const keyContent = fs.readFileSync(keyFile, "utf8");
    const pubKeyMatch = keyContent.match(/# public key: (.+)/);

    if (!pubKeyMatch) {
      throw new Error("Could not extract public key from key file");
    }

    const pubKey = pubKeyMatch[1].trim();

    // Encrypt using age
    const command = `age -r "${pubKey}" -o "${outputFile}" "${inputFile}"`;
    execSync(command, { stdio: "inherit" });

    console.log(`\n✅ Encryption complete!`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Commit ${outputFile} to Git`);
    console.log(`   2. Add ${inputFile} to .gitignore (if not already)`);
    console.log(`   3. Delete plaintext ${inputFile} from machines after decrypting\n`);
  } catch (err) {
    console.error(`❌ Encryption failed: ${err.message}`);
    process.exit(1);
  }
}

async function decrypt() {
  if (!checkAgeInstalled()) process.exit(1);

  const inputFile = argv.input || DEFAULT_ENCRYPTED_FILE;
  const outputFile = argv.output || DEFAULT_ENV_FILE;
  const keyFile = DEFAULT_KEY_FILE;

  // Check files
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    process.exit(1);
  }

  if (!fs.existsSync(keyFile)) {
    console.error(`❌ Age key not found: ${keyFile}`);
    console.error(`   Copy your private key to ${keyFile} first`);
    process.exit(1);
  }

  console.log(`🔓 Decrypting secrets...`);
  console.log(`   Input:  ${inputFile}`);
  console.log(`   Output: ${outputFile}`);
  console.log(`   Key:    ${keyFile}\n`);

  try {
    const command = `age -d -i "${keyFile}" -o "${outputFile}" "${inputFile}"`;
    execSync(command, { stdio: "inherit" });

    console.log(`\n✅ Decryption complete!`);
    console.log(`   Secrets written to: ${outputFile}\n`);
  } catch (err) {
    console.error(`❌ Decryption failed: ${err.message}`);
    console.error(`   Check that you're using the correct key file`);
    process.exit(1);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const command = argv._[0];

  if (!command) {
    console.error("Error: Specify a command (encrypt, decrypt, keygen)");
    console.log("Run with --help for usage.");
    process.exit(1);
  }

  switch (command) {
    case "keygen":
      await keygen();
      break;
    case "encrypt":
      await encrypt();
      break;
    case "decrypt":
      await decrypt();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log("Run with --help for usage.");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
