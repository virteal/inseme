import { createHash } from "node:crypto";

/**
 * @param {string | Buffer | Uint8Array} input
 * @returns {string} sha256:<hex>
 */
export function sha256Fingerprint(input) {
  const hash = createHash("sha256").update(input).digest("hex");
  return `sha256:${hash}`;
}

/**
 * Content-addressed short id used for deterministic capture/transcription ids.
 * @param {string} prefix
 * @param {...string} parts
 */
export function contentAddressedId(prefix, ...parts) {
  const digest = createHash("sha256").update(parts.join("\0")).digest("hex");
  return `${prefix}_${digest.slice(0, 16)}`;
}

/**
 * Stable JSON serialization for fingerprints of structured objects.
 * @param {unknown} value
 */
export function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const body = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",");
  return `{${body}}`;
}
