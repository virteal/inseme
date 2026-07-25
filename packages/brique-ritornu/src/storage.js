import { RitornuError } from "./errors.js";

/** Default Supabase private bucket for capture proofs and package manifests. */
export const DEFAULT_STORAGE_BUCKET = "ritornu-private";

/** Platform storage class: private object storage, never Git, never public CDN by default. */
export const STORAGE_CLASS_PLATFORM = "platform-private";
export const STORAGE_CLASS_MEMORY = "memory";

/**
 * Normalize object keys used inside a bucket (posix-style, no escape).
 * @param {string} relativePath
 */
export function normalizeObjectKey(relativePath) {
  if (
    !relativePath ||
    typeof relativePath !== "string" ||
    relativePath.includes("..") ||
    relativePath.startsWith("/") ||
    /^[A-Za-z]:/.test(relativePath)
  ) {
    throw new RitornuError(
      "unsafe-object-key",
      "Object keys must be relative bucket paths without traversal.",
      { relativePath }
    );
  }
  return relativePath.replace(/\\/g, "/");
}

/**
 * Shared save helpers for any Ritornu store backend.
 */
class StoreBase {
  /**
   * @param {object} options
   * @param {string} options.backend
   * @param {string} options.bucket
   * @param {string} options.storageClass
   */
  constructor({ backend, bucket, storageClass }) {
    this.backend = backend;
    this.bucket = bucket || DEFAULT_STORAGE_BUCKET;
    this.storageClass = storageClass;
  }

  /**
   * @param {string} relativePath
   * @param {string | Uint8Array | Buffer} content
   * @param {{ contentType?: string }} [options]
   * @returns {Promise<{ bucket: string, path: string, storage_class: string }>}
   */
  async writeObject(_relativePath, _content, _options = {}) {
    throw new Error("writeObject not implemented");
  }

  /**
   * @param {string} relativePath
   * @param {BufferEncoding | 'utf8' | 'binary'} [encoding]
   */
  async readObject(_relativePath, _encoding = "utf8") {
    throw new Error("readObject not implemented");
  }

  /**
   * @param {object} capture
   * @param {string | Buffer | Uint8Array} rawBytes
   * @param {string} [filename]
   */
  async saveCapture(capture, rawBytes, filename = "raw.bin") {
    const id = capture.capture_id;
    const relativeRaw = normalizeObjectKey(`captures/${id}/${filename}`);
    await this.writeObject(relativeRaw, rawBytes, {
      contentType: capture.content_type || "application/octet-stream",
    });
    const withProof = {
      ...capture,
      proof: {
        ...(capture.proof || {}),
        relative_path: relativeRaw,
        bucket: this.bucket,
        backend: this.backend,
        storage_class: this.storageClass,
        visibility: "private",
        captured_at: capture.proof?.captured_at || capture.created_at,
      },
    };
    const relativeManifest = normalizeObjectKey(`captures/${id}/source_capture.json`);
    await this.writeObject(relativeManifest, `${JSON.stringify(withProof, null, 2)}\n`, {
      contentType: "application/json",
    });
    return withProof;
  }

  /**
   * @param {object} transcription
   */
  async saveTranscription(transcription) {
    const id = transcription.transcription_id;
    const bodyPath = normalizeObjectKey(`transcriptions/${id}/body.md`);
    const manifestPath = normalizeObjectKey(`transcriptions/${id}/normalized_transcription.json`);
    await this.writeObject(bodyPath, transcription.body_markdown, {
      contentType: "text/markdown; charset=utf-8",
    });
    await this.writeObject(manifestPath, `${JSON.stringify(transcription, null, 2)}\n`, {
      contentType: "application/json",
    });
    return { bodyPath, manifestPath };
  }

  /**
   * @param {object} candidate
   */
  async saveCandidate(candidate) {
    const id = candidate.candidate_id;
    const bodyPath = normalizeObjectKey(`candidates/${id}/body.md`);
    const manifestPath = normalizeObjectKey(`candidates/${id}/import_candidate.json`);
    await this.writeObject(bodyPath, candidate.body_markdown, {
      contentType: "text/markdown; charset=utf-8",
    });
    await this.writeObject(manifestPath, `${JSON.stringify(candidate, null, 2)}\n`, {
      contentType: "application/json",
    });
    return { bodyPath, manifestPath };
  }

  /**
   * @param {object} handoff
   */
  async saveHandoff(handoff) {
    const id = handoff.handoff_id;
    const manifestPath = normalizeObjectKey(`handoffs/${id}/handoff.json`);
    await this.writeObject(manifestPath, `${JSON.stringify(handoff, null, 2)}\n`, {
      contentType: "application/json",
    });
    if (handoff.patch?.content && handoff.patch.format !== "none") {
      const ext = handoff.patch.format === "unified-diff" ? "patch" : "md";
      const patchPath = normalizeObjectKey(`handoffs/${id}/proposal.${ext}`);
      await this.writeObject(patchPath, handoff.patch.content, {
        contentType:
          handoff.patch.format === "unified-diff"
            ? "text/plain; charset=utf-8"
            : "text/markdown; charset=utf-8",
      });
    }
    return { manifestPath };
  }
}

/**
 * In-memory store for unit tests and offline dry-runs.
 * Not used as platform production storage.
 */
export class MemoryStore extends StoreBase {
  /**
   * @param {{ bucket?: string }} [options]
   */
  constructor(options = {}) {
    super({
      backend: "memory",
      bucket: options.bucket || DEFAULT_STORAGE_BUCKET,
      storageClass: STORAGE_CLASS_MEMORY,
    });
    /** @type {Map<string, { body: string | Uint8Array, contentType?: string }>} */
    this.objects = new Map();
  }

  async writeObject(relativePath, content, options = {}) {
    const path = normalizeObjectKey(relativePath);
    const body =
      typeof content === "string" || content instanceof Uint8Array ? content : Buffer.from(content);
    this.objects.set(path, { body, contentType: options.contentType });
    return {
      bucket: this.bucket,
      path,
      storage_class: this.storageClass,
    };
  }

  async readObject(relativePath, encoding = "utf8") {
    const path = normalizeObjectKey(relativePath);
    const entry = this.objects.get(path);
    if (!entry) {
      throw new RitornuError("storage-not-found", `Object not found: ${path}`);
    }
    if (encoding === "binary" || encoding === null) {
      return entry.body;
    }
    if (typeof entry.body === "string") return entry.body;
    return Buffer.from(entry.body).toString(encoding);
  }
}

/**
 * Platform store: private Supabase Storage bucket.
 * Injected with the Inseme runtime Supabase client (service role on edge/tools).
 * Never publishes captures to a public URL.
 */
export class SupabaseStore extends StoreBase {
  /**
   * @param {object} options
   * @param {object} options.supabase - supabase-js client
   * @param {string} [options.bucket]
   */
  constructor({ supabase, bucket = DEFAULT_STORAGE_BUCKET }) {
    super({
      backend: "supabase",
      bucket,
      storageClass: STORAGE_CLASS_PLATFORM,
    });
    if (!supabase?.storage?.from) {
      throw new RitornuError(
        "supabase-required",
        "SupabaseStore requires a Supabase client with storage support."
      );
    }
    this.supabase = supabase;
  }

  async writeObject(relativePath, content, options = {}) {
    const path = normalizeObjectKey(relativePath);
    const body =
      typeof content === "string"
        ? content
        : content instanceof Uint8Array
          ? content
          : Buffer.from(content);

    const { data, error } = await this.supabase.storage.from(this.bucket).upload(path, body, {
      contentType: options.contentType || "application/octet-stream",
      upsert: true,
      cacheControl: "private, max-age=0",
    });

    if (error) {
      throw new RitornuError("storage-write-failed", error.message, {
        bucket: this.bucket,
        path,
      });
    }

    return {
      bucket: this.bucket,
      path: data?.path || path,
      storage_class: this.storageClass,
    };
  }

  async readObject(relativePath, encoding = "utf8") {
    const path = normalizeObjectKey(relativePath);
    const { data, error } = await this.supabase.storage.from(this.bucket).download(path);
    if (error || !data) {
      throw new RitornuError("storage-not-found", error?.message || `Object not found: ${path}`, {
        bucket: this.bucket,
        path,
      });
    }
    if (encoding === "binary" || encoding === null) {
      const ab = await data.arrayBuffer();
      return new Uint8Array(ab);
    }
    return await data.text();
  }
}

/**
 * Build the appropriate store for an Inseme runtime.
 * Prefers Supabase; falls back to memory only when explicitly allowed (tests).
 *
 * @param {object} [runtime]
 * @param {{ bucket?: string, allowMemoryFallback?: boolean }} [options]
 */
export function createStoreFromRuntime(runtime = {}, options = {}) {
  const bucket =
    options.bucket || runtime?.config?.ritornu_storage_bucket || DEFAULT_STORAGE_BUCKET;

  if (runtime?.supabase) {
    return new SupabaseStore({ supabase: runtime.supabase, bucket });
  }
  if (options.allowMemoryFallback) {
    return new MemoryStore({ bucket });
  }
  throw new RitornuError(
    "platform-storage-unavailable",
    "Ritornu requires Supabase Storage on the Inseme platform (no workstation-local capture store)."
  );
}
