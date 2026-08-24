/**
 * Independent OpenAI-compatible embeddings capability for the Deno pilot.
 *
 * It is deliberately separate from ACP: a coding agent is a chat capability,
 * not an embedding provider. Configuration stays deployment-local.
 */

const DEFAULT_OPENAI_URL = "https://api.openai.com/v1/embeddings";

export function createEmbeddingServiceConfig(env = {}) {
  const enabled = parseBoolean(env.MAGISTRAL_EMBEDDINGS_ENABLED);
  const provider = String(env.MAGISTRAL_EMBEDDING_PROVIDER || "openai")
    .toLowerCase();
  const model = String(
    env.MAGISTRAL_EMBEDDING_MODEL || "text-embedding-3-small",
  );
  const dimensions = boundedInteger(
    env.MAGISTRAL_EMBEDDING_DIMENSIONS,
    1536,
    1,
    3072,
  );
  return {
    enabled,
    provider,
    model,
    dimensions,
    policy: String(
      env.MAGISTRAL_EMBEDDING_POLICY || "magistral-openai-embedding-v1",
    ),
    timeout_ms: boundedInteger(
      env.MAGISTRAL_EMBEDDING_TIMEOUT_MS,
      15000,
      1000,
      120000,
    ),
    openai_url: String(
      env.MAGISTRAL_EMBEDDING_OPENAI_URL || DEFAULT_OPENAI_URL,
    ),
    api_key: String(env.OPENAI_API_KEY || env.COGENTIA_OPENAI_API_KEY || ""),
  };
}

export function publicEmbeddingStatus(config) {
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    dimensions: config.dimensions,
    policy: config.policy,
    configured: Boolean(config.api_key),
    endpoint: "/v1/embeddings",
  };
}

export async function handleEmbeddingRequest(
  payload,
  config,
  fetchImpl = fetch,
) {
  if (!config.enabled) return failure(503, "embeddings_disabled", config);
  if (config.provider !== "openai") {
    return failure(503, "embedding_provider_unsupported", config);
  }
  if (!config.api_key) {
    return failure(503, "embedding_provider_unconfigured", config);
  }

  const input = payload?.input;
  const inputs = Array.isArray(input) ? input : input == null ? [] : [input];
  if (
    !inputs.length ||
    !inputs.every((item) => typeof item === "string" && item.trim())
  ) {
    return failure(400, "invalid_embedding_input", config);
  }
  if (payload?.model && payload.model !== config.model) {
    return failure(400, "embedding_model_mismatch", config);
  }
  if (
    payload?.dimensions != null &&
    Number(payload.dimensions) !== config.dimensions
  ) {
    return failure(400, "embedding_dimensions_mismatch", config);
  }

  let response;
  try {
    response = await fetchImpl(config.openai_url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: inputs,
        dimensions: config.dimensions,
      }),
      signal: AbortSignal.timeout(config.timeout_ms),
    });
  } catch {
    return failure(503, "embedding_provider_unreachable", config, {
      retryable: true,
    });
  }
  if (!response.ok) {
    return failure(
      response.status === 429 ? 429 : 502,
      "embedding_provider_http_error",
      config,
      {
        upstream_status: response.status,
        retryable: response.status === 429 || response.status >= 500,
      },
    );
  }
  const body = await response.json().catch(() => null);
  const data = Array.isArray(body?.data) ? body.data : [];
  if (
    data.length !== inputs.length ||
    data.some((item) =>
      !Array.isArray(item.embedding) ||
      item.embedding.length !== config.dimensions
    )
  ) {
    return failure(502, "invalid_embedding_response", config);
  }
  return {
    status: 200,
    body: {
      object: "list",
      data: data.map((item, index) => ({
        object: "embedding",
        index,
        embedding: item.embedding,
      })),
      model: body.model || config.model,
      usage: body.usage || null,
    },
  };
}

function failure(status, code, config, extra = {}) {
  return {
    status,
    body: {
      error: {
        code,
        provider: config.provider,
        model: config.model,
        dimensions: config.dimensions,
        retryable: false,
        ...extra,
      },
    },
  };
}

function parseBoolean(value) {
  return /^(?:1|true|yes)$/i.test(String(value || "").trim());
}

function boundedInteger(value, fallback, min, max) {
  const numeric = Number(value);
  return Number.isInteger(numeric)
    ? Math.max(min, Math.min(max, numeric))
    : fallback;
}
