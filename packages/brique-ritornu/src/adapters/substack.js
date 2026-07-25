import { RitornuError } from "../errors.js";
import { canonicalizeUrl } from "../urls.js";

/** Legitimate recovery paths when a public URL cannot be fetched. */
export const SUBSTACK_FALLBACKS = Object.freeze([
  "official-export",
  "provided-copy",
  "assisted-browser",
]);

/**
 * Accept only a single public Substack post URL (one publication).
 * Rejects profiles, feeds-as-crawl, non-https, and non-Substack hosts.
 *
 * @param {string} url
 * @returns {{ requested_url: string, canonical_url: string, publication_slug: string }}
 */
export function assertSubstackPublicPostUrl(url) {
  if (!url || typeof url !== "string" || !url.trim()) {
    throw new RitornuError("invalid-url", "A single Substack public post URL is required.");
  }
  if (/\s/.test(url.trim()) || url.includes(",")) {
    throw new RitornuError("multiple-urls", "Only one Substack URL per invocation is allowed.");
  }

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new RitornuError("invalid-url", "URL is not parseable.", { url });
  }

  if (parsed.protocol !== "https:") {
    throw new RitornuError("https-required", "Substack capture requires an https URL.", {
      url,
    });
  }

  const host = parsed.hostname.toLowerCase();
  const isSubstackHost =
    host === "substack.com" || host.endsWith(".substack.com") || host === "open.substack.com";

  if (!isSubstackHost) {
    throw new RitornuError("not-substack", "URL host is not a Substack publication host.", {
      host,
    });
  }

  // Publication posts: /p/{slug} (optionally under open.substack.com/pub/{pub}/p/{slug})
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  const postMatch =
    path.match(/\/p\/([a-z0-9][a-z0-9-]*)/i) ||
    path.match(/^\/pub\/[^/]+\/p\/([a-z0-9][a-z0-9-]*)/i);

  if (!postMatch) {
    throw new RitornuError(
      "not-a-post-url",
      "URL must target a single public post (/p/slug), not a profile, feed, or home page.",
      { path }
    );
  }

  const canonical = canonicalizeUrl(parsed.toString());
  if (!canonical) {
    throw new RitornuError("canonical-failed", "Could not canonicalize the Substack URL.");
  }

  return {
    requested_url: url.trim(),
    canonical_url: canonical,
    publication_slug: postMatch[1],
  };
}

/**
 * Fetch exactly one public Substack HTML page. No cookies, no auth, no link following.
 * Inject fetchImpl for tests.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<object>}
 */
export async function fetchSubstackPublicPost(url, options = {}) {
  const { fetchImpl = globalThis.fetch, timeoutMs = 20000 } = options;

  let identity;
  try {
    identity = assertSubstackPublicPostUrl(url);
  } catch (err) {
    if (err instanceof RitornuError) {
      return unavailable(err.code, err.message, {
        requested_url: typeof url === "string" ? url : null,
      });
    }
    throw err;
  }

  if (typeof fetchImpl !== "function") {
    return unavailable(
      "fetch-unavailable",
      "No fetch implementation is available in this runtime.",
      identity
    );
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer =
    controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response;
  try {
    response = await fetchImpl(identity.canonical_url, {
      method: "GET",
      redirect: "follow",
      signal: controller?.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        // Explicitly no Cookie / Authorization — personal retrofit under mandate only.
        "User-Agent":
          "Ritornu/0.1 (+https://github.com/JeanHuguesRobert/inseme; personal-retrofit)",
      },
    });
  } catch (err) {
    const aborted = err?.name === "AbortError";
    return unavailable(
      aborted ? "timeout" : "network-error",
      aborted
        ? `Substack request timed out after ${timeoutMs}ms.`
        : err?.message || "Network error while fetching Substack URL.",
      identity
    );
  } finally {
    if (timer) clearTimeout(timer);
  }

  const finalUrl = response.url || identity.canonical_url;
  if (!isAllowedSubstackFinalUrl(finalUrl)) {
    return unavailable(
      "redirect-out-of-scope",
      "Final URL after redirect left the allowed Substack public post scope.",
      { ...identity, final_url: finalUrl }
    );
  }

  if (response.status === 401 || response.status === 403) {
    return unavailable(
      `http-${response.status}`,
      "Substack refused the unauthenticated public request (login wall or restriction).",
      { ...identity, final_url: finalUrl, http_status: response.status }
    );
  }
  if (response.status === 404) {
    return unavailable("http-404", "Substack post not found at this public URL.", {
      ...identity,
      final_url: finalUrl,
      http_status: 404,
    });
  }
  if (response.status === 429) {
    return unavailable(
      "http-429",
      "Substack rate-limited the request. No retry escalation is performed by Ritornu.",
      { ...identity, final_url: finalUrl, http_status: 429 }
    );
  }
  if (!response.ok) {
    return unavailable(`http-${response.status}`, `Substack returned HTTP ${response.status}.`, {
      ...identity,
      final_url: finalUrl,
      http_status: response.status,
    });
  }

  const contentType = (response.headers?.get?.("content-type") || "").toLowerCase();
  if (contentType && !contentType.includes("html") && !contentType.includes("text/plain")) {
    return unavailable(
      "unexpected-content-type",
      `Expected HTML from Substack, got ${contentType}.`,
      { ...identity, final_url: finalUrl, content_type: contentType }
    );
  }

  let rawHtml;
  try {
    rawHtml = await response.text();
  } catch (err) {
    return unavailable(
      "body-read-error",
      err?.message || "Failed to read Substack response body.",
      { ...identity, final_url: finalUrl }
    );
  }

  if (!rawHtml || !rawHtml.trim()) {
    return unavailable("empty-body", "Substack returned an empty body.", {
      ...identity,
      final_url: finalUrl,
    });
  }

  // Soft paywall / login wall detection — explicit, no bypass.
  if (looksLikeSubstackLoginWall(rawHtml) && !looksLikeEditorialBody(rawHtml)) {
    return unavailable(
      "paywall-or-login",
      "Page appears gated (login/paywall). Use official export, provided copy, or assisted browser.",
      { ...identity, final_url: finalUrl, http_status: response.status }
    );
  }

  return {
    ok: true,
    status: "captured",
    platform: "substack",
    method: "public-url",
    requested_url: identity.requested_url,
    canonical_url: identity.canonical_url,
    final_url: finalUrl,
    publication_slug: identity.publication_slug,
    content_type: contentType || "text/html",
    raw_html: rawHtml,
    errors: [],
    fallbacks: [],
  };
}

/**
 * @param {string} finalUrl
 */
function isAllowedSubstackFinalUrl(finalUrl) {
  try {
    assertSubstackPublicPostUrl(finalUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} html
 */
function looksLikeSubstackLoginWall(html) {
  return (
    /sign in|log in|create your account|subscribe to read|this post is for paying subscribers/i.test(
      html
    ) && /substack/i.test(html)
  );
}

/**
 * @param {string} html
 */
function looksLikeEditorialBody(html) {
  return /<article[\s>]|og:title|article:published_time|class=["'][^"']*body/i.test(html);
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [extra]
 */
function unavailable(code, message, extra = {}) {
  return {
    ok: false,
    status: "unavailable",
    platform: "substack",
    method: "public-url",
    error: { code, message, recoverable: true },
    fallbacks: [...SUBSTACK_FALLBACKS],
    errors: [{ code, message, recoverable: true }],
    ...extra,
  };
}
