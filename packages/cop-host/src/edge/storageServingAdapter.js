/**
 * packages/cop-host/src/edge/storageServingAdapter.js
 * Edge serving adapter for dynamic Supabase-Storage-backed artifact and HTML rendering (Issue #53).
 *
 * Implements:
 * - Dynamic serving from Storage bucket with HTTP Cache-Control and ETag validation.
 * - In-memory Edge caching to amortize Storage API requests.
 * - Instant cache invalidation upon Agent updates.
 * - Hybrid fallback to prebuilt static fallback when storage asset is missing.
 * - Strict security boundary (public vs restricted twin artifacts).
 */

import crypto from "node:crypto";

export class DynamicStorageServingAdapter {
  /**
   * @param {object} options
   * @param {string} [options.bucketName='hosted-twin-artifacts']
   * @param {number} [options.edgeCacheTtlSeconds=300]
   * @param {object} [options.storageClient] - Supabase storage client or mock
   * @param {object} [options.staticFallbackMap] - Static asset map for fallback
   */
  constructor(options = {}) {
    this.bucketName = options.bucketName || "hosted-twin-artifacts";
    this.edgeCacheTtlSeconds = options.edgeCacheTtlSeconds || 300;
    this.storageClient = options.storageClient || null;
    this.staticFallbackMap = options.staticFallbackMap || new Map();
    this.edgeCache = new Map(); // path -> { content, contentType, etag, expiresAt, visibility }
  }

  /**
   * Generates a deterministic ETag for given content.
   */
  generateEtag(content) {
    return `"${crypto.createHash("sha256").update(content).digest("hex").slice(0, 16)}"`;
  }

  /**
   * Invalidate edge cache for a specific path or prefix (called when Agent updates storage).
   */
  invalidateCache(pathOrPrefix) {
    if (!pathOrPrefix) {
      this.edgeCache.clear();
      return;
    }
    for (const key of this.edgeCache.keys()) {
      if (key === pathOrPrefix || key.startsWith(pathOrPrefix)) {
        this.edgeCache.delete(key);
      }
    }
  }

  /**
   * Handles incoming HTTP request for dynamic or static asset.
   *
   * @param {object} req
   * @param {string} req.path - Requested URI path (e.g. "/pertitellu-corte/index.html")
   * @param {string} [req.ifNoneMatch] - Incoming client ETag
   * @param {object} [req.authContext] - Optional caller auth (for restricted twin artifacts)
   * @returns {Promise<object>} HTTP response { status, headers, body }
   */
  async handleRequest(req) {
    const { path, ifNoneMatch, authContext } = req;
    const cleanPath = (path || "/").replace(/^\/+/, "");

    // 1. Check in-memory Edge Cache
    const cached = this.edgeCache.get(cleanPath);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      // Check auth if visibility is restricted
      if (cached.visibility === "restricted" && !authContext?.authenticated) {
        return {
          status: 403,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Access denied to restricted twin surface" }),
        };
      }

      // Check conditional 304 Not Modified
      if (ifNoneMatch && ifNoneMatch === cached.etag) {
        return {
          status: 304,
          headers: {
            ETag: cached.etag,
            "Cache-Control": `public, max-age=${this.edgeCacheTtlSeconds}, stale-while-revalidate=60`,
          },
          body: null,
        };
      }

      return {
        status: 200,
        headers: {
          "Content-Type": cached.contentType,
          ETag: cached.etag,
          "Cache-Control": `public, max-age=${this.edgeCacheTtlSeconds}, stale-while-revalidate=60`,
          "X-Served-By": "cop-edge-storage-cache",
        },
        body: cached.content,
      };
    }

    // 2. Fetch from Supabase Storage
    let storageItem = null;
    if (this.storageClient) {
      try {
        storageItem = await this.storageClient.download(this.bucketName, cleanPath);
      } catch (_err) {
        storageItem = null;
      }
    }

    if (storageItem && storageItem.content) {
      const content = storageItem.content;
      const contentType = storageItem.contentType || "text/html; charset=utf-8";
      const visibility = storageItem.visibility || "public";
      const etag = this.generateEtag(content);

      // Check auth for restricted artifacts
      if (visibility === "restricted" && !authContext?.authenticated) {
        return {
          status: 403,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Access denied to restricted twin surface" }),
        };
      }

      // Save to Edge Cache
      this.edgeCache.set(cleanPath, {
        content,
        contentType,
        etag,
        visibility,
        expiresAt: now + this.edgeCacheTtlSeconds * 1000,
      });

      if (ifNoneMatch && ifNoneMatch === etag) {
        return {
          status: 304,
          headers: { ETag: etag, "Cache-Control": `public, max-age=${this.edgeCacheTtlSeconds}` },
          body: null,
        };
      }

      return {
        status: 200,
        headers: {
          "Content-Type": contentType,
          ETag: etag,
          "Cache-Control": `public, max-age=${this.edgeCacheTtlSeconds}`,
          "X-Served-By": "cop-supabase-storage-origin",
        },
        body: content,
      };
    }

    // 3. Fallback to Prebuilt Static Assets if configured
    if (this.staticFallbackMap.has(cleanPath)) {
      const staticContent = this.staticFallbackMap.get(cleanPath);
      const etag = this.generateEtag(staticContent);

      return {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ETag: etag,
          "Cache-Control": "public, max-age=3600, immutable",
          "X-Served-By": "cop-static-prebuilt-fallback",
        },
        body: staticContent,
      };
    }

    // 4. Not Found
    return {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `<html><body><h1>404 Not Found</h1><p>Resource ${cleanPath} does not exist in Storage or Static bundle.</p></body></html>`,
    };
  }
}
