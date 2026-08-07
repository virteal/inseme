/**
 * Replay persisted GitHub deliveries through an updated mapper (Inseme #29).
 */

import { mapDeliveryToCopEvents } from "./github-ingress.js";
import { createCopEventEnvelope } from "./cop-event-envelope.js";

/**
 * @param {object} delivery - row from github_webhook_deliveries (+ optional payload)
 * @param {object} payload - original or reconstructed payload
 * @param {object} store - append-only store
 * @param {object} [options] - map options
 */
export function replayDeliveryIntoStore(delivery, payload, store, options = {}) {
  const events = mapDeliveryToCopEvents(delivery, payload || {}, options);
  const results = [];
  for (const partial of events) {
    // New idempotency key variant for remaps if requested
    if (options.remapSuffix) {
      partial.idempotency_key = `${partial.idempotency_key}:remap:${options.remapSuffix}`;
    }
    const envelope = createCopEventEnvelope(partial);
    const appended = store.append(envelope);
    results.push(appended);
  }
  return {
    ok: results.every((r) => r.ok),
    results,
    event_count: results.filter((r) => r.ok && !r.duplicate).length,
    duplicates: results.filter((r) => r.duplicate).length,
  };
}

/**
 * Batch replay.
 * @param {Array<{ delivery: object, payload: object }>} batch
 */
export function replayDeliveryBatch(batch, store, options = {}) {
  let event_count = 0;
  let duplicates = 0;
  let failed = 0;
  for (const row of batch) {
    const r = replayDeliveryIntoStore(row.delivery, row.payload, store, options);
    event_count += r.event_count;
    duplicates += r.duplicates;
    if (!r.ok) failed += 1;
  }
  return { ok: failed === 0, event_count, duplicates, failed };
}
