/**
 * COP / Ophélia tool: prepare one Substack public post as a reviewable candidate.
 *
 * Path (via brique compiler): /api/tools/ritornu/prepare_substack_post
 * Storage: private Supabase bucket (ritornu-private by default). Never Git.
 */
import { createStoreFromRuntime, prepareSubstackPublicUrl } from "../index.js";

export default async function handler(runtime, args = {}) {
  const url = args.url || args.requested_url;
  if (!url || typeof url !== "string") {
    return {
      success: false,
      error: {
        code: "url-required",
        message: "Provide a single public Substack post URL in args.url.",
      },
    };
  }

  if (!runtime?.supabase) {
    return {
      success: false,
      error: {
        code: "platform-storage-unavailable",
        message:
          "Supabase is required. Ritornu stores captures in a private platform bucket, not on the workstation.",
      },
    };
  }

  let store;
  try {
    store = createStoreFromRuntime(runtime, {
      bucket: args.bucket || runtime?.config?.ritornu_storage_bucket,
    });
  } catch (err) {
    return {
      success: false,
      error: {
        code: err.code || "store-init-failed",
        message: err.message,
      },
    };
  }

  const result = await prepareSubstackPublicUrl({
    url,
    store,
    fetchImpl: globalThis.fetch,
    asReviewRequest: args.as_review_request !== false,
  });

  if (!result.ok) {
    return {
      success: false,
      status: "unavailable",
      platform: "substack",
      requested_url: result.requested_url,
      canonical_url: result.canonical_url,
      error: result.error,
      fallbacks: result.fallbacks,
      message:
        "Substack publication unavailable for unauthenticated public fetch. Use official export, a provided copy, or assisted browser navigation. Ritornu does not bypass paywalls, CAPTCHAs, or authentication.",
      review_required: true,
      git_write_forbidden: true,
    };
  }

  return {
    success: true,
    status: "prepared",
    platform: "substack",
    method: "public-url",
    capture_id: result.capture.capture_id,
    candidate_id: result.candidate.candidate_id,
    transcription_id: result.transcription.transcription_id,
    state: result.candidate.state,
    proof: result.capture.proof,
    summary: {
      title: result.transcription.title,
      author: result.transcription.author,
      published_at: result.transcription.published_at,
      canonical_url: result.transcription.canonical_url,
      proposed_filename: result.candidate.proposed_filename,
      noise_removed: result.transcription.diff_from_raw?.removed_noise_kinds || [],
    },
    // Full candidate for human review UI; raw HTML stays only in the private bucket.
    candidate: result.candidate,
    review_required: true,
    git_write_forbidden: true,
    next_step:
      "Human review must decide destination repo, path, visibility, and license before any corpus handoff.",
  };
}
