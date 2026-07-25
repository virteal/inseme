import { createImportCandidate } from "../pipeline.js";
import { createSourceCapture } from "../pipeline.js";
import { createNormalizedTranscription } from "../normalize.js";
import { assertValidPackage } from "../validate.js";
import { fetchSubstackPublicPost } from "./substack.js";

/**
 * M1 entry: prepare a reviewable candidate from one public Substack URL.
 * Network access is limited to that single GET. Captures persist only via the
 * injected platform store (Supabase), never Git.
 *
 * @param {object} options
 * @param {string} options.url
 * @param {import('../storage.js').MemoryStore | import('../storage.js').SupabaseStore | null} [options.store]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.createdAt]
 * @param {number} [options.timeoutMs]
 * @param {boolean} [options.asReviewRequest]
 */
export async function prepareSubstackPublicUrl({
  url,
  store = null,
  fetchImpl,
  createdAt,
  timeoutMs,
  asReviewRequest = true,
}) {
  const fetched = await fetchSubstackPublicPost(url, { fetchImpl, timeoutMs });
  if (!fetched.ok) {
    return {
      ok: false,
      status: "unavailable",
      platform: "substack",
      method: "public-url",
      error: fetched.error,
      errors: fetched.errors,
      fallbacks: fetched.fallbacks,
      requested_url: fetched.requested_url ?? url,
      canonical_url: fetched.canonical_url ?? null,
      final_url: fetched.final_url ?? null,
    };
  }

  const created = createdAt || new Date().toISOString();
  const capture = createSourceCapture({
    rawBytes: fetched.raw_html,
    requestedUrl: fetched.requested_url,
    method: "public-url",
    platform: "substack",
    contentType: fetched.content_type || "text/html",
    createdAt: created,
    metadata: {
      publication_slug: fetched.publication_slug,
      final_url: fetched.final_url,
      adapter: "substack-public-url-v1",
    },
  });

  // Align canonical_url with adapter (strips tracking; may refine host form).
  capture.canonical_url = fetched.canonical_url;

  const transcription = createNormalizedTranscription({
    capture,
    rawText: fetched.raw_html,
    createdAt: created,
  });
  assertValidPackage("normalized_transcription", transcription);

  let candidate = createImportCandidate({
    capture,
    transcription,
    createdAt: created,
    state: asReviewRequest ? "review-request" : "candidate",
  });

  let persistedCapture = capture;
  if (store) {
    persistedCapture = await store.saveCapture(capture, fetched.raw_html, "raw.html");
    await store.saveTranscription(transcription);
    await store.saveCandidate(candidate);
  }

  return {
    ok: true,
    status: "prepared",
    platform: "substack",
    method: "public-url",
    capture: persistedCapture,
    transcription,
    candidate,
    review_required: true,
    git_write_forbidden: true,
  };
}
