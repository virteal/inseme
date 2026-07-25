import { NORMALIZER } from "./constants.js";
import { buildNormalizationDiff } from "./diff.js";
import { contentAddressedId, sha256Fingerprint } from "./hash.js";
import { canonicalizeUrl } from "./urls.js";
import { SCHEMA_VERSIONS } from "./constants.js";

/**
 * Deterministic offline normalization of a provided HTML or text capture.
 * M0 has no network adapters; this only transforms local bytes.
 *
 * @param {object} options
 * @param {object} options.capture - source_capture package
 * @param {string} options.rawText - raw capture body (utf8)
 * @param {string} [options.createdAt] - ISO timestamp override for tests
 */
export function createNormalizedTranscription({ capture, rawText, createdAt }) {
  if (!capture?.capture_id) {
    throw new Error("createNormalizedTranscription requires capture.capture_id");
  }
  if (typeof rawText !== "string") {
    throw new Error("createNormalizedTranscription requires rawText string");
  }

  const platform = capture.platform || "unknown";
  const extracted =
    platform === "substack" || looksLikeHtml(rawText)
      ? extractFromHtml(rawText, capture)
      : extractFromPlainText(rawText, capture);

  const bodyMarkdown = extracted.body_markdown;
  const created = createdAt || new Date().toISOString();
  const contentFingerprint = sha256Fingerprint(bodyMarkdown);
  const transcriptionId = contentAddressedId(
    "tr",
    NORMALIZER.name,
    NORMALIZER.version,
    capture.capture_id,
    contentFingerprint
  );

  const diff = buildNormalizationDiff(rawText, bodyMarkdown, extracted.removed_noise_kinds);

  return {
    schema_version: SCHEMA_VERSIONS.normalized_transcription,
    transcription_id: transcriptionId,
    capture_id: capture.capture_id,
    created_at: created,
    normalizer: { ...NORMALIZER },
    title: extracted.title,
    author: extracted.author,
    published_at: extracted.published_at,
    canonical_url: extracted.canonical_url ?? capture.canonical_url ?? null,
    body_markdown: bodyMarkdown,
    content_fingerprint: contentFingerprint,
    diff_from_raw: diff,
    ambiguities: extracted.ambiguities,
    errors: extracted.errors,
  };
}

/**
 * @param {string} text
 */
function looksLikeHtml(text) {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

/**
 * @param {string} raw
 * @param {object} capture
 */
function extractFromHtml(raw, capture) {
  const removed = new Set();
  const ambiguities = [];
  const errors = [];

  let working = raw;

  // Drop scripts/styles first.
  if (/<script[\s>]/i.test(working)) removed.add("script");
  if (/<style[\s>]/i.test(working)) removed.add("style");
  working = working.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  working = working.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  // Drop common non-editorial chrome.
  const chromePatterns = [
    [/subscribe|s'abonner|rejoignez|join the conversation/i, "subscribe-cta"],
    [/recommended|lectures recommandées|you might also like/i, "recommendations"],
    [/comment(s|aires)?|discussion/i, "discussion-chrome"],
    [/cookie|consentement|privacy policy/i, "legal-chrome"],
  ];

  const title =
    firstMatch(working, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    firstMatch(working, /<title[^>]*>([^<]+)<\/title>/i) ||
    firstMatch(working, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    null;

  const author =
    firstMatch(working, /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) ||
    firstMatch(working, /class=["'][^"']*author[^"']*["'][^>]*>([^<]+)/i) ||
    null;

  const publishedAt =
    firstMatch(working, /<time[^>]+datetime=["']([^"']+)["']/i) ||
    firstMatch(
      working,
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i
    ) ||
    null;

  const canonicalFromDoc =
    firstMatch(working, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    firstMatch(working, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ||
    null;

  const canonical_url =
    canonicalizeUrl(canonicalFromDoc) || capture.canonical_url || capture.requested_url || null;

  // Prefer article / main body; fall back to full document text.
  let bodyHtml =
    firstMatch(working, /<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
    firstMatch(working, /<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
    null;

  if (!bodyHtml) {
    ambiguities.push({
      code: "body-container-missing",
      message: "No <article> or <main> found; falling back to whole document text extraction.",
    });
    bodyHtml = working;
  }

  // Remove chrome blocks that look like CTAs inside the body.
  for (const [pattern, kind] of chromePatterns) {
    const before = bodyHtml;
    bodyHtml = bodyHtml.replace(
      new RegExp(
        `<(?:aside|div|section)[^>]*>[^<]*${pattern.source}[\\s\\S]*?<\\/(?:aside|div|section)>`,
        "gi"
      ),
      () => {
        removed.add(kind);
        return "";
      }
    );
    if (bodyHtml !== before && !removed.has(kind) && pattern.test(before)) {
      removed.add(kind);
    }
  }

  // Soft-detect remaining noise mentions for the report even if not removed as blocks.
  for (const [pattern, kind] of chromePatterns) {
    if (pattern.test(raw) && !pattern.test(htmlToMarkdown(bodyHtml))) {
      removed.add(kind);
    } else if (pattern.test(raw) && kind === "subscribe-cta") {
      // Count as noise if present in raw chrome outside body.
      if (/subscribe|s'abonner/i.test(raw)) removed.add(kind);
    }
  }

  if (/utm_|fbclid|gclid/i.test(raw)) {
    removed.add("tracking-params");
  }

  const body_markdown = htmlToMarkdown(bodyHtml).trim();

  if (!body_markdown) {
    errors.push({
      code: "empty-body",
      message: "Normalization produced an empty body.",
    });
  }
  if (!title) {
    ambiguities.push({
      code: "title-missing",
      message: "Could not extract a title from the HTML capture.",
    });
  }

  return {
    title: title ? stripTags(title).trim() : null,
    author: author ? stripTags(author).trim() : null,
    published_at: publishedAt ? publishedAt.trim() : null,
    canonical_url,
    body_markdown,
    removed_noise_kinds: [...removed],
    ambiguities,
    errors,
  };
}

/**
 * @param {string} raw
 * @param {object} capture
 */
function extractFromPlainText(raw, capture) {
  return {
    title: capture.metadata?.title_hint ?? null,
    author: capture.metadata?.author_hint ?? null,
    published_at: capture.metadata?.published_at_hint ?? null,
    canonical_url: capture.canonical_url ?? capture.requested_url ?? null,
    body_markdown: raw.replace(/\r\n/g, "\n").trim(),
    removed_noise_kinds: [],
    ambiguities: [],
    errors: [],
  };
}

/**
 * Minimal deterministic HTML → Markdown conversion for M0 fixtures.
 * @param {string} html
 */
function htmlToMarkdown(html) {
  let text = html;

  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/h1>/gi, "\n\n");
  text = text.replace(/<\/h2>/gi, "\n\n");
  text = text.replace(/<\/h3>/gi, "\n\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<h1[^>]*>/gi, "# ");
  text = text.replace(/<h2[^>]*>/gi, "## ");
  text = text.replace(/<h3[^>]*>/gi, "### ");
  text = text.replace(/<li[^>]*>/gi, "- ");
  text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    const cleanHref = canonicalizeUrl(href) || href;
    return `[${stripTags(label).trim()}](${cleanHref})`;
  });
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  text = stripTags(text);
  text = decodeBasicEntities(text);
  // Collapse excess blank lines.
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}

/**
 * @param {string} html
 */
function stripTags(html) {
  return html.replace(/<[^>]+>/g, "");
}

/**
 * @param {string} text
 */
function decodeBasicEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * @param {string} text
 * @param {RegExp} re
 */
function firstMatch(text, re) {
  const m = text.match(re);
  return m ? m[1] : null;
}
