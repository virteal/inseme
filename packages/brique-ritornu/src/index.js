/**
 * @inseme/brique-ritornu — M0 + M1 API.
 *
 * M0: schemas, normalization, private platform storage contracts, handoff.
 * M1: Substack public URL adapter (one URL, no auth bypass, explicit unavailability).
 *
 * Platform storage: Supabase private bucket via Netlify/edge runtime.
 * No workstation-local capture root. No Git writes.
 */

export {
  BRIQUE_ID,
  BRIQUE_STATUS,
  RETROFIT_STATES,
  NON_NEGOTIABLE_BOUNDARIES,
  SCHEMA_VERSIONS,
  CAPTURE_METHODS,
  PLATFORMS,
  NORMALIZER,
  TRACKING_QUERY_PARAMS,
  DEFAULT_LIMITS,
} from "./constants.js";

export { RitornuError } from "./errors.js";
export { sha256Fingerprint, contentAddressedId, stableStringify } from "./hash.js";
export { canonicalizeUrl } from "./urls.js";
export { buildNormalizationDiff } from "./diff.js";
export { createNormalizedTranscription } from "./normalize.js";
export { loadSchema, validatePackage, assertValidPackage } from "./validate.js";
export {
  DEFAULT_STORAGE_BUCKET,
  STORAGE_CLASS_PLATFORM,
  STORAGE_CLASS_MEMORY,
  normalizeObjectKey,
  MemoryStore,
  SupabaseStore,
  createStoreFromRuntime,
} from "./storage.js";
export {
  createSourceCapture,
  createImportCandidate,
  createReviewRequest,
  createHandoff,
  buildLocalPackage,
  proposeBlogpostFilename,
} from "./pipeline.js";
export {
  assertSubstackPublicPostUrl,
  fetchSubstackPublicPost,
  SUBSTACK_FALLBACKS,
} from "./adapters/substack.js";
export { prepareSubstackPublicUrl } from "./adapters/prepare.js";
export {
  SERVER_NAME as MCP_SERVER_NAME,
  SERVER_VERSION as MCP_SERVER_VERSION,
  PROTOCOL_VERSION as MCP_PROTOCOL_VERSION,
  TOOLS as MCP_TOOLS,
  createMcpCore,
  createStoreFromEnv,
  mcpToolResult,
  jsonRpcResult,
  jsonRpcError,
} from "./mcp/core.js";
export { HUB_SERVER_NAME, HUB_SERVER_VERSION, createHubMcp } from "./mcp/hub.js";
export { COGENTIA_TOOLS, createCogentiaProxy } from "./mcp/cogentia-proxy.js";
