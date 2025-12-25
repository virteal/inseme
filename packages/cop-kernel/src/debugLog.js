// File: packages/cop-kernel/src/debugLog.js
// Description:
//   COP debug logs written via StorageInterface.debugLogs.

import { getStorage } from "./storage.js";

function nowIso() {
  return new Date().toISOString();
}

/**
 * Insert a debug log entry.
 *
 * @param {Object} params
 * @param {string} [params.correlation_id]
 * @param {string} [params.message_id]
 * @param {string} [params.event_id]
 * @param {string} [params.location]   - usually agent address
 * @param {string} [params.stage]      - e.g. "received", "processing", "sent", "error"
 * @param {string} [params.direction]  - "in", "out", "internal"
 * @param {any}    [params.payload]
 * @param {Object} [params.metadata]
 */
export async function logCopDebug(params) {
  const storage = getStorage();
  const {
    correlation_id = null,
    message_id = null,
    event_id = null,
    location = null,
    stage = null,
    direction = null,
    payload = null,
    metadata = {},
  } = params || {};

  const row = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + "-" + Math.random().toString(16).slice(2),
    correlation_id,
    message_id,
    event_id,
    location,
    stage,
    direction,
    payload,
    metadata,
    created_at: nowIso(),
  };

  return storage.debugLogs.insert(row);
}
