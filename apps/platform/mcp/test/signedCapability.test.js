import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createPortableCopRuntimeGateway } from "../cop/portableRuntimeGateway.js";
import { createPortableCopRuntimeHandlers } from "../cop/portableRuntimeHandlers.js";
import {
  CopCapabilityError,
  createSignedCapabilityContextResolver,
  signCopCapability,
} from "../cop/signedCapability.js";
import { createSqliteCopRuntimeStore } from "../cop/sqliteRuntimeStore.js";

const now = new Date("2026-08-01T12:00:00.000Z");
const nowSeconds = Math.floor(now.getTime() / 1000);
const audience = "cop-runtime:jhn";
const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260801120000_cop_runtime_portable_tables.sql",
    import.meta.url
  ),
  "utf8"
);

async function capabilityFixture(overrides = {}) {
  const keys = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const token = await signCopCapability({
    privateKey: keys.privateKey,
    keyId: "jhn-2026-08",
    issuer: "instance:jhn",
    subject: "principal:jhn",
    mandateRef: "mandate:jhn-runtime",
    mandateVersion: 3,
    audience,
    issuedAt: nowSeconds - 60,
    expiresAt: nowSeconds + 300,
    nonce: "test-capability-1",
    ...overrides,
  });
  return { publicKeys: { "jhn-2026-08": publicKey }, token };
}

function activeMandate(overrides = {}) {
  return {
    status: "active",
    version: 3,
    granteeRef: "principal:jhn",
    permissions: ["cop.events.append"],
    ...overrides,
  };
}

function request(token) {
  return { headers: { authorization: `Bearer ${token}` }, body: { type: "mission.started" } };
}

test("signed capability resolves an independent, current mandate and authorizes a gateway write", async () => {
  const { publicKeys, token } = await capabilityFixture();
  const resolver = createSignedCapabilityContextResolver({
    publicKeys,
    audience,
    clock: () => now,
    resolveMandate: async (ref) => (ref === "mandate:jhn-runtime" ? activeMandate() : null),
  });
  const writes = [];
  const gateway = createPortableCopRuntimeGateway({
    executor: { insert: async (table, row) => (writes.push({ table, row }), row) },
    idFactory: () => "event:test",
    clock: () => now,
  });
  const handlers = createPortableCopRuntimeHandlers({ gateway, resolveContext: resolver });

  const response = await handlers.appendEvent(request(token));
  assert.equal(response.status, 201);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, "cop_events");
});

test("SQLite is the local authoritative mandate source", async () => {
  const { publicKeys, token } = await capabilityFixture();
  const database = new DatabaseSync(":memory:");
  database.exec(migration);
  database
    .prepare(
      "INSERT INTO cop_mandates (mandate_ref, version, status, issuer_ref, grantee_ref, permissions, issued_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      "mandate:jhn-runtime",
      3,
      "active",
      "instance:jhn",
      "principal:jhn",
      '["cop.events.append"]',
      now.toISOString(),
      now.toISOString(),
      now.toISOString()
    );
  const store = createSqliteCopRuntimeStore(database);
  const resolver = createSignedCapabilityContextResolver({
    publicKeys,
    audience,
    clock: () => now,
    resolveMandate: store.resolveMandate,
  });

  const context = await resolver(request(token));
  assert.equal(context.principal.id, "principal:jhn");
  assert.deepEqual(context.mandate.permissions, ["cop.events.append"]);
  database.close();
});

test("a tampered capability is rejected before a gateway write", async () => {
  const { publicKeys, token } = await capabilityFixture();
  const resolver = createSignedCapabilityContextResolver({
    publicKeys,
    audience,
    clock: () => now,
    resolveMandate: async () => activeMandate(),
  });
  const parts = token.split(".");
  const position = Math.floor(parts[3].length / 2);
  parts[3] = `${parts[3].slice(0, position)}${parts[3][position] === "A" ? "B" : "A"}${parts[3].slice(position + 1)}`;
  const tampered = parts.join(".");

  await assert.rejects(
    () => resolver(request(tampered)),
    (error) => {
      assert.ok(error instanceof CopCapabilityError);
      assert.equal(error.code, "COP_INVALID_CAPABILITY");
      return true;
    }
  );
});

test("expired capabilities and changed mandates are rejected locally", async () => {
  const expired = await capabilityFixture({ expiresAt: nowSeconds - 1 });
  const expiredResolver = createSignedCapabilityContextResolver({
    publicKeys: expired.publicKeys,
    audience,
    clock: () => now,
    resolveMandate: async () => activeMandate(),
  });
  await assert.rejects(() => expiredResolver(request(expired.token)), {
    code: "COP_CAPABILITY_EXPIRED",
  });

  const current = await capabilityFixture();
  const changedMandateResolver = createSignedCapabilityContextResolver({
    publicKeys: current.publicKeys,
    audience,
    clock: () => now,
    resolveMandate: async () => activeMandate({ version: 4 }),
  });
  await assert.rejects(() => changedMandateResolver(request(current.token)), {
    code: "COP_MANDATE_VERSION_MISMATCH",
  });
});
