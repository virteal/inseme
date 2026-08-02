import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { signCopCapability } from "./signedCapability.js";
import { createSqliteCopRuntimeStore } from "./sqliteRuntimeStore.js";

const ED25519 = { name: "Ed25519" };

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`);
  return value;
}

function activeKey(publicConfig) {
  const entries = Object.entries(publicConfig?.keys ?? {});
  if (entries.length !== 1)
    throw new TypeError("exactly one active local capability key is required");
  return entries[0];
}

/**
 * Host-only capability issuer. It has no HTTP surface and never persists or
 * logs a bearer capability. Rotation is an administrative operation; until it
 * is implemented, exactly one signing key is active.
 */
export async function createJhnLocalCapabilityIssuer({
  stateDirectory,
  clock = () => new Date(),
} = {}) {
  requireText(stateDirectory, "stateDirectory");
  const root = path.resolve(stateDirectory);
  const [privateText, publicText] = await Promise.all([
    readFile(path.join(root, "cop-capability-private.jwk"), "utf8"),
    readFile(path.join(root, "cop-capability-public-keys.json"), "utf8"),
  ]);
  const publicConfig = JSON.parse(publicText);
  const [keyId, publicJwk] = activeKey(publicConfig);
  if (typeof publicConfig.audience !== "string")
    throw new TypeError("capability audience is invalid");
  const [privateKey, publicKey] = await Promise.all([
    crypto.subtle.importKey("jwk", JSON.parse(privateText), ED25519, false, ["sign"]),
    crypto.subtle.importKey("jwk", publicJwk, ED25519, false, ["verify"]),
  ]);
  const probe = crypto.getRandomValues(new Uint8Array(16));
  const probeSignature = await crypto.subtle.sign(ED25519, privateKey, probe);
  if (!(await crypto.subtle.verify(ED25519, publicKey, probeSignature, probe))) {
    throw new Error("local capability key pair does not match");
  }
  const database = new DatabaseSync(path.join(root, "cop-runtime.sqlite"));
  const store = createSqliteCopRuntimeStore(database);

  return {
    async issue({ subject, mandateRef = "mandate:jhn:runtime:1", lifetimeSeconds = 60 } = {}) {
      requireText(subject, "subject");
      requireText(mandateRef, "mandateRef");
      if (!Number.isInteger(lifetimeSeconds) || lifetimeSeconds < 1 || lifetimeSeconds > 300) {
        throw new TypeError("lifetimeSeconds must be an integer from 1 to 300");
      }
      const mandate = await store.resolveMandate(mandateRef);
      if (!mandate || mandate.status !== "active")
        throw new Error("cannot issue a capability for an inactive mandate");
      if (mandate.granteeRef !== subject)
        throw new Error("capability subject does not match mandate grantee");
      const nowSeconds = Math.floor(clock().getTime() / 1000);
      return signCopCapability({
        privateKey,
        keyId,
        issuer: mandate.issuerRef,
        subject,
        mandateRef,
        mandateVersion: mandate.version,
        audience: publicConfig.audience,
        issuedAt: nowSeconds,
        expiresAt: nowSeconds + lifetimeSeconds,
        nonce: crypto.randomUUID(),
      });
    },
    close() {
      database.close();
    },
  };
}
