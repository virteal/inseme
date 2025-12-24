// File: netlify/edge-functions/cop.js

import { parseCopAddr } from "../../packages/cop-kernel/src/address.js";
import { validateCopMessage } from "../../packages/cop-kernel/src/validation.js";
import {
  getLocalNodeConfig,
  ensureLocalNodeRegistered,
  resolveNode,
} from "../../packages/cop-kernel/src/nodeRegistry.js";
import { logCopDebug } from "../../packages/cop-kernel/src/debugLog.js";

export default async (request, context) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let msg;
  try {
    msg = await request.json();
  } catch (err) {
    return jsonError(400, "INVALID_JSON", "Request body is not valid JSON", {
      detail: String(err && err.message),
    });
  }

  // Log réception brute
  await logCopDebug({
    correlationId: msg.correlation_id || msg.message_id || null,
    messageId: msg.message_id || null,
    location: "cop",
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
      location: "cop",
      stage: "validation_error",
      direction: "internal",
      metadata: { error: String(err && err.message) },
    });

    return jsonError(400, "INVALID_COP_MESSAGE", "COP_MESSAGE validation failed", {
      detail: String(err && err.message),
    });
  }

  let localNode;
  try {
    localNode = await ensureLocalNodeRegistered();
  } catch (err) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop",
      stage: "node_registration_error",
      direction: "internal",
      metadata: { error: String(err && err.message) },
    });

    return jsonError(500, "NODE_REGISTRATION_FAILED", "Failed to register or load local CopNode", {
      detail: String(err && err.message),
    });
  }

  let to;
  try {
    to = parseCopAddr(msg.to);
  } catch (err) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop",
      stage: "invalid_to_address",
      direction: "internal",
      metadata: { to: msg.to, error: String(err && err.message) },
    });

    return jsonError(400, "INVALID_TO_ADDRESS", "Field 'to' is not a valid COP_ADDR", {
      to: msg.to,
      detail: String(err && err.message),
    });
  }

  // Routage local
  if (to.networkId === localNode.networkId && to.nodeId === localNode.nodeId) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop",
      stage: "forward_local_runtime",
      direction: "out",
      metadata: { to },
    });

    return await forwardToLocalRuntime(request, msg);
  }

  // Routage distant
  let targetNode;
  try {
    targetNode = await resolveNode(to.networkId, to.nodeId);
  } catch (err) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop",
      stage: "node_resolution_error",
      direction: "internal",
      metadata: {
        to,
        error: String(err && err.message),
      },
    });

    return jsonError(502, "NODE_RESOLUTION_FAILED", "Failed to resolve target CopNode", {
      networkId: to.networkId,
      nodeId: to.nodeId,
      detail: String(err && err.message),
    });
  }

  await logCopDebug({
    correlationId: msg.correlation_id || msg.message_id || null,
    messageId: msg.message_id || null,
    location: "cop",
    stage: "forward_remote_node",
    direction: "out",
    metadata: { to, targetNode },
  });

  return await forwardToRemoteNode(request, msg, targetNode);
};

async function forwardToLocalRuntime(request, msg) {
  const url = new URL("/cop-agent-runtime", request.url).toString();

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msg),
    });
  } catch (err) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop",
      stage: "local_runtime_unreachable",
      direction: "out",
      metadata: { error: String(err && err.message) },
    });

    return jsonError(502, "LOCAL_RUNTIME_UNREACHABLE", "Failed to reach local COP agent runtime", {
      detail: String(err && err.message),
    });
  }

  const text = await res.text();

  await logCopDebug({
    correlationId: msg.correlation_id || msg.message_id || null,
    messageId: msg.message_id || null,
    location: "cop",
    stage: "local_runtime_response",
    direction: "in",
    metadata: {
      status: res.status,
      bodySnippet: text.slice(0, 512),
    },
  });

  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}

async function forwardToRemoteNode(request, msg, targetNode) {
  const url = new URL(targetNode.copPath || "/cop", targetNode.baseUrl).toString();

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msg),
    });
  } catch (err) {
    await logCopDebug({
      correlationId: msg.correlation_id || msg.message_id || null,
      messageId: msg.message_id || null,
      location: "cop",
      stage: "remote_unreachable",
      direction: "out",
      metadata: {
        baseUrl: targetNode.baseUrl,
        copPath: targetNode.copPath,
        error: String(err && err.message),
      },
    });

    return jsonError(502, "REMOTE_NODE_UNREACHABLE", "Failed to reach remote CopNode", {
      baseUrl: targetNode.baseUrl,
      copPath: targetNode.copPath,
      detail: String(err && err.message),
    });
  }

  const text = await res.text();

  await logCopDebug({
    correlationId: msg.correlation_id || msg.message_id || null,
    messageId: msg.message_id || null,
    location: "cop",
    stage: "remote_response",
    direction: "in",
    metadata: {
      status: res.status,
      bodySnippet: text.slice(0, 512),
    },
  });

  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
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
    headers: {
      "Content-Type": "application/json",
    },
  });
}
