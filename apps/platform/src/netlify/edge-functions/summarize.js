// ============================================================================
// AI Text Summarization Endpoint
// Provides text summarization service for the Data Collector feature
// ============================================================================

import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.edge.js";

// Import shared utilities from rag_chatbot if needed
const MODEL_MODES = {
  mistral: {
    fast: "mistral-small-latest",
    strong: "mistral-large-latest",
  },
  anthropic: {
    main: "claude-sonnet-4-5-20250929",
    cheap: "claude-3-haiku-20240307",
  },
  openai: {
    main: "gpt-5.1-mini",
    reasoning: "gpt-5.1",
  },
  huggingface: {
    main: "deepseek-ai/DeepSeek-V3",
    small: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
  },
};

const PROVIDER_CONFIGS = {
  mistral: {
    apiUrl: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-small-latest",
  },
  anthropic: {
    apiUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-3-haiku-20240307", // Use cheapest for summaries
  },
  openai: {
    apiUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-5.1",
  },
  huggingface: {
    apiUrl: "https://router.huggingface.co/v1/chat/completions",
    defaultModel: "deepseek-ai/DeepSeek-V3",
  },
};

// Check which providers are available
const isProviderAvailable = (provider) => {
  const keyName = `${provider.toLowerCase()}_api_key`;
  return Boolean(getConfig(keyName));
  // TODO: there should be a mechanism to devalidate a provider when
  // credit quota is exhausted
};

// Get first available provider
const getAvailableProvider = () => {
  const providers = ["openai", "mistral", "anthropic", "huggingface"];
  for (const provider of providers) {
    if (isProviderAvailable(provider)) {
      console.log(`[Summarize] ✅ Using provider: ${provider}`);
      return provider;
    }
  }
  return null;
};

// Summarize text using available AI provider
async function summarizeText(text, provider = null) {
  // Load vault config
  await loadInstanceConfig();

  // Auto-detect provider if not specified
  if (!provider) {
    provider = getAvailableProvider();
  }

  if (!provider) {
    throw new Error(
      "Aucun provider IA configuré. Veuillez configurer OPENAI_API_KEY, MISTRAL_API_KEY, ANTHROPIC_API_KEY ou HUGGINGFACE_API_KEY."
    );
  }

  const config = PROVIDER_CONFIGS[provider];
  const keyName = `${provider.toLowerCase()}_api_key`;
  const apiKey = getConfig(keyName);

  if (!apiKey) {
    throw new Error(`Clé API manquante pour ${provider}`);
  }

  const model = config.defaultModel;
  const systemPrompt =
    "Tu es un assistant qui résume des textes de manière concise. Réponds uniquement avec le résumé en 1-2 phrases, en conservant les informations essentielles.";
  const userPrompt = `Résume le texte suivant en une ou deux phrases claires et concises, en conservant les informations essentielles:\n\n"${text}"`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const payload = {
    model,
    messages,
    temperature: 0.3,
    top_p: 0.95,
    stream: false,
    max_tokens: 200, // Limit summary length
  };

  console.log(`[Summarize] ➜ ${provider} request: model=${model}`);

  // Prepare headers based on provider
  let headers = {
    "Content-Type": "application/json",
  };

  if (provider === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    // Anthropic uses different payload structure
    delete payload.stream;
    payload.max_tokens = 200;
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const apiUrl = typeof config.apiUrl === "function" ? config.apiUrl(model) : config.apiUrl;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  console.log(`[Summarize] ⬅ ${provider} status=${response.status}`);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Summarize] ❌ ${provider} error:`, errorBody);
    throw new Error(`${provider} API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract text based on provider response format
  let summary = "";
  if (provider === "anthropic") {
    summary = data.content?.[0]?.text || "";
  } else {
    summary = data.choices?.[0]?.message?.content || "";
  }

  console.log(`[Summarize] ✅ Summary generated (${summary.length} chars)`);
  return summary.trim();
}

// Main handler
const handler = async (request) => {
  // Only accept POST requests
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Corps de requête invalide" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate text parameter
  const text = body?.text;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "Le paramètre 'text' est requis et doit être une chaîne non vide" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Optional provider parameter
  const provider = body?.provider || null;

  try {
    console.log(
      `[Summarize] ➜ Request received: text length=${text.length}, provider=${provider || "auto"}`
    );

    const summary = await summarizeText(text, provider);

    return new Response(
      JSON.stringify({
        summary,
        provider: provider || getAvailableProvider(),
        originalLength: text.length,
        summaryLength: summary.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("[Summarize] ❌ Error:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Erreur lors de la génération du résumé",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export default handler;
export const config = { path: "/api/summarize" };
