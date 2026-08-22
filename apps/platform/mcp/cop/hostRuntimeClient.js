/**
 * Shared-host runtime client.
 *
 * A HostRuntime is an installed technical resource, not a principal or a
 * LogicalAgent.  It becomes material execution only when a governed COP
 * handler invokes it under an active mandate and an execution budget.
 */
import { spawn as nodeSpawn } from "node:child_process";

const MAX_CAPTURE_BYTES = 128_000;

export function createHostRuntimeClient({ runtimes = [], spawnImpl = nodeSpawn } = {}) {
  const catalog = new Map(runtimes.map(normalizeRuntime).map((runtime) => [runtime.id, runtime]));

  return {
    list() {
      return [...catalog.values()].map(publicRuntime);
    },

    resolve({ capability, execution_surface = null } = {}) {
      if (!capability) throw new TypeError("capability is required");
      return [...catalog.values()]
        .filter((runtime) => runtime.enabled && runtime.capabilities.includes(capability))
        .filter((runtime) => !execution_surface || runtime.execution_surface === execution_surface)
        .map(publicRuntime);
    },

    async probe(id) {
      const runtime = requireRuntime(catalog, id);
      const result = await runProcess(spawnImpl, runtime.command, runtime.probe_args, {
        timeout_ms: runtime.probe_timeout_ms,
      });
      return {
        runtime: publicRuntime(runtime),
        available: result.exit_code === 0 && !result.timed_out,
        version: compactText(result.stdout),
        error:
          result.exit_code === 0 && !result.timed_out
            ? null
            : compactText(result.stderr || result.stdout),
      };
    },

    /** Return the existing COP handler shape; authority remains outside this client. */
    asHandler(id, defaults = {}) {
      const runtime = requireRuntime(catalog, id);
      return {
        id: runtime.handler_instance_ref,
        capability: defaults.capability || runtime.capabilities[0],
        invoke: (input) =>
          this.invoke({
            runtime_id: id,
            prompt: String(input?.message || ""),
            working_directory: defaults.working_directory,
          }),
      };
    },

    async invoke({ runtime_id, prompt, working_directory } = {}) {
      const runtime = requireRuntime(catalog, runtime_id);
      if (!runtime.enabled) throw new Error(`runtime_disabled:${runtime_id}`);
      if (!prompt) throw new TypeError("prompt is required");
      if (runtime.adapter !== "codex_exec_jsonl") {
        throw new Error(`unsupported_runtime_adapter:${runtime.adapter}`);
      }
      if (!working_directory) throw new TypeError("working_directory is required");

      const result = await runProcess(
        spawnImpl,
        runtime.command,
        [
          "exec",
          "--ephemeral",
          "--json",
          "--sandbox",
          runtime.sandbox,
          "--cd",
          working_directory,
          prompt,
        ],
        { timeout_ms: runtime.invoke_timeout_ms }
      );
      if (result.exit_code !== 0 || result.timed_out) {
        throw new Error(
          `runtime_invocation_failed:${runtime_id}:${compactText(result.stderr || result.stdout)}`
        );
      }
      return {
        text: compactText(result.stdout),
        handler_profile_ref: runtime.handler_profile_ref,
        handler_instance_ref: runtime.handler_instance_ref,
        execution_surface: runtime.execution_surface,
        runtime_id: runtime.id,
        execution_usage: { max_steps: 1, max_elapsed_ms: result.elapsed_ms },
      };
    },
  };
}

export function fractaCodexRuntime({
  command,
  handler_instance_ref = "handler:fracta:codex@v0.144.5",
} = {}) {
  if (!command) throw new TypeError("command is required");
  return {
    id: "runtime:fracta:codex",
    handler_instance_ref,
    handler_profile_ref: "handler-profile:coding-agent-cli",
    execution_surface: "cli",
    adapter: "codex_exec_jsonl",
    command,
    capabilities: ["coding.assist.read"],
    sandbox: "read-only",
    probe_args: ["--version"],
    probe_timeout_ms: 5_000,
    invoke_timeout_ms: 240_000,
    enabled: true,
  };
}

function normalizeRuntime(value) {
  if (!value?.id || !value?.command || !value?.handler_instance_ref)
    throw new TypeError("runtime id, command and handler_instance_ref are required");
  return {
    ...value,
    capabilities: [...new Set(value.capabilities || [])],
    execution_surface: value.execution_surface || "cli",
    sandbox: value.sandbox || "read-only",
    probe_args: value.probe_args || ["--version"],
    probe_timeout_ms: value.probe_timeout_ms || 5_000,
    invoke_timeout_ms: value.invoke_timeout_ms || 240_000,
    enabled: value.enabled !== false,
  };
}

function publicRuntime(runtime) {
  const { command, ...safe } = runtime;
  return safe;
}

function requireRuntime(catalog, id) {
  const runtime = catalog.get(id);
  if (!runtime) throw new Error(`unknown_runtime:${id}`);
  return runtime;
}

function compactText(value) {
  return String(value || "")
    .slice(0, MAX_CAPTURE_BYTES)
    .trim();
}

function runProcess(spawnImpl, command, args, { timeout_ms }) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawnImpl(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timed_out = false;
    const capture = (target, chunk) => `${target}${chunk}`.slice(0, MAX_CAPTURE_BYTES);
    child.stdout?.on("data", (chunk) => {
      stdout = capture(stdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = capture(stderr, chunk);
    });
    const timer = setTimeout(() => {
      timed_out = true;
      child.kill("SIGTERM");
    }, timeout_ms);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        exit_code: Number.isInteger(code) ? code : 1,
        signal: signal || null,
        timed_out,
        stdout,
        stderr,
        elapsed_ms: Date.now() - started,
      });
    });
  });
}
