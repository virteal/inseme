/**
 * Immutable artifact store + visibility projection (Inseme #28).
 *
 * Artifacts hold heavy/raw bytes; events keep only hash + ref.
 * No secrets in refs or logs — refs are content-addressed paths.
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Visibility rank: higher can see lower-or-equal public tiers. */
const VISIBILITY_RANK = {
  open: 0,
  redacted: 1,
  restricted: 2,
  sealed: 3,
  opaque_but_escrowed: 4,
};

/**
 * Content-addressed hash of raw bytes or string.
 * @param {string|Buffer|Uint8Array} body
 * @returns {string} sha256:<hex>
 */
export function hashArtifactBody(body) {
  const buf = Buffer.isBuffer(body)
    ? body
    : body instanceof Uint8Array
      ? Buffer.from(body)
      : Buffer.from(String(body), "utf8");
  return `sha256:${createHash("sha256").update(buf).digest("hex")}`;
}

/**
 * In-memory artifact store (tests / short-lived workers).
 */
export function createMemoryArtifactStore() {
  /** @type {Map<string, { hash: string, body: Buffer, content_type: string, created_at: string }>} */
  const blobs = new Map();

  return {
    kind: "memory_artifacts",

    /**
     * @param {string|Buffer|Uint8Array} body
     * @param {{ content_type?: string, prefix?: string }} [opts]
     */
    put(body, opts = {}) {
      const buf = Buffer.isBuffer(body)
        ? body
        : body instanceof Uint8Array
          ? Buffer.from(body)
          : Buffer.from(String(body), "utf8");
      const hash = hashArtifactBody(buf);
      const ref = opts.prefix || `artifact:sha256:${hash.slice("sha256:".length)}`;
      if (!blobs.has(ref)) {
        blobs.set(ref, {
          hash,
          body: buf,
          content_type: opts.content_type || "application/octet-stream",
          created_at: new Date().toISOString(),
        });
      }
      return { ok: true, artifact_ref: ref, payload_hash: hash, bytes: buf.length };
    },

    get(ref) {
      const row = blobs.get(ref);
      if (!row) return null;
      return {
        artifact_ref: ref,
        payload_hash: row.hash,
        content_type: row.content_type,
        body: Buffer.from(row.body),
        created_at: row.created_at,
      };
    },

    has(ref) {
      return blobs.has(ref);
    },
  };
}

/**
 * Filesystem artifact store under a private directory (mode 0700).
 * @param {{ rootDir: string }} options
 */
export function createFsArtifactStore(options) {
  if (!options?.rootDir) throw new Error("rootDir required");
  const rootDir = path.resolve(options.rootDir);
  fs.mkdirSync(rootDir, { recursive: true, mode: 0o700 });

  function pathForHash(hash) {
    const hex = hash.replace(/^sha256:/, "");
    return path.join(rootDir, hex.slice(0, 2), `${hex}.bin`);
  }

  return {
    kind: "fs_artifacts",
    rootDir,

    put(body, opts = {}) {
      const buf = Buffer.isBuffer(body)
        ? body
        : body instanceof Uint8Array
          ? Buffer.from(body)
          : Buffer.from(String(body), "utf8");
      const hash = hashArtifactBody(buf);
      const filePath = pathForHash(hash);
      fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, buf, { mode: 0o600 });
      }
      const ref = `artifact:file:sha256:${hash.slice("sha256:".length)}`;
      // sidecar meta
      const metaPath = `${filePath}.meta.json`;
      if (!fs.existsSync(metaPath)) {
        fs.writeFileSync(
          metaPath,
          JSON.stringify({
            artifact_ref: ref,
            payload_hash: hash,
            content_type: opts.content_type || "application/octet-stream",
            created_at: new Date().toISOString(),
            bytes: buf.length,
          }),
          { mode: 0o600 }
        );
      }
      return { ok: true, artifact_ref: ref, payload_hash: hash, bytes: buf.length };
    },

    get(ref) {
      const m = String(ref).match(/^artifact:file:sha256:([a-f0-9]{64})$/);
      if (!m) return null;
      const filePath = pathForHash(`sha256:${m[1]}`);
      if (!fs.existsSync(filePath)) return null;
      const body = fs.readFileSync(filePath);
      let meta = {};
      try {
        meta = JSON.parse(fs.readFileSync(`${filePath}.meta.json`, "utf8"));
      } catch {
        /* ignore */
      }
      return {
        artifact_ref: ref,
        payload_hash: `sha256:${m[1]}`,
        content_type: meta.content_type || "application/octet-stream",
        body,
        created_at: meta.created_at || null,
      };
    },

    has(ref) {
      return this.get(ref) != null;
    },
  };
}

/**
 * Whether a viewer clearance can see an event at eventVisibility.
 * @param {string} eventVisibility
 * @param {string} viewerClearance  max visibility the viewer may read
 */
export function canViewVisibility(eventVisibility, viewerClearance) {
  const ev = VISIBILITY_RANK[eventVisibility];
  const vc = VISIBILITY_RANK[viewerClearance];
  if (ev == null || vc == null) return false;
  return ev <= vc;
}

/**
 * Project an event for a viewer: strip/redact payload when not allowed.
 * Causal existence (event_id, topic, origin_ref, hashes) is preserved.
 *
 * @param {object} event
 * @param {{ viewer_clearance?: string, include_payload?: boolean }} [opts]
 */
export function projectEventForViewer(event, opts = {}) {
  const clearance = opts.viewer_clearance || "open";
  const visibility = event.visibility || "restricted";
  const allowed = canViewVisibility(visibility, clearance);

  const base = {
    schema: event.schema,
    event_id: event.event_id,
    event_type: event.event_type,
    topic: event.topic,
    time: event.time,
    origin_ref: event.origin_ref,
    actor_ref: event.actor_ref,
    visibility,
    epistemic_status: event.epistemic_status,
    payload_hash: event.payload_hash,
    artifact_ref: event.artifact_ref,
    visibility_allowed: allowed,
  };

  if (!allowed) {
    return {
      ...base,
      payload: null,
      payload_redacted: true,
      meta: { projection: "redacted_visibility" },
    };
  }

  if (visibility === "redacted" || opts.include_payload === false) {
    return {
      ...base,
      payload: summarizePayload(event.payload),
      payload_redacted: true,
      meta: { projection: "summary_only" },
    };
  }

  return {
    ...base,
    payload: event.payload,
    payload_redacted: false,
    meta: event.meta || {},
  };
}

function summarizePayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  return {
    summary: payload.summary || null,
    github_event: payload.github_event || null,
    action: payload.action || null,
    repository: payload.repository || null,
  };
}

/**
 * Externalize raw body: always hash; store full body when over threshold or force.
 *
 * @param {string|Buffer} rawBody
 * @param {ReturnType<typeof createMemoryArtifactStore>} artifactStore
 * @param {{ threshold_bytes?: number, force?: boolean, content_type?: string }} [opts]
 */
export function externalizeRawBody(rawBody, artifactStore, opts = {}) {
  const threshold = opts.threshold_bytes ?? 8 * 1024;
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");
  const hash = hashArtifactBody(buf);
  if (!opts.force && buf.length < threshold) {
    return {
      ok: true,
      externalized: false,
      payload_hash: hash,
      artifact_ref: null,
      bytes: buf.length,
    };
  }
  const put = artifactStore.put(buf, {
    content_type: opts.content_type || "application/json",
  });
  return {
    ok: put.ok,
    externalized: true,
    payload_hash: put.payload_hash,
    artifact_ref: put.artifact_ref,
    bytes: put.bytes,
  };
}

export function newOpaqueRef() {
  return `artifact:opaque:${randomUUID()}`;
}
