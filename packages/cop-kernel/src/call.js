// File: packages/cop-kernel/src/call.js

import { buildContinuationResumeMessage } from "./continuation.js";
import { postCopMessage } from "./transport.js";

/**
 * High-level helper:
 *  - build a continuation resume COP_MESSAGE
 *  - POST it to /cop
 *
 * @param {Object} params
 * @param {Object} params.continuation  - descriptor from metadata.continuation
 * @param {Object} params.payload       - result payload
 * @param {string} [params.from]        - responder COP_ADDR
 * @param {string} [params.endpoint]
 * @param {string} [params.baseUrl]
 */
export async function resumeContinuationAndSend(params) {
  const { continuation, payload, from = null, endpoint, baseUrl } = params || {};

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
