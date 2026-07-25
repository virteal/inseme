import { TRACKING_QUERY_PARAMS } from "./constants.js";

/**
 * Strip known tracking parameters and return a canonical URL string.
 * Invalid or empty input yields null.
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function canonicalizeUrl(url) {
  if (url == null || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    for (const key of TRACKING_QUERY_PARAMS) {
      parsed.searchParams.delete(key);
    }
    // Drop empty search entirely.
    const search = parsed.searchParams.toString();
    parsed.search = search ? `?${search}` : "";
    // Prefer no trailing slash on bare paths except root.
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
