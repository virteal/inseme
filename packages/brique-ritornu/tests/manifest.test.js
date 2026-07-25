import assert from "node:assert/strict";
import test from "node:test";

import config from "../brique.config.js";
import {
  BRIQUE_ID,
  BRIQUE_STATUS,
  NON_NEGOTIABLE_BOUNDARIES,
  RETROFIT_STATES,
  SCHEMA_VERSIONS,
} from "../src/index.js";

test("Ritornu declares an experimental boundary with Substack tool only", () => {
  assert.equal(config.id, BRIQUE_ID);
  assert.equal(config.status, BRIQUE_STATUS);
  assert.equal(config.status, "experimental");
  assert.deepEqual(config.routes, []);
  assert.deepEqual(config.menuItems, []);
  assert.deepEqual(config.functions, {});
  assert.deepEqual(config.edgeFunctions, {});
  assert.equal(config.tools.length, 1);
  assert.equal(config.tools[0].function.name, "prepare_substack_post");
  assert.equal(config.configSchema.ritornu_storage_bucket.default, "ritornu-private");
});

test("Ritornu preserves its review and capture boundaries", () => {
  assert.equal(config.configSchema.ritornu_default_review_required.default, true);
  assert.ok(NON_NEGOTIABLE_BOUNDARIES.includes("private-capture-storage"));
  assert.ok(NON_NEGOTIABLE_BOUNDARIES.includes("no-direct-git-write"));
  assert.ok(NON_NEGOTIABLE_BOUNDARIES.includes("human-review-before-corpus-handoff"));
  assert.ok(NON_NEGOTIABLE_BOUNDARIES.includes("platform-storage-only"));
  assert.deepEqual(RETROFIT_STATES, [
    "capture",
    "candidate",
    "review-request",
    "handoff",
    "watch-change",
  ]);
});

test("Ritornu publishes versioned local schema identifiers", () => {
  assert.equal(SCHEMA_VERSIONS.source_capture, "ritornu/source_capture/v1");
  assert.equal(SCHEMA_VERSIONS.normalized_transcription, "ritornu/normalized_transcription/v1");
  assert.equal(SCHEMA_VERSIONS.import_candidate, "ritornu/import_candidate/v1");
  assert.equal(SCHEMA_VERSIONS.handoff, "ritornu/handoff/v1");
});
