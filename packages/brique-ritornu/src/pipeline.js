import { CAPTURE_METHODS, DEFAULT_LIMITS, PLATFORMS, SCHEMA_VERSIONS } from "./constants.js";
import { RitornuError } from "./errors.js";
import { contentAddressedId, sha256Fingerprint, stableStringify } from "./hash.js";
import { createNormalizedTranscription } from "./normalize.js";
import { canonicalizeUrl } from "./urls.js";
import { assertValidPackage } from "./validate.js";

/**
 * Build a source_capture package from local bytes (provided copy, export, fixture…).
 * Does not perform any network access.
 *
 * @param {object} options
 * @param {string | Buffer} options.rawBytes
 * @param {string} [options.requestedUrl]
 * @param {string} [options.method]
 * @param {string} [options.platform]
 * @param {string} [options.contentType]
 * @param {object} [options.metadata]
 * @param {object} [options.limits]
 * @param {Array} [options.errors]
 * @param {string} [options.createdAt]
 */
export function createSourceCapture({
  rawBytes,
  requestedUrl = null,
  method = "provided-copy",
  platform = "unknown",
  contentType = "text/plain",
  metadata = {},
  limits = {},
  errors = [],
  createdAt,
}) {
  if (rawBytes == null) {
    throw new RitornuError("missing-raw-bytes", "source_capture requires rawBytes");
  }
  if (!CAPTURE_METHODS.includes(method)) {
    throw new RitornuError("invalid-method", `Unknown capture method: ${method}`);
  }
  if (!PLATFORMS.includes(platform)) {
    throw new RitornuError("invalid-platform", `Unknown platform: ${platform}`);
  }

  const buffer = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes, "utf8");
  const contentFingerprint = sha256Fingerprint(buffer);
  const created = createdAt || new Date().toISOString();
  const canonicalUrl = canonicalizeUrl(requestedUrl);
  const captureId = contentAddressedId(
    "cap",
    method,
    platform,
    contentFingerprint,
    canonicalUrl || ""
  );

  const capture = {
    schema_version: SCHEMA_VERSIONS.source_capture,
    capture_id: captureId,
    state: "capture",
    created_at: created,
    requested_url: requestedUrl,
    canonical_url: canonicalUrl,
    method,
    platform,
    content_type: contentType,
    content_fingerprint: contentFingerprint,
    byte_length: buffer.byteLength,
    limits: { ...DEFAULT_LIMITS, ...limits },
    errors: [...errors],
    proof: {
      relative_path: null,
      bucket: null,
      backend: null,
      storage_class: "platform-private",
      visibility: "private",
      captured_at: created,
    },
    metadata: { ...metadata },
    review_required: true,
  };

  return assertValidPackage("source_capture", capture);
}

/**
 * Build an import_candidate from a capture + normalized transcription.
 * Routing stays undecided; review is always required.
 *
 * @param {object} options
 * @param {object} options.capture
 * @param {object} options.transcription
 * @param {string} [options.createdAt]
 * @param {string} [options.state] - candidate | review-request
 */
export function createImportCandidate({ capture, transcription, createdAt, state = "candidate" }) {
  if (!capture || !transcription) {
    throw new RitornuError("missing-inputs", "import_candidate requires capture and transcription");
  }
  if (transcription.capture_id !== capture.capture_id) {
    throw new RitornuError(
      "capture-mismatch",
      "transcription.capture_id does not match capture.capture_id"
    );
  }
  if (state !== "candidate" && state !== "review-request") {
    throw new RitornuError("invalid-state", `Invalid candidate state: ${state}`);
  }

  const created = createdAt || new Date().toISOString();
  const proposedFilename = proposeBlogpostFilename(transcription.title);
  const proposedFrontmatter = {
    title: transcription.title,
    author: transcription.author,
    date: transcription.published_at,
    canonical_source_url: transcription.canonical_url || capture.canonical_url,
    provenance: {
      capture_id: capture.capture_id,
      transcription_id: transcription.transcription_id,
      method: capture.method,
      platform: capture.platform,
      capture_fingerprint: capture.content_fingerprint,
      transcription_fingerprint: transcription.content_fingerprint,
    },
    human_validation_required: true,
    document_role: "import_candidate",
  };

  const body = transcription.body_markdown;
  const candidateFingerprint = sha256Fingerprint(
    stableStringify({
      capture_id: capture.capture_id,
      transcription_id: transcription.transcription_id,
      body,
      proposed_filename: proposedFilename,
    })
  );
  const candidateId = contentAddressedId(
    "cand",
    capture.capture_id,
    transcription.transcription_id,
    candidateFingerprint
  );

  const candidate = {
    schema_version: SCHEMA_VERSIONS.import_candidate,
    candidate_id: candidateId,
    capture_id: capture.capture_id,
    transcription_id: transcription.transcription_id,
    state,
    created_at: created,
    review_required: true,
    proposed_filename: proposedFilename,
    proposed_frontmatter: proposedFrontmatter,
    body_markdown: body,
    provenance: {
      requested_url: capture.requested_url,
      canonical_url: capture.canonical_url,
      method: capture.method,
      platform: capture.platform,
      capture_fingerprint: capture.content_fingerprint,
      transcription_fingerprint: transcription.content_fingerprint,
    },
    fingerprints: {
      capture: capture.content_fingerprint,
      transcription: transcription.content_fingerprint,
      candidate: candidateFingerprint,
    },
    routing: {
      destination_repo: null,
      destination_path: null,
      visibility: null,
      license: null,
      decided: false,
    },
    ambiguities: [...(transcription.ambiguities || [])],
  };

  return assertValidPackage("import_candidate", candidate);
}

/**
 * Promote a candidate to review-request without deciding routing.
 * @param {object} candidate
 * @param {string} [createdAt]
 */
export function createReviewRequest(candidate, createdAt) {
  assertValidPackage("import_candidate", candidate);
  if (candidate.review_required !== true) {
    throw new RitornuError("review-flag-missing", "Candidates must keep review_required=true");
  }
  if (candidate.routing?.decided === true) {
    throw new RitornuError(
      "routing-already-decided",
      "review-request must not carry decided routing; handoff owns human decisions."
    );
  }
  return assertValidPackage("import_candidate", {
    ...candidate,
    state: "review-request",
    created_at: createdAt || new Date().toISOString(),
  });
}

/**
 * Build a handoff package after an explicit human review decision.
 * Never writes Git. Refuses missing or pending review.
 *
 * @param {object} options
 * @param {object} options.candidate
 * @param {object} options.review - { status, reviewed_by, reviewed_at?, notes? }
 * @param {object} [options.decisions]
 * @param {string} [options.createdAt]
 */
export function createHandoff({ candidate, review, decisions = {}, createdAt }) {
  if (!candidate) {
    throw new RitornuError("missing-candidate", "handoff requires a candidate");
  }
  if (candidate.review_required !== true) {
    throw new RitornuError(
      "review-required",
      "Refusing handoff: candidate.review_required must remain true."
    );
  }
  if (!review || typeof review !== "object") {
    throw new RitornuError(
      "review-missing",
      "Refusing handoff without an explicit human review object."
    );
  }
  if (review.status !== "approved" && review.status !== "rejected") {
    throw new RitornuError(
      "review-not-final",
      "Refusing handoff: review.status must be 'approved' or 'rejected'.",
      { status: review.status }
    );
  }
  if (!review.reviewed_by || typeof review.reviewed_by !== "string") {
    throw new RitornuError("reviewer-missing", "Refusing handoff: review.reviewed_by is required.");
  }

  const created = createdAt || new Date().toISOString();
  const reviewedAt = review.reviewed_at || created;

  let operation = decisions.operation;
  if (!operation) {
    operation = review.status === "rejected" ? "reject" : "propose-create";
  }

  if (review.status === "approved" && operation === "reject") {
    throw new RitornuError("decision-conflict", "Approved review cannot use operation 'reject'.");
  }
  if (review.status === "rejected") {
    operation = "reject";
  }

  if (
    review.status === "approved" &&
    (operation === "propose-create" || operation === "propose-update")
  ) {
    if (!decisions.destination_repo || !decisions.destination_path) {
      throw new RitornuError(
        "routing-incomplete",
        "Approved handoff requires destination_repo and destination_path decided by a human."
      );
    }
  }

  // Explicitly forbid any flag that would enable automatic Git writes.
  if (decisions.git_write === true || decisions.auto_commit === true) {
    throw new RitornuError(
      "git-write-forbidden",
      "Handoff must never enable Git writes. Produce a patch proposal only."
    );
  }

  const patch =
    review.status === "rejected"
      ? {
          format: "none",
          proposed_filename: candidate.proposed_filename,
          content: null,
          content_fingerprint: null,
        }
      : buildFileProposalPatch(candidate, decisions);

  const handoffId = contentAddressedId(
    "hand",
    candidate.candidate_id,
    review.status,
    review.reviewed_by,
    reviewedAt,
    operation
  );

  const handoff = {
    schema_version: SCHEMA_VERSIONS.handoff,
    handoff_id: handoffId,
    candidate_id: candidate.candidate_id,
    state: "handoff",
    created_at: created,
    review: {
      status: review.status,
      reviewed_by: review.reviewed_by,
      reviewed_at: reviewedAt,
      notes: review.notes || "",
    },
    decisions: {
      operation,
      destination_repo: decisions.destination_repo ?? null,
      destination_path: decisions.destination_path ?? null,
      visibility: decisions.visibility ?? null,
      license: decisions.license ?? null,
      document_type: decisions.document_type ?? "blogpost",
    },
    patch,
    git_write_forbidden: true,
    errors: [],
  };

  return assertValidPackage("handoff", handoff);
}

/**
 * Run the offline package pipeline: capture → transcription → candidate.
 * Optional persistence via platform store (Supabase) or MemoryStore for tests.
 *
 * @param {object} options
 * @param {string | Buffer} options.rawBytes
 * @param {object} [options.captureOptions]
 * @param {import("./storage.js").MemoryStore | import("./storage.js").SupabaseStore | null} [options.store]
 * @param {string} [options.createdAt]
 * @param {string} [options.rawFilename]
 */
export async function buildLocalPackage({
  rawBytes,
  captureOptions = {},
  store = null,
  createdAt,
  rawFilename,
}) {
  const created = createdAt || new Date().toISOString();
  const capture = createSourceCapture({
    rawBytes,
    createdAt: created,
    ...captureOptions,
  });

  const rawText = Buffer.isBuffer(rawBytes) ? rawBytes.toString("utf8") : String(rawBytes);
  const transcription = createNormalizedTranscription({
    capture,
    rawText,
    createdAt: created,
  });
  assertValidPackage("normalized_transcription", transcription);

  const candidate = createImportCandidate({
    capture,
    transcription,
    createdAt: created,
  });

  let persistedCapture = capture;
  if (store) {
    const ext = guessExtension(capture.content_type, rawFilename);
    persistedCapture = await store.saveCapture(capture, rawBytes, rawFilename || `raw.${ext}`);
    await store.saveTranscription(transcription);
    await store.saveCandidate(candidate);
  }

  return {
    capture: persistedCapture,
    transcription,
    candidate,
  };
}

/**
 * @param {object} candidate
 * @param {object} decisions
 */
function buildFileProposalPatch(candidate, decisions) {
  const fm = {
    ...candidate.proposed_frontmatter,
    target_repository: decisions.destination_repo,
    suggested_path: decisions.destination_path,
    visibility: decisions.visibility ?? null,
    license: decisions.license ?? null,
    human_validation_required: false,
    review_status: "handoff-approved",
  };
  const yaml = frontmatterToYaml(fm);
  const content = `---\n${yaml}---\n\n${candidate.body_markdown}\n`;
  return {
    format: "file-proposal",
    proposed_filename: candidate.proposed_filename,
    content,
    content_fingerprint: sha256Fingerprint(content),
  };
}

/**
 * @param {object} obj
 */
function frontmatterToYaml(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    lines.push(formatYamlLine(key, value, 0));
  }
  return lines.filter(Boolean).join("\n") + "\n";
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {number} indent
 */
function formatYamlLine(key, value, indent) {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) {
    return `${pad}${key}: null`;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return `${pad}${key}: ${value}`;
  }
  if (typeof value === "string") {
    return `${pad}${key}: ${JSON.stringify(value)}`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}${key}: []`;
    const items = value
      .map((item) => {
        if (item !== null && typeof item === "object") {
          return `${pad}- ${JSON.stringify(item)}`;
        }
        return `${pad}- ${JSON.stringify(item)}`;
      })
      .join("\n");
    return `${pad}${key}:\n${items}`;
  }
  if (typeof value === "object") {
    const nested = Object.entries(value)
      .map(([k, v]) => formatYamlLine(k, v, indent + 1))
      .join("\n");
    return `${pad}${key}:\n${nested}`;
  }
  return `${pad}${key}: ${JSON.stringify(String(value))}`;
}

/**
 * Filename without date, ends with _blogpost — issue #26 fixture convention.
 * @param {string | null} title
 */
export function proposeBlogpostFilename(title) {
  if (!title) return "untitled_blogpost.md";
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  const base = slug || "untitled";
  if (base.endsWith("_blogpost")) return `${base}.md`;
  return `${base}_blogpost.md`;
}

/**
 * @param {string} contentType
 * @param {string} [filename]
 */
function guessExtension(contentType, filename) {
  if (filename && filename.includes(".")) {
    return filename.split(".").pop();
  }
  if (contentType.includes("html")) return "html";
  if (contentType.includes("markdown")) return "md";
  if (contentType.includes("json")) return "json";
  if (contentType.includes("zip")) return "zip";
  return "txt";
}

// Re-export normalize entry for callers that only import pipeline.
export { createNormalizedTranscription };
