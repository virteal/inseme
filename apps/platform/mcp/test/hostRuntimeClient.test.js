import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createHostRuntimeClient, fractaCodexRuntime } from "../cop/hostRuntimeClient.js";

function fakeSpawn({ stdout = "", stderr = "", code = 0 } = {}) {
  const calls = [];
  const spawn = (command, args) => {
    calls.push({ command, args });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => child.emit("close", 1, "SIGTERM");
    queueMicrotask(() => {
      child.stdout.end(stdout);
      child.stderr.end(stderr);
      child.emit("close", code, null);
    });
    return child;
  };
  return { spawn, calls };
}

test("Fracta Codex runtime is a replaceable read-only COP handler", async () => {
  const fake = fakeSpawn({ stdout: "codex-cli 0.144.5\n" });
  const runtime = fractaCodexRuntime({ command: "/usr/local/node/bin/codex" });
  const client = createHostRuntimeClient({ runtimes: [runtime], spawnImpl: fake.spawn });

  assert.deepEqual(
    client.resolve({ capability: "coding.assist.read" }).map((item) => item.id),
    ["runtime:fracta:codex"]
  );
  const probe = await client.probe("runtime:fracta:codex");
  assert.equal(probe.available, true);
  assert.equal(probe.version, "codex-cli 0.144.5");

  const handler = client.asHandler("runtime:fracta:codex", {
    working_directory: "/srv/cogentia/repos/cogentia",
  });
  const effect = await handler.invoke({
    message: "Summarize this repository without changing files.",
  });
  assert.equal(handler.id, "handler:fracta:codex@v0.144.5");
  assert.equal(effect.execution_surface, "cli");
  assert.deepEqual(fake.calls.at(-1).args.slice(0, 7), [
    "exec",
    "--ephemeral",
    "--json",
    "--sandbox",
    "read-only",
    "--cd",
    "/srv/cogentia/repos/cogentia",
  ]);
});
