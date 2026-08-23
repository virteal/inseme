import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import {
  acpStdioRuntime,
  createHostRuntimeClient,
  fractaCodexRuntime,
} from "../cop/hostRuntimeClient.js";

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
  assert.equal(effect.context_inheritance, "ambient-host");
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

function fakeAcpSpawn() {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      child.killed = true;
      child.emit("close", 0, "SIGTERM");
    };
    child.stdin.on("data", (chunk) => {
      for (const line of String(chunk).trim().split("\n")) {
        const request = JSON.parse(line);
        if (request.method === "session/prompt") {
          child.stdout.write(
            `${JSON.stringify({ jsonrpc: "2.0", method: "session/update", params: { update: { content: "ACP answer" } } })}\n`
          );
          child.stdout.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { stopReason: "end_turn" } })}\n`
          );
        } else {
          const result =
            request.method === "initialize"
              ? { protocolVersion: 1, agentCapabilities: {}, authMethods: [] }
              : request.method === "session/new"
                ? { sessionId: "session-1" }
                : {};
          child.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result })}\n`);
        }
      }
    });
    return child;
  };
  return { spawn, calls };
}

test("ACP stdio runtime is a generic governed handler without exposing its command or environment", async () => {
  const fake = fakeAcpSpawn();
  const runtime = acpStdioRuntime({
    id: "runtime:fracta:codex-acp",
    command: "codex-acp",
    args: ["--stdio"],
    env: { ACP_LOCAL_ONLY: "true" },
    handler_instance_ref: "handler:fracta:codex-acp@test",
  });
  const client = createHostRuntimeClient({ runtimes: [runtime], spawnImpl: fake.spawn });

  const [listed] = client.resolve({ capability: "coding.assist.read", execution_surface: "acp" });
  assert.equal(listed.command, undefined);
  assert.equal(listed.env, undefined);
  const effect = await client.invoke({
    runtime_id: runtime.id,
    working_directory: "/srv/cogentia/repos/inseme",
    prompt: "Explain this repository.",
  });
  assert.equal(effect.execution_surface, "acp");
  assert.equal(effect.context_inheritance, "none");
  assert.equal(effect.text, "ACP answer");
  assert.deepEqual(fake.calls[0].args, ["--stdio"]);
  assert.equal(fake.calls[0].options.env.ACP_LOCAL_ONLY, "true");
});
