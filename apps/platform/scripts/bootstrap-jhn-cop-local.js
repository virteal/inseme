import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createPortableCopRuntimeGateway } from "../mcp/cop/portableRuntimeGateway.js";
import {
  createSignedCapabilityContextResolver,
  signCopCapability,
} from "../mcp/cop/signedCapability.js";
import { createSqliteCopRuntimeStore } from "../mcp/cop/sqliteRuntimeStore.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const platformDirectory = path.resolve(scriptDirectory, "..");
const defaultStateDirectory = path.join(platformDirectory, "instances", "jhn-cop-local");
const migration = await readFile(
  new URL("../supabase/migrations/20260801120000_cop_runtime_portable_tables.sql", import.meta.url),
  "utf8"
);

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function isoNow(clock) {
  return clock().toISOString();
}

async function writeNewFile(filePath, contents) {
  await writeFile(filePath, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
}

export async function bootstrapJhnLocalCopAuthority({
  stateDirectory = defaultStateDirectory,
  clock = () => new Date(),
} = {}) {
  const resolvedStateDirectory = path.resolve(stateDirectory);
  const privateKeyPath = path.join(resolvedStateDirectory, "cop-capability-private.jwk");
  const publicKeysPath = path.join(resolvedStateDirectory, "cop-capability-public-keys.json");
  const databasePath = path.join(resolvedStateDirectory, "cop-runtime.sqlite");
  await mkdir(resolvedStateDirectory, { recursive: true });

  const existing = [privateKeyPath, publicKeysPath, databasePath];
  for (const filePath of existing) {
    try {
      await readFile(filePath);
      throw new Error(`Refusing to overwrite existing local authority state: ${filePath}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const keys = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const privateKey = await crypto.subtle.exportKey("jwk", keys.privateKey);
  const publicKey = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const keyId = `jhn-local-${crypto.randomUUID()}`;
  const audience = "cop-runtime:jhn";
  const now = isoNow(clock);
  const mandateRef = "mandate:jhn:runtime:1";

  await writeNewFile(privateKeyPath, `${JSON.stringify(privateKey, null, 2)}\n`);
  await writeNewFile(
    publicKeysPath,
    `${JSON.stringify({ instanceRef: "instance:jhn", audience, keys: { [keyId]: publicKey } }, null, 2)}\n`
  );

  const database = new DatabaseSync(databasePath);
  try {
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(migration);
    database
      .prepare(
        "INSERT INTO cop_mandates (mandate_ref, version, status, issuer_ref, grantee_ref, permissions, issued_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        mandateRef,
        1,
        "active",
        "instance:jhn",
        "principal:jhn:runtime",
        '["cop.tasks.write","cop.steps.write","cop.events.append","cop.artifacts.append"]',
        now,
        now,
        now
      );
    database
      .prepare(
        "INSERT INTO cop_handlers (handler_name, handler_kind, module_ref, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(
        "handler:jhn:coordinator",
        "runtime",
        "@inseme/cop-kernel",
        '{"profile":"jhn-coordinator"}',
        now,
        now
      );
    database
      .prepare(
        "INSERT INTO cop_logical_agents (logical_agent_id, logical_agent_name, status, twin_root_ref, active_mandate_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        "agent:jhn:coordinator:1",
        "JHN coordinator",
        "active",
        "twin:jhn",
        mandateRef,
        now,
        now
      );

    const store = createSqliteCopRuntimeStore(database);
    const nowSeconds = Math.floor(clock().getTime() / 1000);
    const capability = await signCopCapability({
      privateKey: keys.privateKey,
      keyId,
      issuer: "instance:jhn",
      subject: "principal:jhn:runtime",
      mandateRef,
      mandateVersion: 1,
      audience,
      issuedAt: nowSeconds,
      expiresAt: nowSeconds + 60,
      nonce: crypto.randomUUID(),
    });
    const resolveContext = createSignedCapabilityContextResolver({
      publicKeys: { [keyId]: publicKey },
      audience,
      resolveMandate: store.resolveMandate,
      clock,
    });
    const gateway = createPortableCopRuntimeGateway({ executor: store.executor, clock });
    const context = await resolveContext({ headers: { authorization: `Bearer ${capability}` } });
    await gateway.appendEvent(context, {
      id: "event:jhn:local-authority-bootstrapped:1",
      topic_id: "topic:jhn:runtime",
      type: "authority.local_bootstrapped",
      payload: { mandateRef, keyId },
      metadata: { bootstrap: true },
    });
  } finally {
    database.close();
  }

  return {
    stateDirectory: resolvedStateDirectory,
    databasePath,
    publicKeysPath,
    privateKeyPath,
    mandateRef,
    keyId,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stateDirectory = argumentValue("--state-dir") ?? defaultStateDirectory;
  const result = await bootstrapJhnLocalCopAuthority({ stateDirectory });
  console.log(`JHN local COP authority bootstrapped in ${result.stateDirectory}`);
  console.log(`SQLite state: ${result.databasePath}`);
  console.log(`Public capability configuration: ${result.publicKeysPath}`);
  console.log("The private signing key is host-only and was not printed.");
}
