import assert from "node:assert/strict";
import test from "node:test";

import config from "../brique.config.js";
import {
  BRIQUE_ID,
  BRIQUE_STATUS,
  NON_NEGOTIABLE_BOUNDARIES,
  RETROFIT_STATES,
} from "../src/index.js";

test("Ritornu declares a non-executable skeleton boundary", () => {
  assert.equal(config.id, BRIQUE_ID);
  assert.equal(config.status, BRIQUE_STATUS);
  assert.equal(config.status, "skeleton");
  assert.deepEqual(config.routes, []);
  assert.deepEqual(config.menuItems, []);
  assert.deepEqual(config.functions, {});
  assert.deepEqual(config.edgeFunctions, {});
  assert.deepEqual(config.tools, []);
});

test("Ritornu preserves its review and capture boundaries", () => {
  assert.equal(config.configSchema.ritornu_default_review_required.default, true);
  assert.ok(NON_NEGOTIABLE_BOUNDARIES.includes("private-capture-storage"));
  assert.ok(NON_NEGOTIABLE_BOUNDARIES.includes("no-direct-git-write"));
  assert.deepEqual(RETROFIT_STATES, [
    "capture",
    "candidate",
    "review-request",
    "handoff",
    "watch-change",
  ]);
});
