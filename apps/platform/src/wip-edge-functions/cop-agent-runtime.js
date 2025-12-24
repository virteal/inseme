// File: netlify/edge-functions/cop-agent-runtime.js

import { parseCopAddr } from "../../packages/cop-kernel/src/address.js";
import { validateCopMessage } from "../../packages/cop-kernel/src/validation.js";
import { getLocalNodeConfig } from "../../packages/cop-kernel/src/nodeRegistry.js";
import { resolveAgent } from "../../packages/cop-kernel/src/agentRegistry.js";
import { COP_VERSION } from "../../packages/cop-kernel/src/message.js";
import { logCopDebug } from "../../packages/cop-kernel/src/debugLog.js";
import { emitCopEvent } from "../../packages/cop-kernel/src/events.js";

// Table de handlers locaux d'exemple.
const LOCAL_AGENT_HANDLERS = {
  echo: handleEchoAgent,
};

export default async (request, context) => {
  if (request.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is allowed");
  }

  let msg;
  try {
    msg = await request.json();
  } catch (err) {
    return jsonError(400, "INVALID_JSON", "Request body is not valid JSON", {
      detail: String(err && err.message),
    });
  }

  await logCopDebug({
    correlationId: msg.correlation_id || msg.message_id || null,
    messageId: msg.message_id || null,
    location: "cop-agent-runtime",
    stage: "received",
    direction: "in",
    metadata: { msg },
  });

  try {
    validateCopMessage(msg);
  } catch (err) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop-agent-runtime",
      stage: "validation_error",
      direction: "internal",
      metadata: { error: String(err && err.message) },
    });

    return jsonError(400, "INVALID_COP_MESSAGE", "COP_MESSAGE validation failed", {
      detail: String(err && err.message),
    });
  }

  const local = getLocalNodeConfig();

  let to;
  try {
    to = parseCopAddr(msg.to);
  } catch (err) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop-agent-runtime",
      stage: "invalid_to_address",
      direction: "internal",
      metadata: { to: msg.to, error: String(err && err.message) },
    });

    return jsonError(400, "INVALID_TO_ADDRESS", "Field 'to' is not a valid COP_ADDR", {
      to: msg.to,
      detail: String(err && err.message),
    });
  }

  if (to.networkId !== local.networkId || to.nodeId !== local.nodeId) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop-agent-runtime",
      stage: "wrong_node",
      direction: "internal",
      metadata: {
        expected: { networkId: local.networkId, nodeId: local.nodeId },
        got: { networkId: to.networkId, nodeId: to.nodeId },
      },
    });

    return jsonError(400, "WRONG_NODE", "COP_MESSAGE not intended for this node runtime", {
      expected: { networkId: local.networkId, nodeId: local.nodeId },
      got: { networkId: to.networkId, nodeId: to.nodeId },
    });
  }

  let agent;
  try {
    agent = await resolveAgent(to.networkId, to.nodeId, to.instanceId, to.agentName);
  } catch (err) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop-agent-runtime",
      stage: "agent_resolution_error",
      direction: "internal",
      metadata: { error: String(err && err.message), to },
    });

    return jsonError(500, "AGENT_RESOLUTION_FAILED", "Failed to resolve agent configuration", {
      detail: String(err && err.message),
    });
  }

  if (!agent || !agent.active) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop-agent-runtime",
      stage: "agent_not_found",
      direction: "internal",
      metadata: { to },
    });

    return jsonError(404, "AGENT_NOT_FOUND", "No active agent configuration for " + msg.to, null);
  }

  const handler = LOCAL_AGENT_HANDLERS[agent.agentName];
  if (!handler) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop-agent-runtime",
      stage: "handler_not_implemented",
      direction: "internal",
      metadata: { agent },
    });

    return jsonError(
      501,
      "HANDLER_NOT_IMPLEMENTED",
      "No local handler implemented for agent " + agent.agentName,
      null
    );
  }

  try {
    const res = await handler(agent, msg, context);

    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop-agent-runtime",
      stage: "handled",
      direction: "out",
      metadata: { agentName: agent.agentName },
    });

    return res;
  } catch (err) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop-agent-runtime",
      stage: "handler_error",
      direction: "internal",
      metadata: { agentName: agent.agentName, error: String(err && err.message) },
    });

    return jsonError(500, "AGENT_RUNTIME_ERROR", "Agent handler threw an error", {
      agentName: agent.agentName,
      detail: String(err && err.message),
    });
  }
};

async function handleEchoAgent(agent, msg, context) {
  const reply = {
    cop_version: COP_VERSION,
    message_id: crypto.randomUUID(),
    correlation_id: msg.correlation_id || msg.message_id,

    from: msg.to,
    to: msg.from,

    intent: "echo.response",
    payload: { echo: msg.payload },

    channel: msg.channel || null,
    metadata: {},
    auth: null,
  };

  return new Response(JSON.stringify(reply), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(status, code, message, details) {
  const body = {
    status: "error",
    error: {
      code,
      message,
      details: details || null,
    },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
