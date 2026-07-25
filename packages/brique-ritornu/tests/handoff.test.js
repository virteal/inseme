import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  RitornuError,
  assertValidPackage,
  buildLocalPackage,
  createHandoff,
  createReviewRequest,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "..", "fixtures", "substack-backup", "raw.html");
const FIXED_TS = "2026-07-24T12:00:00.000Z";

async function sampleCandidate() {
  const rawHtml = readFileSync(FIXTURE, "utf8");
  return (
    await buildLocalPackage({
      rawBytes: rawHtml,
      createdAt: FIXED_TS,
      captureOptions: {
        requestedUrl: "https://example.substack.com/p/backup",
        method: "provided-copy",
        platform: "substack",
        contentType: "text/html",
      },
    })
  ).candidate;
}

test("createReviewRequest promotes candidate without deciding routing", async () => {
  const candidate = await sampleCandidate();
  const reviewRequest = createReviewRequest(candidate, FIXED_TS);
  assert.equal(reviewRequest.state, "review-request");
  assert.equal(reviewRequest.routing.decided, false);
  assert.equal(reviewRequest.review_required, true);
  assertValidPackage("import_candidate", reviewRequest);
});

test("refuses handoff without a human review decision", async () => {
  const candidate = await sampleCandidate();
  assert.throws(
    () => createHandoff({ candidate, review: null }),
    (err) => err instanceof RitornuError && err.code === "review-missing"
  );
  assert.throws(
    () =>
      createHandoff({
        candidate,
        review: { status: "pending", reviewed_by: "human" },
      }),
    (err) => err instanceof RitornuError && err.code === "review-not-final"
  );
  assert.throws(
    () =>
      createHandoff({
        candidate,
        review: { status: "approved", reviewed_by: "" },
      }),
    (err) => err instanceof RitornuError && err.code === "reviewer-missing"
  );
});

test("refuses approved handoff without human routing decisions", async () => {
  const candidate = await sampleCandidate();
  assert.throws(
    () =>
      createHandoff({
        candidate,
        review: {
          status: "approved",
          reviewed_by: "Jean Hugues Robert",
          reviewed_at: FIXED_TS,
        },
        decisions: {},
        createdAt: FIXED_TS,
      }),
    (err) => err instanceof RitornuError && err.code === "routing-incomplete"
  );
});

test("refuses any handoff that enables Git write flags", async () => {
  const candidate = await sampleCandidate();
  assert.throws(
    () =>
      createHandoff({
        candidate,
        review: {
          status: "approved",
          reviewed_by: "Jean Hugues Robert",
          reviewed_at: FIXED_TS,
        },
        decisions: {
          destination_repo: "JeanHuguesRobert/barons-Mariani",
          destination_path: "research/backup_blogpost.md",
          git_write: true,
        },
        createdAt: FIXED_TS,
      }),
    (err) => err instanceof RitornuError && err.code === "git-write-forbidden"
  );
});

test("approved handoff yields a file proposal patch, never a commit", async () => {
  const candidate = await sampleCandidate();
  const handoff = createHandoff({
    candidate,
    review: {
      status: "approved",
      reviewed_by: "Jean Hugues Robert",
      reviewed_at: FIXED_TS,
      notes: "Route to barons-Mariani research after manual check.",
    },
    decisions: {
      operation: "propose-create",
      destination_repo: "JeanHuguesRobert/barons-Mariani",
      destination_path: "research/backup_blogpost.md",
      visibility: "public",
      license: "CC BY-SA 4.0",
    },
    createdAt: FIXED_TS,
  });

  assertValidPackage("handoff", handoff);
  assert.equal(handoff.state, "handoff");
  assert.equal(handoff.git_write_forbidden, true);
  assert.equal(handoff.decisions.operation, "propose-create");
  assert.equal(handoff.patch.format, "file-proposal");
  assert.match(handoff.patch.content, /^---\n/);
  assert.match(handoff.patch.content, /personal publication is not owned/i);
  assert.ok(handoff.patch.content_fingerprint.startsWith("sha256:"));
});

test("rejected review produces a reject handoff with no patch body", async () => {
  const candidate = await sampleCandidate();
  const handoff = createHandoff({
    candidate,
    review: {
      status: "rejected",
      reviewed_by: "Jean Hugues Robert",
      reviewed_at: FIXED_TS,
      notes: "Not suitable for public corpus.",
    },
    createdAt: FIXED_TS,
  });
  assert.equal(handoff.decisions.operation, "reject");
  assert.equal(handoff.patch.format, "none");
  assert.equal(handoff.patch.content, null);
  assert.equal(handoff.git_write_forbidden, true);
});
