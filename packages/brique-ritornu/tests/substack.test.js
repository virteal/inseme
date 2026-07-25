import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MemoryStore,
  RitornuError,
  SUBSTACK_FALLBACKS,
  assertSubstackPublicPostUrl,
  fetchSubstackPublicPost,
  prepareSubstackPublicUrl,
} from "../src/index.js";
import toolPrepareSubstack from "../src/edge/tool-prepare-substack.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "..", "fixtures", "substack-backup", "raw.html");
const FIXED_TS = "2026-07-24T12:00:00.000Z";
const SAMPLE_URL = "https://example.substack.com/p/backup?utm_source=share&utm_medium=web&fbclid=x";

test("assertSubstackPublicPostUrl accepts a single post URL and strips tracking", () => {
  const id = assertSubstackPublicPostUrl(SAMPLE_URL);
  assert.equal(id.canonical_url, "https://example.substack.com/p/backup");
  assert.equal(id.publication_slug, "backup");
});

test("assertSubstackPublicPostUrl rejects non-posts and multi-URL input", () => {
  assert.throws(
    () => assertSubstackPublicPostUrl("https://example.substack.com/"),
    (err) => err instanceof RitornuError && err.code === "not-a-post-url"
  );
  assert.throws(
    () =>
      assertSubstackPublicPostUrl(
        "https://example.substack.com/p/a https://example.substack.com/p/b"
      ),
    (err) => err instanceof RitornuError && err.code === "multiple-urls"
  );
  assert.throws(
    () => assertSubstackPublicPostUrl("https://example.com/p/backup"),
    (err) => err instanceof RitornuError && err.code === "not-substack"
  );
});

test("fetchSubstackPublicPost captures fixture HTML via injected fetch", async () => {
  const html = readFileSync(FIXTURE, "utf8");
  const fetchImpl = async (url, init) => {
    assert.match(url, /example\.substack\.com\/p\/backup$/);
    assert.equal(init.method, "GET");
    assert.equal(init.headers.Cookie, undefined);
    assert.equal(init.headers.Authorization, undefined);
    return {
      ok: true,
      status: 200,
      url,
      headers: { get: (name) => (name.toLowerCase() === "content-type" ? "text/html" : null) },
      text: async () => html,
    };
  };

  const result = await fetchSubstackPublicPost(SAMPLE_URL, { fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.method, "public-url");
  assert.equal(result.canonical_url, "https://example.substack.com/p/backup");
  assert.match(result.raw_html, /keeping a copy of your own words/i);
});

test("fetchSubstackPublicPost returns explicit unavailable on HTTP errors", async () => {
  const fetch404 = async () => ({
    ok: false,
    status: 404,
    url: "https://example.substack.com/p/missing",
    headers: { get: () => "text/html" },
    text: async () => "not found",
  });
  const missing = await fetchSubstackPublicPost("https://example.substack.com/p/missing", {
    fetchImpl: fetch404,
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, "unavailable");
  assert.equal(missing.error.code, "http-404");
  assert.deepEqual(missing.fallbacks, [...SUBSTACK_FALLBACKS]);

  const fetch403 = async () => ({
    ok: false,
    status: 403,
    url: "https://example.substack.com/p/secret",
    headers: { get: () => "text/html" },
    text: async () => "forbidden",
  });
  const denied = await fetchSubstackPublicPost("https://example.substack.com/p/secret", {
    fetchImpl: fetch403,
  });
  assert.equal(denied.error.code, "http-403");
});

test("prepareSubstackPublicUrl builds review-request candidate and stores privately", async () => {
  const html = readFileSync(FIXTURE, "utf8");
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    url,
    headers: { get: () => "text/html; charset=utf-8" },
    text: async () => html,
  });
  const store = new MemoryStore();
  const prepared = await prepareSubstackPublicUrl({
    url: SAMPLE_URL,
    store,
    fetchImpl,
    createdAt: FIXED_TS,
  });

  assert.equal(prepared.ok, true);
  assert.equal(prepared.candidate.state, "review-request");
  assert.equal(prepared.review_required, true);
  assert.equal(prepared.git_write_forbidden, true);
  assert.equal(prepared.transcription.title, "Backup — keeping a copy of your own words");
  assert.equal(prepared.transcription.author, "Ada Example");
  assert.equal(prepared.transcription.published_at, "2024-03-15T10:00:00.000Z");
  assert.equal(prepared.transcription.canonical_url, "https://example.substack.com/p/backup");
  assert.match(prepared.transcription.body_markdown, /personal publication is not owned/i);
  assert.doesNotMatch(prepared.transcription.body_markdown, /Subscribe to receive/i);
  assert.equal(prepared.capture.method, "public-url");
  assert.equal(prepared.capture.proof.visibility, "private");
  assert.ok(prepared.capture.proof.relative_path.startsWith("captures/"));
  assert.ok(store.objects.has(prepared.capture.proof.relative_path));
});

test("edge tool requires Supabase and never returns raw HTML on success path", async () => {
  const noSb = await toolPrepareSubstack({}, { url: SAMPLE_URL });
  assert.equal(noSb.success, false);
  assert.equal(noSb.error.code, "platform-storage-unavailable");

  const html = readFileSync(FIXTURE, "utf8");
  const uploads = new Map();
  const runtime = {
    supabase: {
      storage: {
        from(bucket) {
          return {
            async upload(path, body) {
              uploads.set(`${bucket}:${path}`, body);
              return { data: { path }, error: null };
            },
            async download(path) {
              const body = uploads.get(`${bucket}:${path}`);
              if (body == null) return { data: null, error: { message: "missing" } };
              return {
                data: {
                  text: async () =>
                    typeof body === "string" ? body : Buffer.from(body).toString("utf8"),
                },
                error: null,
              };
            },
          };
        },
      },
    },
    config: { ritornu_storage_bucket: "ritornu-private" },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true,
    status: 200,
    url,
    headers: { get: () => "text/html" },
    text: async () => html,
  });
  try {
    const res = await toolPrepareSubstack(runtime, { url: SAMPLE_URL });
    assert.equal(res.success, true);
    assert.equal(res.review_required, true);
    assert.equal(res.git_write_forbidden, true);
    assert.equal(res.summary.title, "Backup — keeping a copy of your own words");
    assert.equal(res.candidate.state, "review-request");
    assert.equal(res.raw_html, undefined);
    assert.ok([...uploads.keys()].some((k) => k.includes("raw.html")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
