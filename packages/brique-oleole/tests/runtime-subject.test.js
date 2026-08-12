import test from "node:test";
import assert from "node:assert/strict";
import { runtimeSubject } from "../src/edge/runtime-subject.js";

test("runtime subject only accepts the trusted host context", () => {
  assert.equal(
    runtimeSubject({ access_context: { subject_ref: "subject:participant:server-issued" } }),
    "subject:participant:server-issued"
  );
  assert.equal(
    runtimeSubject({ user: { id: "01234567-89ab-cdef-0123-456789abcdef" } }),
    "subject:auth:01234567-89ab-cdef-0123-456789abcdef"
  );
  assert.equal(runtimeSubject({}), null);
});
