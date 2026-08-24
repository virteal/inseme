/**
 * ACP v1 client over stdio.
 *
 * This module transports an ACP session.  It deliberately does not decide
 * authority, mandate, budgets, or which local agent is admissible: those are
 * Magistral/COP concerns that must be decided before an ACP session is opened.
 */
import { spawn as nodeSpawn } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";
import { env as processEnv, platform } from "node:process";

export const ACP_PROTOCOL_VERSION = 1;

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_PROMPT_TIMEOUT_MS = 5 * 60_000;

/**
 * A deliberately narrow ACP permission policy for a public or otherwise
 * read-only workspace.  It does not remove an agent's native inspection
 * tools; it only decides permission prompts the agent raises.  Unknown
 * requests fail closed, while a small set of one-shot, local read commands
 * can proceed without turning a conversational turn into an effects channel.
 */
export function createReadOnlyPermissionPolicy({ root, onDecision = () => {} } = {}) {
  assertAbsolutePath(root, "root");
  if (typeof onDecision !== "function") throw new TypeError("onDecision must be a function");
  const allowedRoot = resolve(root);

  return (params = {}) => {
    const toolCall = params.toolCall || {};
    const request = {
      session_id: params.sessionId || null,
      kind: toolCall.kind || "unknown",
      title: toolCall.title || null,
    };
    const option = oneShotAllowOption(params.options);
    let decision = { outcome: "cancelled" };
    let reason = "permission_request_not_admitted";

    if (toolCall.kind === "execute") {
      const input = toolCall.rawInput || {};
      request.command = typeof input.command === "string" ? input.command : null;
      request.cwd = typeof input.cwd === "string" ? input.cwd : null;
      if (option && isSafeReadCommand(input.command, input.cwd, allowedRoot)) {
        decision = { outcome: "selected", optionId: option.optionId };
        reason = "one_shot_local_read_command";
      } else {
        reason = "command_not_a_scoped_read_operation";
      }
    } else if (toolCall.kind === "edit") {
      reason = "file_write_not_admitted";
    } else if (toolCall.kind === "other") {
      reason = "permission_escalation_not_admitted";
    }

    onDecision({
      ...request,
      decision: decision.outcome,
      option_id: decision.optionId || null,
      reason,
    });
    return decision;
  };
}

export class AcpProtocolError extends Error {
  constructor(message, { code, data } = {}) {
    super(message);
    this.name = "AcpProtocolError";
    this.code = code;
    this.data = data;
  }
}

/**
 * Start an ACP v1 agent subprocess and complete the mandatory handshake.
 *
 * `mcpServers` are intentionally opt-in per session.  A caller that supplies
 * them must provide `allowMcpServer`; this makes a nested Cogentia ->
 * Magistral -> ACP loop an explicit policy decision, never ambient behaviour.
 */
export async function connectAcpStdio({
  command,
  args = [],
  cwd,
  env = {},
  clientInfo = { name: "magistral", title: "Magistral", version: "1.0.0" },
  clientCapabilities = {},
  requestPermission = () => ({ outcome: "cancelled" }),
  onSessionUpdate = () => {},
  spawnImpl = nodeSpawn,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  promptTimeoutMs = DEFAULT_PROMPT_TIMEOUT_MS,
} = {}) {
  if (!command) throw new TypeError("command is required");
  if (!cwd || !isAbsolute(cwd)) throw new TypeError("cwd must be an absolute path");
  if (typeof requestPermission !== "function")
    throw new TypeError("requestPermission must be a function");
  if (typeof onSessionUpdate !== "function")
    throw new TypeError("onSessionUpdate must be a function");

  const process = spawnImpl(command, args, {
    cwd,
    env: { ...processEnv, ...env },
    stdio: ["pipe", "pipe", "pipe"],
    // Windows npm exposes executable shims as .cmd files. Node can execute a
    // binary directly, but requires a shell for these local command wrappers.
    shell: platform === "win32" && /\.(?:cmd|bat)$/i.test(command),
  });
  const connection = new AcpStdioConnection({
    process,
    requestPermission,
    onSessionUpdate,
    requestTimeoutMs,
    promptTimeoutMs,
  });

  try {
    const initialization = await connection.request("initialize", {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities,
      clientInfo,
    });
    if (initialization?.protocolVersion !== ACP_PROTOCOL_VERSION) {
      throw new AcpProtocolError("acp_protocol_version_mismatch", {
        data: { expected: ACP_PROTOCOL_VERSION, received: initialization?.protocolVersion },
      });
    }
    return new AcpClient(connection, initialization);
  } catch (error) {
    connection.terminate();
    throw error;
  }
}

export class AcpClient {
  constructor(connection, initialization) {
    this.connection = connection;
    this.initialization = initialization;
    this.agentCapabilities = initialization.agentCapabilities || {};
  }

  async newSession({ cwd, mcpServers = [], allowMcpServer, additionalDirectories } = {}) {
    assertAbsolutePath(cwd, "cwd");
    assertMcpServers(mcpServers, allowMcpServer);
    const params = { cwd, mcpServers };
    if (additionalDirectories !== undefined) {
      if (!this.agentCapabilities.sessionCapabilities?.additionalDirectories) {
        throw new AcpProtocolError("acp_additional_directories_unsupported");
      }
      params.additionalDirectories = additionalDirectories;
    }
    const result = await this.connection.request("session/new", params);
    if (!result?.sessionId) throw new AcpProtocolError("acp_session_id_missing");
    return result;
  }

  async prompt({ sessionId, prompt }) {
    if (!sessionId) throw new TypeError("sessionId is required");
    if (!Array.isArray(prompt) || prompt.length === 0)
      throw new TypeError("prompt must be a non-empty array");
    return this.connection.request(
      "session/prompt",
      { sessionId, prompt },
      this.connection.promptTimeoutMs
    );
  }

  cancel(sessionId) {
    if (!sessionId) throw new TypeError("sessionId is required");
    this.connection.cancelSession(sessionId);
  }

  async resumeSession({ sessionId, cwd, mcpServers = [], allowMcpServer } = {}) {
    if (!this.agentCapabilities.sessionCapabilities?.resume) {
      throw new AcpProtocolError("acp_session_resume_unsupported");
    }
    if (!sessionId) throw new TypeError("sessionId is required");
    assertAbsolutePath(cwd, "cwd");
    assertMcpServers(mcpServers, allowMcpServer);
    return this.connection.request("session/resume", { sessionId, cwd, mcpServers });
  }

  async closeSession(sessionId) {
    if (!sessionId) throw new TypeError("sessionId is required");
    if (!this.agentCapabilities.sessionCapabilities?.close) return false;
    await this.connection.request("session/close", { sessionId });
    return true;
  }

  terminate() {
    this.connection.terminate();
  }
}

class AcpStdioConnection {
  constructor({ process, requestPermission, onSessionUpdate, requestTimeoutMs, promptTimeoutMs }) {
    this.process = process;
    this.requestPermission = requestPermission;
    this.onSessionUpdate = onSessionUpdate;
    this.requestTimeoutMs = requestTimeoutMs;
    this.promptTimeoutMs = promptTimeoutMs;
    this.nextId = 0;
    this.pending = new Map();
    this.pendingPermissions = new Map();
    this.stdoutBuffer = "";
    this.closed = false;
    process.stdout?.on("data", (chunk) => this.read(chunk));
    process.once("error", (error) => this.close(error));
    process.once("close", () => this.close(new AcpProtocolError("acp_connection_closed")));
  }

  request(method, params, timeoutMs = this.requestTimeoutMs) {
    if (this.closed) return Promise.reject(new AcpProtocolError("acp_connection_closed"));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new AcpProtocolError(`acp_request_timeout:${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method, params) {
    if (this.closed) throw new AcpProtocolError("acp_connection_closed");
    this.write({ jsonrpc: "2.0", method, params });
  }

  cancelSession(sessionId) {
    for (const [id, pending] of this.pendingPermissions) {
      if (pending.sessionId !== sessionId) continue;
      this.pendingPermissions.delete(id);
      this.write({ jsonrpc: "2.0", id, result: { outcome: "cancelled" } });
    }
    this.notify("session/cancel", { sessionId });
  }

  read(chunk) {
    this.stdoutBuffer += String(chunk);
    let newline;
    while ((newline = this.stdoutBuffer.indexOf("\n")) !== -1) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        this.close(new AcpProtocolError("acp_invalid_json_from_agent"));
        return;
      }
      if (message.jsonrpc !== "2.0") {
        this.close(new AcpProtocolError("acp_invalid_jsonrpc_version"));
        return;
      }
      this.handle(message);
    }
  }

  handle(message) {
    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(
          new AcpProtocolError(message.error.message || "acp_request_failed", message.error)
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (message.method === "session/update") {
      this.onSessionUpdate(message.params);
      return;
    }
    if (message.method === "session/request_permission" && message.id !== undefined) {
      this.pendingPermissions.set(message.id, { sessionId: message.params?.sessionId });
      Promise.resolve(this.requestPermission(message.params))
        .then((result) => this.resolvePermission(message.id, result || { outcome: "cancelled" }))
        .catch((error) => this.rejectPermission(message.id, error));
      return;
    }
    if (message.id !== undefined) this.writeError(message.id, -32601, "method_not_supported");
  }

  write(message) {
    if (this.closed) throw new AcpProtocolError("acp_connection_closed");
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  writeError(id, code, message) {
    this.write({ jsonrpc: "2.0", id, error: { code, message } });
  }

  resolvePermission(id, result) {
    if (!this.pendingPermissions.delete(id) || this.closed) return;
    this.write({ jsonrpc: "2.0", id, result });
  }

  rejectPermission(id, error) {
    if (!this.pendingPermissions.delete(id) || this.closed) return;
    this.writeError(id, -32603, error.message || "permission_handler_failed");
  }

  close(error) {
    if (this.closed) return;
    this.closed = true;
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
    this.pendingPermissions.clear();
  }

  terminate() {
    if (!this.closed) this.close(new AcpProtocolError("acp_connection_terminated"));
    if (!this.process.killed) this.process.kill("SIGTERM");
  }
}

function assertAbsolutePath(value, name) {
  if (!value || !isAbsolute(value)) throw new TypeError(`${name} must be an absolute path`);
}

function assertMcpServers(mcpServers, allowMcpServer) {
  if (!Array.isArray(mcpServers)) throw new TypeError("mcpServers must be an array");
  if (mcpServers.length > 0 && typeof allowMcpServer !== "function") {
    throw new AcpProtocolError("acp_mcp_servers_require_explicit_admission");
  }
  for (const server of mcpServers) {
    if (!allowMcpServer?.(server)) throw new AcpProtocolError("acp_mcp_server_not_admitted");
  }
}

function oneShotAllowOption(options) {
  if (!Array.isArray(options)) return null;
  return options.find((option) => option?.kind === "allow_once" && option.optionId) || null;
}

function isSafeReadCommand(command, cwd, allowedRoot) {
  if (typeof command !== "string" || typeof cwd !== "string" || !isInside(cwd, allowedRoot))
    return false;
  const trimmed = command.trim();
  // Shell composition, redirection and interpolation are effects surfaces,
  // even where the leading word happens to look like an inspection command.
  if (!trimmed || /[|&;><`]|\$\(|\r|\n/.test(trimmed)) return false;
  const tokens = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const executable = tokens[0]?.replace(/^['"]|['"]$/g, "").toLowerCase();
  const subcommand = tokens[1]?.toLowerCase();
  if (
    ["rg", "ls", "dir", "pwd", "type", "head", "tail", "get-childitem", "get-content"].includes(
      executable
    )
  ) {
    if (executable === "rg" && tokens.some((token) => /^--pre(?:=|$)/.test(token))) return false;
    return true;
  }
  return (
    executable === "git" &&
    ["status", "diff", "log", "show", "branch", "ls-files", "grep"].includes(subcommand) &&
    !tokens.some((token) => /^(--ext-diff|--textconv)$/.test(token))
  );
}

function isInside(candidate, root) {
  if (!isAbsolute(candidate)) return false;
  const path = resolve(candidate);
  const pathRelative = relative(root, path);
  return pathRelative === "" || (!pathRelative.startsWith("..") && !isAbsolute(pathRelative));
}
