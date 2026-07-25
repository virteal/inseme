import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertValidPackage,
  buildLocalPackage,
  canonicalizeUrl,
  createNormalizedTranscription,
  createSourceCapture,
  proposeBlogpostFilename,
  sha256Fingerprint,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "..", "fixtures", "substack-backup", "raw.html");
const FIXED_TS = "2026-07-24T12:00:00.000Z";

test("canonical URL strips tracking parameters", () => {
  const raw =
    "https://example.substack.com/p/backup?utm_source=share&utm_medium=web&fbclid=x&keep=1";
  assert.equal(canonicalizeUrl(raw), "https://example.substack.com/p/backup?keep=1");
});

test("Substack fixture normalizes title, author, date, body and noise", async () => {
  const rawHtml = readFileSync(FIXTURE, "utf8");
  const { capture, transcription, candidate } = await buildLocalPackage({
    rawBytes: rawHtml,
    createdAt: FIXED_TS,
    captureOptions: {
      requestedUrl: "https://example.substack.com/p/backup?utm_source=share&fbclid=test123",
      method: "provided-copy",
      platform: "substack",
      contentType: "text/html",
    },
  });

  assertValidPackage("source_capture", capture);
  assertValidPackage("normalized_transcription", transcription);
  assertValidPackage("import_candidate", candidate);

  assert.equal(transcription.title, "Backup — keeping a copy of your own words");
  assert.equal(transcription.author, "Ada Example");
  assert.equal(transcription.published_at, "2024-03-15T10:00:00.000Z");
  assert.equal(transcription.canonical_url, "https://example.substack.com/p/backup");
  assert.match(transcription.body_markdown, /personal publication is not owned/i);
  assert.doesNotMatch(transcription.body_markdown, /Subscribe to receive/i);
  assert.doesNotMatch(transcription.body_markdown, /analytics-stub/);
  assert.ok(
    transcription.diff_from_raw.removed_noise_kinds.includes("tracking-params") ||
      transcription.diff_from_raw.removed_noise_kinds.includes("subscribe-cta") ||
      transcription.diff_from_raw.removed_noise_kinds.includes("script")
  );
  assert.ok(
    transcription.diff_from_raw.stats.raw_bytes > transcription.diff_from_raw.stats.normalized_bytes
  );
  assert.equal(candidate.proposed_filename, proposeBlogpostFilename(transcription.title));
  assert.match(candidate.proposed_filename, /_blogpost\.md$/);
  assert.equal(candidate.routing.decided, false);
  assert.equal(candidate.review_required, true);
  assert.equal(capture.proof.storage_class, "platform-private");
});

test("normalization is idempotent for the same raw input", () => {
  const rawHtml = readFileSync(FIXTURE, "utf8");
  const capture = createSourceCapture({
    rawBytes: rawHtml,
    method: "provided-copy",
    platform: "substack",
    contentType: "text/html",
    requestedUrl: "https://example.substack.com/p/backup",
    createdAt: FIXED_TS,
  });

  const a = createNormalizedTranscription({
    capture,
    rawText: rawHtml,
    createdAt: FIXED_TS,
  });
  const b = createNormalizedTranscription({
    capture,
    rawText: rawHtml,
    createdAt: FIXED_TS,
  });

  assert.equal(a.transcription_id, b.transcription_id);
  assert.equal(a.content_fingerprint, b.content_fingerprint);
  assert.equal(a.body_markdown, b.body_markdown);
  assert.equal(a.diff_from_raw.raw_fingerprint, sha256Fingerprint(rawHtml));
  assert.equal(a.diff_from_raw.normalized_fingerprint, a.content_fingerprint);
  assert.deepEqual(a.diff_from_raw.line_ops, b.diff_from_raw.line_ops);
});

test("source capture fingerprint matches raw bytes", () => {
  const raw = "hello-ritornu";
  const capture = createSourceCapture({
    rawBytes: raw,
    method: "provided-copy",
    platform: "other",
    createdAt: FIXED_TS,
  });
  assert.equal(capture.content_fingerprint, sha256Fingerprint(raw));
  assert.equal(capture.byte_length, Buffer.byteLength(raw));
  assert.equal(capture.state, "capture");
  assert.equal(capture.review_required, true);
});
