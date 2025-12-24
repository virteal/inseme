// File: packages/cop-kernel/src/call.js
// Description:
//   High-level helpers to call another agent with a COP continuation
//   and to resume an existing continuation.

import {
  createContinuationDescriptor,
  attachContinuationToMessage,
  buildContinuationResumeMessage,
} from "./continuation.js";
import { COP_VERSION } from "./message.js";
import { postCopMessage } from "./transport.js";

/**
 * High-level helper:
 *  - build a continuation descriptor
 *  - attach it to a COP_MESSAGE
 *  - POST it to /cop
 *
 * @param {Object} params
 * @param {string} params.from
 * @param {string} params.to
 * @param {string} params.intent
 * @param {Object} params.payload
 * @param {string} [params.channel]
 *
 * @param {string} params.resumeTo
 * @param {string} params.resumeIntent
 *
 * @param {string} [params.correlationId]
 * @param {string} [params.taskId]
 * @param {string} [params.stepId]
 *
 * @param {string} [params.endpoint]
 * @param {string} [params.baseUrl]
 */
export async function callAgentWithContinuation(params) {
  const {
    from,
    to,
    intent,
    payload,
    channel = null,

    resumeTo,
    resumeIntent,

    correlationId = null,
    taskId = null,
    stepId = null,

    endpoint,
    baseUrl,
  } = params || {};

  if (!from) throw new Error("callAgentWithContinuation: 'from' is required");
  if (!to) throw new Error("callAgentWithContinuation: 'to' is required");
  if (!intent) throw new Error("callAgentWithContinuation: 'intent' is required");
  if (!resumeTo) throw new Error("callAgentWithContinuation: 'resumeTo' is required");
  if (!resumeIntent) throw new Error("callAgentWithContinuation: 'resumeIntent' is required");

  const continuation = createContinuationDescriptor({
    resumeTo,
    resumeIntent,
    correlationId,
    channel,
    taskId,
    stepId,
  });

  const message = attachContinuationToMessage(
    {
      cop_version: COP_VERSION,
      message_id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      correlation_id: correlationId || continuation.continuationId,
      from,
      to,
      intent,
      channel,
      payload,
      metadata: {},
      auth: null,
    },
    continuation
  );

  const res = await postCopMessage({ message, endpoint, baseUrl });

  return {
    ok: res.ok,
    message,
    continuation,
    response: res.response,
    error: res.error,
  };
}

/**
 * High-level helper:
 *  - build a continuation resume COP_MESSAGE
 *  - POST it to /cop
 *
 * @param {Object} params
 * @param {Object} params.continuation
 * @param {Object} params.payload
 * @param {string} [params.from]
 * @param {string} [params.endpoint]
 * @param {string} [params.baseUrl]
 */
export async function resumeContinuationAndSend(params) {
  const { continuation, payload, from = null, endpoint, baseUrl } = params || {};

  if (!continuation) {
    throw new Error("resumeContinuationAndSend: 'continuation' is required");
  }

  const message = buildContinuationResumeMessage({
    continuation,
    payload,
    from,
  });

  const res = await postCopMessage({ message, endpoint, baseUrl });

  return {
    ok: res.ok,
    message,
    response: res.response,
    error: res.error,
  };
}
