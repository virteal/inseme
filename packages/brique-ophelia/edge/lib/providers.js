/**
 * packages/brique-ophelia/edge/lib/providers.js
 * Gestionnaire des fournisseurs d'IA (OpenAI, Anthropic, Mistral, Google, HuggingFace).
 * Restauration de la parité avec rag_chatbotv3.js (shuffling, metrics skipping).
 */

import OpenAI from "https://esm.sh/openai@4";

export const PROVIDERS = ["openai", "mistral", "anthropic", "google", "huggingface"];

export const MODEL_MODES = {
  mistral: {
    fast: "mistral-small-latest",
    strong: "mistral-large-latest",
    reasoning: "mistral-large-latest",
  },
  anthropic: {
    main: "claude-3-5-sonnet-20240620",
    fast: "claude-3-haiku-20240307",
    strong: "claude-3-5-sonnet-20241022",
  },
  openai: {
    main: "gpt-4o",
    fast: "gpt-4o-mini",
    reasoning: "o1-preview",
  },
  google: {
    main: "gemini-1.5-pro",
    fast: "gemini-1.5-flash",
  },
  huggingface: {
    main: "mistralai/Mixtral-8x22B-Instruct-v0.1",
  }
};

export const DEFAULT_MODEL_MODES = {
  mistral: "fast",
  anthropic: "main",
  openai: "main",
  google: "fast",
  huggingface: "main"
};

/**
 * Mélange aléatoirement les fournisseurs.
 */
export function shuffleProviders(providers) {
  const arr = [...providers];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Décide si un fournisseur doit être sauté (metrics, quotas).
 * (Simplified version of the legacy BOT metrics)
 */
export function shouldSkipProvider(runtime, provider) {
    const { getConfig } = runtime;
    const apiKey = getConfig(`${provider.toUpperCase()}_API_KEY`) || (provider === 'google' && getConfig('GEMINI_API_KEY'));
    if (!apiKey) return true;
    
    // In a full implementation, we would check a global metrics store here
    return false;
}

/**
 * Construit l'ordre de passage des fournisseurs.
 */
export function buildProviderOrder(runtime, enforcedProvider = null) {
    let order = [...PROVIDERS];
    if (enforcedProvider && order.includes(enforcedProvider)) {
        order = [enforcedProvider, ...order.filter(p => p !== enforcedProvider)];
    } else {
        // Prioritize OpenAI by default if available
        order = ["openai", ...order.filter(p => p !== "openai")];
    }
    
    // Filter & Randomize remaining
    const available = order.filter(p => !shouldSkipProvider(runtime, p));
    if (!enforcedProvider) {
        // Keep the first one, shuffle the rest? Or shuffle all?
        // Legacy bot shuffles all if no enforced provider.
        return shuffleProviders(available);
    }
    return available;
}

/**
 * Résout le modèle à utiliser.
 */
export function resolveModel(provider, mode, overrideModel) {
    if (overrideModel) return overrideModel;
    const providerModes = MODEL_MODES[provider] || {};
    return providerModes[mode] || providerModes[DEFAULT_MODEL_MODES[provider]] || Object.values(providerModes)[0];
}

/**
 * Initialise un client OpenAI-compatible.
 */
export function createAIClient(runtime, provider) {
  const { getConfig } = runtime;
  
  let apiKey = "";
  let baseURL = "";

  if (provider === "anthropic") {
    apiKey = getConfig("ANTHROPIC_API_KEY");
    baseURL = "https://api.anthropic.com/v1"; 
  } else if (provider === "mistral") {
    apiKey = getConfig("MISTRAL_API_KEY");
    baseURL = "https://api.mistral.ai/v1";
  } else if (provider === "google") {
    apiKey = getConfig("GEMINI_API_KEY") || getConfig("GOOGLE_GENERATIVE_AI_API_KEY");
    baseURL = "https://generativelanguage.googleapis.com/v1beta/openai";
  } else if (provider === "huggingface") {
    apiKey = getConfig("HUGGINGFACE_API_KEY");
    baseURL = "https://router.huggingface.co/v1";
  } else {
    apiKey = getConfig("OPENAI_API_KEY");
    baseURL = "https://api.openai.com/v1";
  }

  if (!apiKey) throw new Error(`${provider.toUpperCase()} API key is missing`);

  return new OpenAI({
    apiKey,
    baseURL,
    // For Anthropic, we'd normally need a special header or a proxy, 
    // but many services now offer OpenAI-compatible endpoints.
    // If native Anthropic is needed, we'd use the '@anthropic-ai/sdk'.
    defaultHeaders: provider === "anthropic" ? { "anthropic-version": "2023-06-01" } : undefined
  });
}
