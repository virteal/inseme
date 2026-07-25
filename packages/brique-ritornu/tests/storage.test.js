import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_STORAGE_BUCKET,
  MemoryStore,
  RitornuError,
  SupabaseStore,
  buildLocalPackage,
  createStoreFromRuntime,
  normalizeObjectKey,
} from "../src/index.js";

test("normalizeObjectKey rejects path traversal", () => {
  assert.throws(
    () => normalizeObjectKey("../etc/passwd"),
    (err) => err instanceof RitornuError && err.code === "unsafe-object-key"
  );
  assert.equal(normalizeObjectKey("captures/a/raw.html"), "captures/a/raw.html");
});

test("MemoryStore persists capture, transcription and candidate as private objects", async () => {
  const store = new MemoryStore({ bucket: DEFAULT_STORAGE_BUCKET });
  const raw = "<article><h1>Note</h1><p>Body text.</p></article>";
  const { capture, transcription, candidate } = await buildLocalPackage({
    rawBytes: raw,
    createdAt: "2026-07-24T12:00:00.000Z",
    store,
    rawFilename: "raw.html",
    captureOptions: {
      method: "provided-copy",
      platform: "other",
      contentType: "text/html",
    },
  });

  assert.ok(capture.proof.relative_path);
  assert.match(capture.proof.relative_path, /^captures\//);
  assert.equal(capture.proof.bucket, DEFAULT_STORAGE_BUCKET);
  assert.equal(capture.proof.backend, "memory");
  assert.equal(capture.proof.visibility, "private");
  assert.equal(capture.proof.storage_class, "memory");

  const reloaded = await store.readObject(capture.proof.relative_path);
  assert.equal(reloaded, raw);
  const manifest = JSON.parse(
    await store.readObject(`captures/${capture.capture_id}/source_capture.json`)
  );
  assert.equal(manifest.capture_id, capture.capture_id);
  const body = await store.readObject(`transcriptions/${transcription.transcription_id}/body.md`);
  assert.equal(body, transcription.body_markdown);
  const cand = JSON.parse(
    await store.readObject(`candidates/${candidate.candidate_id}/import_candidate.json`)
  );
  assert.equal(cand.candidate_id, candidate.candidate_id);
});

test("createStoreFromRuntime requires Supabase unless memory fallback is allowed", () => {
  assert.throws(
    () => createStoreFromRuntime({}),
    (err) => err instanceof RitornuError && err.code === "platform-storage-unavailable"
  );
  const mem = createStoreFromRuntime({}, { allowMemoryFallback: true });
  assert.ok(mem instanceof MemoryStore);
});

test("SupabaseStore uploads to a private bucket via injected client", async () => {
  const uploads = [];
  const fakeSupabase = {
    storage: {
      from(bucket) {
        return {
          async upload(path, body, options) {
            uploads.push({ bucket, path, body, options });
            return { data: { path }, error: null };
          },
          async download(path) {
            const hit = uploads.find((u) => u.path === path);
            if (!hit) return { data: null, error: { message: "missing" } };
            return {
              data: {
                text: async () =>
                  typeof hit.body === "string" ? hit.body : Buffer.from(hit.body).toString("utf8"),
                arrayBuffer: async () =>
                  typeof hit.body === "string"
                    ? new TextEncoder().encode(hit.body).buffer
                    : hit.body.buffer,
              },
              error: null,
            };
          },
        };
      },
    },
  };

  const store = new SupabaseStore({ supabase: fakeSupabase, bucket: "ritornu-private" });
  const runtimeStore = createStoreFromRuntime({ supabase: fakeSupabase });
  assert.ok(runtimeStore instanceof SupabaseStore);

  await store.writeObject("captures/test/raw.html", "<html></html>", {
    contentType: "text/html",
  });
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].bucket, "ritornu-private");
  assert.equal(uploads[0].options.upsert, true);
  const text = await store.readObject("captures/test/raw.html");
  assert.equal(text, "<html></html>");
});
