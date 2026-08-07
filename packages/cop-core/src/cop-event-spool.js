/**
 * Append-only COP event store + NDJSON spool (Inseme #28 residual).
 *
 * - Memory store: tests + in-process durability until flush
 * - NDJSON spool: degraded-mode local durability + replay into a store
 *
 * No Supabase dependency. UPDATE/DELETE are rejected (new events only).
 */

import fs from "node:fs";
import path from "node:path";
import { createCopEventEnvelope, validateCopEventEnvelope } from "./cop-event-envelope.js";

/**
 * @typedef {object} AppendResult
 * @property {boolean} ok
 * @property {boolean} [duplicate]
 * @property {object} [event]
 * @property {string} [error]
 * @property {string[]} [errors]
 */

/**
 * In-memory append-only event log with topic sequencing + idempotency.
 */
export function createMemoryCopEventStore(options = {}) {
  /** @type {Map<string, object>} */
  const byId = new Map();
  /** @type {Map<string, string>} */
  const byIdempotency = new Map();
  /** @type {Map<string, object[]>} */
  const byTopic = new Map();
  let exportSeq = 0;

  return {
    kind: "memory",

    /**
     * @param {object} partial
     * @returns {AppendResult}
     */
    append(partial) {
      const prepared = createCopEventEnvelope(partial);
      const validation = validateCopEventEnvelope(prepared, {
        requirePositiveSeq: false,
      });
      if (!validation.ok) {
        return { ok: false, error: "invalid_envelope", errors: validation.errors };
      }

      if (prepared.idempotency_key) {
        const existingId = byIdempotency.get(prepared.idempotency_key);
        if (existingId) {
          return {
            ok: true,
            duplicate: true,
            event: byId.get(existingId),
          };
        }
      }

      const topicId = prepared.topic.id;
      const topicEvents = byTopic.get(topicId) || [];
      const nextSeq = topicEvents.length + 1;
      if (prepared.topic.seq > 0 && prepared.topic.seq !== nextSeq) {
        return {
          ok: false,
          error: "topic_seq_conflict",
          errors: [`expected_seq_${nextSeq}`, `got_seq_${prepared.topic.seq}`],
        };
      }
      prepared.topic.seq = nextSeq;

      const finalValidation = validateCopEventEnvelope(prepared, {
        requirePositiveSeq: true,
      });
      if (!finalValidation.ok) {
        return {
          ok: false,
          error: "invalid_envelope",
          errors: finalValidation.errors,
        };
      }

      // deep freeze-ish copy
      const stored = structuredClone(prepared);
      byId.set(stored.event_id, stored);
      if (stored.idempotency_key) {
        byIdempotency.set(stored.idempotency_key, stored.event_id);
      }
      topicEvents.push(stored);
      byTopic.set(topicId, topicEvents);
      exportSeq += 1;
      return { ok: true, duplicate: false, event: stored };
    },

    get(eventId) {
      return byId.get(eventId) || null;
    },

    listTopic(topicId) {
      return [...(byTopic.get(topicId) || [])];
    },

    /**
     * Replay all events in topic order (stable: topic id sorted, then seq).
     * @param {{ after_event_id?: string }} [opts]
     */
    replay(opts = {}) {
      const topics = [...byTopic.keys()].sort();
      const all = [];
      for (const t of topics) {
        all.push(...byTopic.get(t));
      }
      if (!opts.after_event_id) return all;
      const idx = all.findIndex((e) => e.event_id === opts.after_event_id);
      if (idx < 0) return all;
      return all.slice(idx + 1);
    },

    exportAll() {
      return {
        schema: "cop.event-log.export.v1",
        exported_at: new Date().toISOString(),
        events: this.replay(),
      };
    },

    /**
     * Import events (append-only). Duplicates by idempotency/event_id are skipped.
     * @param {{ events: object[] }} bundle
     */
    importAll(bundle) {
      const events = bundle?.events || [];
      let appended = 0;
      let duplicates = 0;
      let failed = 0;
      for (const event of events) {
        if (byId.has(event.event_id)) {
          duplicates += 1;
          continue;
        }
        const result = this.append({
          ...event,
          topic: { id: event.topic?.id, seq: 0 },
        });
        if (result.ok && result.duplicate) duplicates += 1;
        else if (result.ok) appended += 1;
        else failed += 1;
      }
      return { ok: failed === 0, appended, duplicates, failed };
    },

    update() {
      throw new Error("COP Event Log is strictly append-only. UPDATE forbidden.");
    },

    delete() {
      throw new Error("COP Event Log is strictly append-only. DELETE forbidden.");
    },

    stats() {
      return {
        events: byId.size,
        topics: byTopic.size,
        export_seq: exportSeq,
      };
    },
  };
}

/**
 * NDJSON spool on disk for degraded mode. Each line is one envelope JSON.
 * @param {{ filePath: string }} options
 */
export function createNdjsonCopEventSpool(options) {
  if (!options?.filePath) {
    throw new Error("filePath required");
  }
  const filePath = path.resolve(options.filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "", { mode: 0o600 });
  }

  return {
    kind: "ndjson_spool",
    filePath,

    /**
     * Append one envelope (validated). Does not assign topic.seq (store does).
     * @param {object} partial
     */
    enqueue(partial) {
      const prepared = createCopEventEnvelope(partial);
      const validation = validateCopEventEnvelope(prepared, {
        requirePositiveSeq: false,
      });
      if (!validation.ok) {
        return { ok: false, error: "invalid_envelope", errors: validation.errors };
      }
      const line = `${JSON.stringify(prepared)}\n`;
      fs.appendFileSync(filePath, line, { encoding: "utf8" });
      return { ok: true, event: prepared };
    },

    /**
     * Read all spooled events (parse errors skipped with report).
     */
    readAll() {
      const text = fs.readFileSync(filePath, "utf8");
      const events = [];
      const errors = [];
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      lines.forEach((line, i) => {
        try {
          const obj = JSON.parse(line);
          const v = validateCopEventEnvelope(obj, { requirePositiveSeq: false });
          if (!v.ok) {
            errors.push({ line: i + 1, errors: v.errors });
            return;
          }
          events.push(obj);
        } catch (err) {
          errors.push({ line: i + 1, errors: ["json_parse_error"] });
        }
      });
      return { events, errors };
    },

    /**
     * Replay spool into a store (append). Clears nothing by default.
     * @param {ReturnType<typeof createMemoryCopEventStore>} store
     * @param {{ truncate?: boolean }} [opts]
     */
    replayInto(store, opts = {}) {
      const { events, errors } = this.readAll();
      let appended = 0;
      let duplicates = 0;
      let failed = 0;
      for (const event of events) {
        const result = store.append({
          ...event,
          topic: { id: event.topic.id, seq: 0 },
        });
        if (!result.ok) failed += 1;
        else if (result.duplicate) duplicates += 1;
        else appended += 1;
      }
      if (opts.truncate && failed === 0) {
        fs.writeFileSync(filePath, "", { mode: 0o600 });
      }
      return {
        ok: failed === 0 && errors.length === 0,
        appended,
        duplicates,
        failed,
        parse_errors: errors.length,
      };
    },
  };
}
