import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultStateDirectory = path.resolve(scriptDirectory, "..", "instances", "jhn-cop-local");
const ED25519 = { name: "Ed25519" };

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function requireObject(value, description) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${description} is invalid`);
  return value;
}

export async function verifyJhnLocalCopAuthority({ stateDirectory = defaultStateDirectory } = {}) {
  const root = path.resolve(stateDirectory);
  const [privateText, publicText] = await Promise.all([
    readFile(path.join(root, "cop-capability-private.jwk"), "utf8"),
    readFile(path.join(root, "cop-capability-public-keys.json"), "utf8"),
  ]);
  const privateJwk = requireObject(JSON.parse(privateText), "private capability key");
  const publicConfig = requireObject(JSON.parse(publicText), "public capability configuration");
  if (
    typeof publicConfig.audience !== "string" ||
    !publicConfig.keys ||
    typeof publicConfig.keys !== "object"
  ) {
    throw new Error("public capability configuration is incomplete");
  }
  const keyEntries = Object.entries(publicConfig.keys);
  if (keyEntries.length !== 1)
    throw new Error("exactly one active public capability key is required at bootstrap");
  const [keyId, publicJwk] = keyEntries[0];
  const [privateKey, publicKey] = await Promise.all([
    crypto.subtle.importKey("jwk", privateJwk, ED25519, false, ["sign"]),
    crypto.subtle.importKey("jwk", publicJwk, ED25519, false, ["verify"]),
  ]);
  const probe = crypto.getRandomValues(new Uint8Array(32));
  const signature = await crypto.subtle.sign(ED25519, privateKey, probe);
  if (!(await crypto.subtle.verify(ED25519, publicKey, signature, probe))) {
    throw new Error("private and public capability keys do not match");
  }

  const database = new DatabaseSync(path.join(root, "cop-runtime.sqlite"));
  try {
    const mandate = database
      .prepare(
        "SELECT mandate_ref, version, status, grantee_ref, permissions FROM cop_mandates WHERE mandate_ref = ?"
      )
      .get("mandate:jhn:runtime:1");
    if (
      !mandate ||
      mandate.status !== "active" ||
      mandate.version !== 1 ||
      mandate.grantee_ref !== "principal:jhn:runtime"
    ) {
      throw new Error("JHN bootstrap mandate is missing or invalid");
    }
    const permissions = JSON.parse(mandate.permissions);
    if (!Array.isArray(permissions) || !permissions.includes("cop.events.append")) {
      throw new Error("JHN bootstrap mandate permissions are invalid");
    }
    const eventCount = database
      .prepare("SELECT count(*) AS count FROM cop_events WHERE type = ?")
      .get("authority.local_bootstrapped").count;
    if (eventCount !== 1) throw new Error("JHN bootstrap audit event is missing or duplicated");
  } finally {
    database.close();
  }
  return { stateDirectory: root, audience: publicConfig.audience, keyId };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyJhnLocalCopAuthority({
    stateDirectory: argumentValue("--state-dir") ?? defaultStateDirectory,
  });
  console.log(`JHN local COP authority verified: ${result.stateDirectory}`);
  console.log(`Audience: ${result.audience}; active key: ${result.keyId}`);
  console.log("No key material or bearer capability was printed.");
}
