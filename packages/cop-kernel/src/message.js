// File: packages/cop-kernel/src/message.js
// Description: Constructors for COP_MESSAGE and COP_EVENT, plus COP_VERSION constant.

export const COP_VERSION = "0.2.0";

/**
 * Create a COP_MESSAGE envelope.
 */
export function mkCopMessage({
  from,
  to,
  intent,
  payload,
  channel,
  correlationId,
  metadata,
  auth,
}) {
  if (!from || !to || !intent) {
    throw new Error("mkCopMessage: 'from', 'to' and 'intent' are required");
  }

  const messageId = crypto.randomUUID();

  return {
    cop_version: COP_VERSION,
    message_id: messageId,
    correlation_id: correlationId || null,

    from,
    to,

    intent,
    payload: payload || {},

    channel: channel || null,
    metadata: metadata || {},

    auth: auth || null,
  };
}

/**
 * Create a COP_EVENT envelope.
 */
export function mkCopEvent({ from, channel, event_type, payload, correlationId, metadata }) {
  if (!from || !channel || !event_type) {
    throw new Error("mkCopEvent: 'from', 'channel' and 'event_type' are required");
  }

  const eventId = crypto.randomUUID();

  return {
    cop_version: COP_VERSION,
    event_id: eventId,
    correlation_id: correlationId || null,

    from,
    channel,

    event_type,
    payload: payload || {},

    metadata: metadata || {},
  };
}
