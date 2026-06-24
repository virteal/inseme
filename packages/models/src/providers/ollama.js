/**
 * Ollama Embedding Provider
 *
 * Provides embeddings via local Ollama instance.
 * Supports mxbai-embed-large (1024 dims) and other Ollama embedding models.
 */

import fetch from "node-fetch";

const DEFAULT_OLLAMA_URL = process.env.MAGISTRAL_OLLAMA_URL || "http://127.0.0.1:11434";
const DEFAULT_MODEL = "mxbai-embed-large";
const DEFAULT_DIMENSIONS = 1024;
const MAX_INPUT_CHARS = parseInt(process.env.MAGISTRAL_EMBEDDING_MAX_INPUT_CHARS || "12000", 10);
const BATCH_SIZE = parseInt(process.env.MAGISTRAL_EMBEDDING_BATCH_SIZE || "8", 10);

/**
 * Check if Ollama is available and responsive.
 */
async function checkAvailability(baseUrl = DEFAULT_OLLAMA_URL) {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get model info from Ollama.
 */
async function getModelInfo(model, baseUrl = DEFAULT_OLLAMA_URL) {
  try {
    const res = await fetch(`${baseUrl}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Generate embeddings for a single text.
 * Returns number[] of dimensions.
 */
async function embedOne(text, model = DEFAULT_MODEL, baseUrl = DEFAULT_OLLAMA_URL) {
  const res = await fetch(`${baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: text,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Ollama embedding failed: ${res.status} ${error}`);
  }

  const data = await res.json();
  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error("Invalid embedding response from Ollama");
  }

  return data.embedding;
}

/**
 * Generate embeddings for multiple texts (batch processing).
 * Returns number[][] where each inner array is an embedding vector.
 */
async function embedMany(texts, model = DEFAULT_MODEL, baseUrl = DEFAULT_OLLAMA_URL) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error("embedMany requires non-empty array");
  }

  // Validate input size
  const totalChars = texts.reduce((sum, t) => sum + String(t).length, 0);
  if (totalChars > MAX_INPUT_CHARS * texts.length) {
    throw new Error(`Input exceeds maximum character limit (${MAX_INPUT_CHARS} per text)`);
  }

  // Process in batches
  const results = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map((text) => embedOne(text, model, baseUrl));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Get provider info for health/status endpoints.
 */
async function getProviderInfo(model = DEFAULT_MODEL, baseUrl = DEFAULT_OLLAMA_URL) {
  const available = await checkAvailability(baseUrl);
  const modelData = available ? await getModelInfo(model, baseUrl) : null;

  // Determine native dimensions from model info
  // qwen3-embedding-4b native is 2560, we'll truncate to 1536
  const nativeDimensions = modelData?.embedding_length || 2560;

  return {
    provider: "ollama",
    model,
    baseUrl,
    available,
    native_dimensions: nativeDimensions,
    output_dimensions: DEFAULT_DIMENSIONS,
    dimension_method: "mrl-truncate", // Matryoshka Representation Learning
    deterministic: true,
    batch_size: BATCH_SIZE,
    max_input_chars: MAX_INPUT_CHARS,
  };
}

/**
 * Ensure embedding dimensions match expected output.
 * For qwen3-embedding-4b, we use MRL truncation to 1536.
 */
function ensureDimensions(embedding, targetDim = DEFAULT_DIMENSIONS) {
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding must be an array");
  }

  if (embedding.length < targetDim) {
    throw new Error(
      `Embedding dimension mismatch: got ${embedding.length}, expected at least ${targetDim}`
    );
  }

  // Truncate using MRL (Matryoshka Representation Learning)
  // This is the officially supported method for qwen3-embedding models
  return embedding.slice(0, targetDim);
}

export default {
  checkAvailability,
  getModelInfo,
  embedOne,
  embedMany,
  getProviderInfo,
  ensureDimensions,
  DEFAULT_MODEL,
  DEFAULT_DIMENSIONS,
  DEFAULT_OLLAMA_URL,
};
