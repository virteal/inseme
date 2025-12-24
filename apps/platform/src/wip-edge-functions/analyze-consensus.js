import { getConfig } from "../../common/config/instanceConfig.edge.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared config from summarize.js (duplicated for independence, ideally should be valid shared lib)
const PROVIDER_CONFIGS = {
  mistral: {
    apiUrl: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-large-latest", // Use Strong model for reasoning
  },
  anthropic: {
    apiUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-3-5-sonnet-20240620",
  },
  openai: {
    apiUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o",
  },
  huggingface: {
    apiUrl: "https://router.huggingface.co/v1/chat/completions",
    defaultModel: "deepseek-ai/DeepSeek-V3", // Strong model
  },
};

const isProviderAvailable = (provider) => {
  const keyName = `${provider.toLowerCase()}_api_key`;
  return Boolean(getConfig(keyName));
};

const getAvailableProvider = () => {
  // Prefer Anthropic or OpenAI for complex reasoning
  const providers = ["anthropic", "openai", "anthropic", "mistral", "huggingface"];
  for (const provider of providers) {
    if (isProviderAvailable(provider)) {
      return provider;
    }
  }
  return null;
};

async function analyzeConsensus(payload, provider = null) {
  if (!provider) provider = getAvailableProvider();
  if (!provider) throw new Error("No AI provider configured.");

  const config = PROVIDER_CONFIGS[provider];
  const apiKey = getConfig(`${provider.toLowerCase()}_api_key`);
  const model = config.defaultModel;

  const { title, description, refusalReasons, comments } = payload;

  const systemPrompt = `Tu es Ophélia, une Médiatrice Démocratique IA. Ton rôle est d'analyser les blocages dans les votes et de proposer des compromis constructifs. Tu es neutre, bienveillante et orientée solutions.`;

  const userPrompt = `
  Analyse la proposition suivante et les raisons de son rejet (notamment les votes "Faux Dilemme").

  Titre : ${title}
  Description : ${description}

  Raisons de refus (Votes Faux Dilemme) :
  ${JSON.stringify(refusalReasons, null, 2)}

  Commentaires pertinents :
  ${comments ? comments.join("\n") : "Aucun commentaire."}

  Tâche :
  1. Identifie le point de blocage principal. Pourquoi les gens refusent-ils de répondre par Oui ou Non ?
  2. Propose une reformulation ou un amendement précis du texte qui permettrait de lever ce blocage (intégration de l'option manquante, clarification du biais, etc.).

  Réponds UNIQUEMENT au format JSON strict :
  {
    "analysis": "Explication courte du conflit...",
    "amendment": "Proposition de nouveau texte..."
  }
  `;

  // Standardize request format
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let requestBody = {
    model,
    messages,
    temperature: 0.2, // Low partiality
    response_format: { type: "json_object" }, // Enforce JSON if supported
  };

  let headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === "anthropic") {
    delete requestBody.response_format; // Not supported same way
    requestBody.max_tokens = 1000;
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    delete headers["Authorization"];
  }

  const apiUrl = typeof config.apiUrl === "function" ? config.apiUrl(model) : config.apiUrl;

  console.log(`[Consensus] Requesting ${provider} (${model})...`);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const txt = await response.text();
    console.error("AI Error", txt);
    throw new Error(`AI Provider error: ${response.status}`);
  }

  const data = await response.json();
  let content = "";

  if (provider === "anthropic") {
    content = data.content[0].text;
  } else {
    content = data.choices[0].message.content;
  }

  // Sanitize Markdown blocks if present
  content = content.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error("JSON Parse Error", content);
    // Fallback if AI didn't return valid JSON
    return {
      analysis: content,
      amendment: "Erreur de formatage.",
    };
  }
}

export default async (request, context) => {
  // CORS
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const body = await request.json();
    const result = await analyzeConsensus(body);
    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config = { path: "/api/analyze-consensus" };
