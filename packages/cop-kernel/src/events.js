// File: packages/cop-kernel/src/events.js
// Description:
//   Helper to emit COP_EVENTs by calling the /cop-events endpoint.
//   Usage (Edge example):
//     await emitCopEvent({
//       baseUrl: new URL(context.request.url).origin,
//       from: msg.to,
//       channel: msg.channel,
//       eventType: "echo.received",
//       payload: { original_payload: msg.payload },
//       correlationId: msg.correlation_id || msg.message_id,
//       metadata: { agentName: agent.agentName },
//     });

import { COP_VERSION } from "./message.js";

/**
 * Emit a COP_EVENT to the COP events endpoint.
 *
 * You must provide either:
 *   - endpoint: full URL string to /cop-events
 *   OR
 *   - baseUrl: origin/base URL (ex: "https://example.netlify.app")
 *     and optionally path (default: "/cop-events").
 *
 * @param {Object} params
 * @param {string} [params.endpoint]      - Full URL to /cop-events
 * @param {string} [params.baseUrl]       - Base URL (origin)
 * @param {string} [params.path="/cop-events"] - Path to events endpoint
 * @param {string} params.from            - COP_ADDR of emitter
 * @param {string} params.channel         - COPCHAN_ADDR of channel
 * @param {string} params.eventType       - Functional event type
 * @param {Object} [params.payload={}]    - Event payload
 * @param {Object} [params.metadata={}]   - Event metadata
 * @param {string} [params.correlationId] - Optional correlation_id
 * @param {string} [params.eventId]       - Optional explicit event_id
 * @param {string} [params.copVersion]    - COP version (default COP_VERSION)
 * @param {boolean} [params.throwOnError=true] - Throw on error if true
 *
 * @returns {Promise<{event: object, ok: boolean, status: number, error?: string}>}
 */
export async function emitCopEvent(params) {
  const {
    endpoint,
    baseUrl,
    path = "/cop-events",
    from,
    channel,
    eventType,
    payload = {},
    metadata = {},
    correlationId = null,
    eventId,
    copVersion = COP_VERSION,
    throwOnError = true,
  } = params || {};

  if (!endpoint && !baseUrl) {
    throw new Error("emitCopEvent: either 'endpoint' or 'baseUrl' must be provided");
  }
  if (!from) {
    throw new Error("emitCopEvent: 'from' is required");
  }
  if (!channel) {
    throw new Error("emitCopEvent: 'channel' is required");
  }
  if (!eventType) {
    throw new Error("emitCopEvent: 'eventType' is required");
  }

  let finalEventId = eventId;
  if (!finalEventId) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      finalEventId = crypto.randomUUID();
    } else {
      finalEventId = String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    }
  }

  const ev = {
    cop_version: copVersion,
    event_id: finalEventId,
    correlation_id: correlationId || null,
    from,
    channel,
    event_type: eventType,
    payload,
    metadata,
  };

  const url = endpoint || new URL(path, baseUrl).toString();

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ev),
    });
  } catch (err) {
    if (throwOnError) {
      throw new Error("emitCopEvent: network error: " + (err && err.message));
    }
    return {
      event: ev,
      ok: false,
      status: 0,
      error: "network: " + (err && err.message),
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const errMsg = `emitCopEvent: HTTP ${res.status} – ${text.slice(0, 256)}`;
    if (throwOnError) {
      throw new Error(errMsg);
    }
    return {
      event: ev,
      ok: false,
      status: res.status,
      error: errMsg,
    };
  }

  return {
    event: ev,
    ok: true,
    status: res.status,
  };
}
