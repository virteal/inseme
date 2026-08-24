import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmbeddingServiceConfig,
  handleEmbeddingRequest,
  publicEmbeddingStatus,
} from "../pilots/reference-js/src/embedding-service.js";

const config = createEmbeddingServiceConfig({
  MAGISTRAL_EMBEDDINGS_ENABLED: "true",
  MAGISTRAL_EMBEDDING_PROVIDER: "openai",
  MAGISTRAL_EMBEDDING_MODEL: "text-embedding-3-small",
  MAGISTRAL_EMBEDDING_DIMENSIONS: "3",
  OPENAI_API_KEY: "test-key",
});

test("Deno embedding service advertises only non-secret operational status", () => {
  const status = publicEmbeddingStatus(config);
  assert.equal(status.configured, true);
  assert.equal(JSON.stringify(status).includes("test-key"), false);
});

test("Deno embedding service returns an OpenAI-compatible vector response", async () => {
  const result = await handleEmbeddingRequest(
    { model: "text-embedding-3-small", input: "public query", dimensions: 3 },
    config,
    async () =>
      new Response(
        JSON.stringify({
          model: "text-embedding-3-small",
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          usage: { prompt_tokens: 2, total_tokens: 2 },
        }),
        { status: 200 },
      ),
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data[0].embedding, [0.1, 0.2, 0.3]);
});

test("Deno embedding service exposes safe provider diagnostics", async () => {
  const result = await handleEmbeddingRequest(
    { input: "public query" },
    config,
    async () => new Response("upstream failure", { status: 429 }),
  );
  assert.equal(result.status, 429);
  assert.deepEqual(result.body.error, {
    code: "embedding_provider_http_error",
    provider: "openai",
    model: "text-embedding-3-small",
    dimensions: 3,
    retryable: true,
    upstream_status: 429,
  });
});

test("Deno embedding service classifies a safe network failure reason", async () => {
  const networkError = new TypeError("fetch failed");
  networkError.cause = { code: "ENETUNREACH" };
  const result = await handleEmbeddingRequest(
    { input: "public query" },
    config,
    async () => {
      throw networkError;
    },
  );
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, "embedding_provider_unreachable");
  assert.equal(result.body.error.reason, "ENETUNREACH");
});
