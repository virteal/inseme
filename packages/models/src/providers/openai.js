/**
 * @models/providers/openai.js
 * OpenAI Embeddings Provider for Magistral
 *
 * Provides OpenAI-hosted embedding models with OpenAI-compatible API.
 * Supports text-embedding-3-small and text-embedding-3-large.
 */

const DEFAULT_OPENAI_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Check OpenAI API availability
 */
export async function checkAvailability(apiKey, apiUrl = DEFAULT_OPENAI_URL, options = {}) {
  if (!apiKey) {
    return { available: false, error: "missing_api_key" };
  }
  if (!options.probe) {
    return { available: true, error: null, mode: "configured" };
  }
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: "test",
      }),
      signal: AbortSignal.timeout(resolveTimeoutMs(options.timeoutMs)),
    });

    if (response.status === 401) {
      return { available: false, error: "invalid_api_key" };
    }

    if (response.status === 429) {
      return { available: false, error: "rate_limited" };
    }

    return { available: response.ok, error: !response.ok ? `http_${response.status}` : null };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

/**
 * Generate embedding for a single text
 */
export async function embedOne(text, model = "text-embedding-3-small", options = {}) {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    apiUrl = DEFAULT_OPENAI_URL,
    dimensions = null,
    timeoutMs = null,
  } = options;

  if (!apiKey) {
    throw new Error("OpenAI API key is required. Set OPENAI_API_KEY environment variable.");
  }

  const requestBody = {
    model,
    input: text,
  };

  // Add dimensions parameter for text-embedding-3 models (optional)
  if (dimensions && model.includes("text-embedding-3")) {
    requestBody.dimensions = dimensions;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(resolveTimeoutMs(timeoutMs)),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error("Invalid response from OpenAI API");
  }

  return {
    embedding: data.data[0].embedding,
    model: data.model,
    usage: data.usage,
  };
}

/**
 * Generate embeddings for multiple texts (batch)
 * OpenAI supports up to 2048 texts per request for embedding models
 */
export async function embedMany(texts, model = "text-embedding-3-small", options = {}) {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    apiUrl = DEFAULT_OPENAI_URL,
    dimensions = null,
    timeoutMs = null,
  } = options;

  if (!apiKey) {
    throw new Error("OpenAI API key is required. Set OPENAI_API_KEY environment variable.");
  }

  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error("texts must be a non-empty array");
  }

  // OpenAI limit: 2048 texts per request
  const MAX_BATCH_SIZE = 2048;
  if (texts.length > MAX_BATCH_SIZE) {
    throw new Error(`Cannot process more than ${MAX_BATCH_SIZE} texts in a single request`);
  }

  const requestBody = {
    model,
    input: texts,
  };

  // Add dimensions parameter for text-embedding-3 models
  if (dimensions && model.includes("text-embedding-3")) {
    requestBody.dimensions = dimensions;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(resolveTimeoutMs(timeoutMs)),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (!data.data || !Array.isArray(data.data)) {
    throw new Error("Invalid response from OpenAI API");
  }

  return {
    embeddings: data.data.map((item) => item.embedding),
    model: data.model,
    usage: data.usage,
  };
}

/**
 * Truncate or pad embedding to match target dimensions
 * (Not typically needed for OpenAI as dimensions are configurable via API)
 */
export function ensureDimensions(embedding, targetDimensions) {
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding must be an array");
  }

  const currentDimensions = embedding.length;

  if (currentDimensions === targetDimensions) {
    return embedding;
  }

  if (currentDimensions > targetDimensions) {
    // Truncate (not recommended for semantic quality)
    return embedding.slice(0, targetDimensions);
  }

  // Pad with zeros (not recommended for semantic quality)
  return [...embedding, ...new Array(targetDimensions - currentDimensions).fill(0)];
}

/**
 * Model specifications
 */
export const MODELS = {
  "text-embedding-3-small": {
    name: "text-embedding-3-small",
    native_dimensions: 1536,
    configurable_dimensions: [1536, 768, 512, 256],
    max_input_tokens: 8191,
    description: "Efficient embedding model, good for most semantic search tasks",
    pricing: "$0.02 per 1M tokens",
  },
  "text-embedding-3-large": {
    name: "text-embedding-3-large",
    native_dimensions: 3072,
    configurable_dimensions: [3072, 2560, 1536, 768],
    max_input_tokens: 8191,
    description: "High-performance embedding model for complex semantics",
    pricing: "$0.13 per 1M tokens",
  },
};

function resolveTimeoutMs(value) {
  const parsed = Number.parseInt(
    value ||
      process.env.MAGISTRAL_EMBEDDING_TIMEOUT_MS ||
      process.env.OPENAI_EMBEDDING_TIMEOUT_MS ||
      DEFAULT_TIMEOUT_MS,
    10
  );
  return Number.isFinite(parsed) ? Math.max(1000, Math.min(parsed, 120000)) : DEFAULT_TIMEOUT_MS;
}

export default {
  checkAvailability,
  embedOne,
  embedMany,
  ensureDimensions,
  MODELS,
  DEFAULT_OPENAI_URL,
};
