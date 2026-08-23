import readline from "node:readline";

let nextSession = 0;
let nextPermission = 90;
const pendingPrompts = new Map();
const permissions = new Map();
const mode = process.argv[2] || "normal";

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: mode === "version-mismatch" ? 2 : 1,
        agentCapabilities: { sessionCapabilities: { close: {}, resume: {} } },
        agentInfo: { name: "fake-acp-agent", version: "1.0.0" },
        authMethods: [],
      },
    });
    return;
  }
  if (message.method === "session/new") {
    send({ jsonrpc: "2.0", id: message.id, result: { sessionId: `session-${++nextSession}` } });
    return;
  }
  if (message.method === "session/prompt") {
    const text = message.params.prompt.find((item) => item.type === "text")?.text || "";
    if (text.includes("permission")) {
      const permissionId = ++nextPermission;
      pendingPrompts.set(message.params.sessionId, message.id);
      permissions.set(permissionId, message.params.sessionId);
      send({
        jsonrpc: "2.0",
        id: permissionId,
        method: "session/request_permission",
        params: { sessionId: message.params.sessionId, toolCall: { title: "fake tool" } },
      });
      return;
    }
    if (mode === "invalid-json") {
      process.stdout.write("not ACP JSON\n");
      return;
    }
    if (mode === "timeout") return;
    send({
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: message.params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          messageId: "message-1",
          content: { type: "text", text: "fake ACP answer" },
        },
      },
    });
    send({ jsonrpc: "2.0", id: message.id, result: { stopReason: "end_turn" } });
    return;
  }
  if (message.method === "session/cancel") {
    const promptId = pendingPrompts.get(message.params.sessionId);
    if (promptId !== undefined) {
      pendingPrompts.delete(message.params.sessionId);
      send({ jsonrpc: "2.0", id: promptId, result: { stopReason: "cancelled" } });
    }
    return;
  }
  if (message.method === "session/resume") {
    send({ jsonrpc: "2.0", id: message.id, result: {} });
    return;
  }
  if (message.method === "session/close") {
    send({ jsonrpc: "2.0", id: message.id, result: {} });
    return;
  }
  if (permissions.has(message.id)) {
    const sessionId = permissions.get(message.id);
    permissions.delete(message.id);
    send({
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: "call-1",
          status: message.result?.outcome === "cancelled" ? "cancelled" : "in_progress",
        },
      },
    });
  }
});
