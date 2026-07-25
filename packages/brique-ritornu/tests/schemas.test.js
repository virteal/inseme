import assert from "node:assert/strict";
import test from "node:test";

import { SCHEMA_VERSIONS, loadSchema, validatePackage } from "../src/index.js";

test("shipped JSON schemas declare expected $id and required fields", () => {
  const kinds = ["source_capture", "normalized_transcription", "import_candidate", "handoff"];
  for (const kind of kinds) {
    const schema = loadSchema(kind);
    assert.ok(schema.$id.includes("ritornu"));
    assert.ok(Array.isArray(schema.required));
    assert.ok(schema.required.includes("schema_version"));
    assert.equal(schema.properties.schema_version.const, SCHEMA_VERSIONS[kind]);
  }
});

test("validatePackage rejects an empty object for source_capture", () => {
  const result = validatePackage("source_capture", {});
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("missing required")));
});
