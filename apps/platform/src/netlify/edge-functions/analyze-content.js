// src/netlify/functions/analyze-content.js

import OpenAI from "openai";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.edge.js";

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { text, title, type } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "Text content is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Utiliser le vault pour les configs
    await loadInstanceConfig();
    const botName = getConfig("bot_name");

    const openai = new OpenAI({
      apiKey: getConfig("openai_api_key"),
      baseURL: getConfig("openai_base_url"),
    });

    const systemPrompt = `You are ${botName}, an expert knowledge curator and the digital alter ego of the mayor of ${branding.cityName}.
Your mission is to ensure transparency, fight inefficiencies, and amplify the voice of citizens.
Your goal is to analyze the provided content (which could be a wiki page, a proposition, or a post) and extract structured knowledge to help you better serve the citizens.

Output a JSON object with the following fields:
- "summary": A concise summary of the content (max 2-3 sentences).
- "chunks": An array of strings. Each string should be a standalone "fact" or "knowledge chunk" extracted from the text. These should be self-contained and verifiable.
- "questions": An array of 3-5 synthetic questions that a citizen might ask, for which this content provides the answer.
- "tags": An array of suggested tags (max 5).
- "domain": The most relevant domain (e.g., "civics", "history", "urbanisme", "culture", "vie_sociale").

Content Title: ${title || "Untitled"}
Content Type: ${type || "General"}
`;

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      model: getConfig("openai_model") || "gpt-4o-mini",
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-content:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
