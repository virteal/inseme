import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createJhnLocalCopRuntime } from "../cop/localRuntimeServer.js";
import { createJhnLocalCapabilityIssuer } from "../cop/localCapabilityIssuer.js";
import { bootstrapJhnLocalCopAuthority } from "../../scripts/bootstrap-jhn-cop-local.js";

const now = new Date("2026-08-01T12:00:00.000Z");
const clock = () => now;

test("JHN local runtime accepts a signed loopback write and rejects anonymous writes", async () => {
  const stateDirectory = await mkdtemp(path.join(os.tmpdir(), "jhn-cop-runtime-"));
  let runtime;
  let issuer;
  try {
    await bootstrapJhnLocalCopAuthority({ stateDirectory, clock });
    issuer = await createJhnLocalCapabilityIssuer({ stateDirectory, clock });
    const token = await issuer.issue({ subject: "principal:jhn:runtime" });
    runtime = await createJhnLocalCopRuntime({ stateDirectory, clock });
    const address = await runtime.listen();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${baseUrl}/health`);
    assert.deepEqual(await health.json(), { status: "ok", scope: "loopback" });

    const anonymous = await fetch(`${baseUrl}/cop/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "mission.started" }),
    });
    assert.equal(anonymous.status, 401);

    const accepted = await fetch(`${baseUrl}/cop/events`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ type: "mission.started", payload: { source: "loopback-test" } }),
    });
    assert.equal(accepted.status, 201);
  } finally {
    if (issuer) issuer.close();
    if (runtime) await runtime.close();
    await rm(stateDirectory, { recursive: true, force: true });
  }
});
