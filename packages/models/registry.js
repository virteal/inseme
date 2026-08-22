/**
 * @kudocracy/models/registry.js
 * Registre central des modèles IA pour Kudocracy.
 */

export const SOVEREIGN_MODELS = {
  "qwen-2.5-coder-1.5b": {
    name: "Qwen 2.5 Coder 1.5B",
    filename: "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
    description: "Modèle léger et souverain, excellent pour le code et la logique de base.",
    context_window: 32768,
    recommended_threads: 4,
    tags: ["local", "sovereign", "coder"],
  },
  "llama-3.2-3b": {
    name: "Llama 3.2 3B",
    filename: "llama-3.2-3b-instruct.gguf",
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    description: "Excellent compromis performance/taille pour la discussion générale.",
    context_window: 128000,
    recommended_threads: 4,
    tags: ["local", "sovereign", "general"],
  },
};

export const REMOTE_MODELS = {
  fast: {
    openai: "gpt-5.6-terra",
    anthropic: "claude-haiku-4-5-20251001",
    groq: "llama-3.1-8b-instant",
    mistral: "mistral-small-latest",
  },
  advanced: {
    openai: "gpt-5.6-sol",
    anthropic: "claude-sonnet-5",
    groq: "llama-3.3-70b-versatile",
    mistral: "mistral-large-latest",
  },
};

export const TRANSCRIPTION_MODELS = {
  openai: "whisper-1",
  groq: "whisper-large-v3",
};

export const SOVEREIGN_TTS = {
  "kokoro-v0.19": {
    name: "Kokoro TTS 82M",
    repo: "hexgrad/Kokoro-82M",
    lang: "fr-FR",
    voices: ["ff_siwis", "fr_fr_denise"], // ff_siwis est très stable en français
    port: "8880",
  },
};

/**
 * Embedding models for semantic search and vector operations.
 *
 * These models are managed via external providers (Ollama, llama.cpp, etc.).
 * They are not GGUF files in the models/ directory like SOVEREIGN_MODELS.
 *
 * Provider support:
 * - ollama: Requires `ollama pull <model>` from https://ollama.com
 * - llama.cpp: Requires manual download and embedding endpoint support
 */
export const EMBEDDING_MODELS = {
  "mxbai-embed-large": {
    name: "MXBai Embed Large",
    provider: "ollama",
    ollama_name: "mxbai-embed-large",
    url: "https://ollama.com/library/mxbai-embed-large",
    description: "Modèle d'embeddings haute performance basé sur MXBai. Dimensions natives: 1024.",
    native_dimensions: 1024,
    output_dimensions: 1024,
    dimension_method: "native",
    policy_version: "magistral-mxbai-embed-1024-v1",
    install_command: "ollama pull mxbai-embed-large",
    tags: ["local", "sovereign", "embeddings", "multilingual"],
    available: true,
  },
  // "qwen3-embedding-4b": {
  //   name: "Qwen3 Embedding 4B",
  //   provider: "ollama",
  //   ollama_name: "qwen3-embedding-4b",
  //   url: "https://ollama.com/library/qwen3-embedding-4b",
  //   description: "Modèle d'embeddings multilingue haute performance. Dimensions natives: 2560, sorties configurées à 1536 via MRL.",
  //   native_dimensions: 2560,
  //   output_dimensions: 1536,
  //   dimension_method: "mrl", // Matryoshka Representation Learning
  //   policy_version: "magistral-qwen3-embedding-1536-v1",
  //   install_command: "ollama pull qwen3-embedding-4b",
  //   tags: ["local", "sovereign", "embeddings", "multilingual"],
  //   available: false, // Not available in Ollama yet
  // },
};

export const getModelByTag = (tag) => {
  return Object.values(SOVEREIGN_MODELS).filter((m) => m.tags.includes(tag));
};
