/**
 * Shared constants for the Ritornu M0/M1 pipeline.
 * Captures live in platform private storage (Supabase). No Git integration.
 */

export const BRIQUE_ID = "ritornu";
export const BRIQUE_STATUS = "experimental";

export const RETROFIT_STATES = Object.freeze([
  "capture",
  "candidate",
  "review-request",
  "handoff",
  "watch-change",
]);

export const NON_NEGOTIABLE_BOUNDARIES = Object.freeze([
  "private-capture-storage",
  "human-review-before-corpus-handoff",
  "no-direct-git-write",
  "no-recursive-collection",
  "no-authentication-or-bypass",
  "platform-storage-only",
]);

export const SCHEMA_VERSIONS = Object.freeze({
  source_capture: "ritornu/source_capture/v1",
  normalized_transcription: "ritornu/normalized_transcription/v1",
  import_candidate: "ritornu/import_candidate/v1",
  handoff: "ritornu/handoff/v1",
});

export const CAPTURE_METHODS = Object.freeze([
  "official-export",
  "public-rss",
  "public-url",
  "provided-copy",
  "assisted-browser",
]);

export const PLATFORMS = Object.freeze(["substack", "facebook", "other", "unknown"]);

export const NORMALIZER = Object.freeze({
  name: "ritornu-basic",
  version: "1",
});

/** Tracking / noise query parameters stripped when building a canonical URL. */
export const TRACKING_QUERY_PARAMS = Object.freeze([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
]);

export const DEFAULT_LIMITS = Object.freeze({
  single_publication: true,
  no_recursive_collection: true,
  no_social_graph: true,
  notes:
    "One chosen publication under explicit mandate. No crawl, pagination, comments, reactions, or third-party profiles.",
});
