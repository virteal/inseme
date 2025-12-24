import { DocumentSearchConfig } from "./config.js";

export class GeminiFileSearchClient {
  constructor() {
    this.apiKey = DocumentSearchConfig.GEMINI_API_KEY;
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  }

  /**
   * Appelle l'API Gemini pour générer du contenu.
   * Supporte le Context Caching (recommandé) ou l'outil File Search (legacy).
   *
   * @param {Object} params
   * @param {string} params.model - Modèle à utiliser (ex: "gemini-1.5-flash-001")
   * @param {string} params.systemInstruction - Prompt système
   * @param {string} params.userPrompt - Prompt utilisateur
   * @param {string} [params.cachedContent] - Nom de la ressource de cache (ex: "cachedContents/xxxx")
   * @param {string[]} [params.fileSearchStoreNames] - (Legacy) Liste des stores File Search
   * @param {Object} [params.generationConfig] - Config de génération (JSON, etc.)
   * @returns {Promise<Object>} Réponse brute de l'API
   */
  async generateContent({
    model = "gemini-1.5-flash-001",
    systemInstruction,
    userPrompt,
    cachedContent,
    fileSearchStoreNames = [],
    generationConfig = {},
  }) {
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: generationConfig,
    };

    // Si un cache est fourni, on l'utilise (Priorité 1)
    // Note: Avec le cache, le systemInstruction est souvent défini DANS le cache,
    // mais on peut parfois le surcharger ou l'ajouter ici selon le modèle.
    // Pour l'instant, on l'ajoute au body si présent.
    if (systemInstruction) {
      body.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    if (cachedContent) {
      body.cachedContent = cachedContent;
    }
    // Sinon, on regarde si on doit utiliser File Search (Legacy / Fallback)
    else if (fileSearchStoreNames.length > 0) {
      body.tools = [
        {
          file_search: {
            file_search_store_names: fileSearchStoreNames,
          },
        },
      ];
    }

    console.log("[GeminiClient] Request URL:", url);
    // console.log("[GeminiClient] Request Body:", JSON.stringify(body, null, 2)); // Debug only

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }
}
