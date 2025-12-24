import { DocumentSearchConfig } from "./config.js";
import { FileSearchCache } from "./cache.js";
import { DocumentSources } from "./sources.js";
import { GeminiFileSearchClient } from "./gemini-client.js";

const cache = new FileSearchCache();
const sources = new DocumentSources();
const gemini = new GeminiFileSearchClient();

/**
 * Normalise et reformule la question en fonction de l'historique.
 * @param {string} userQuestion
 * @param {Array<{role:string, content:string}>} history
 * @returns {Promise<import("./types.js").ReformulatedQuery>}
 */
async function reformulateQuery(userQuestion, history) {
  // Si pas d'historique, on fait une normalisation simple
  if (!history || history.length === 0) {
    return {
      rewrittenQuery: userQuestion.trim(),
      filters: {},
    };
  }

  // Prompt pour la reformulation
  const systemPrompt = `
    Tu es un expert en reformulation de requêtes pour un moteur de recherche documentaire.
    Ta tâche est de réécrire la dernière question de l'utilisateur pour qu'elle soit autonome et complète, en utilisant le contexte de la conversation précédente.
    Extrais également les filtres temporels (année, mois) et de type de document si présents.
    
    Format de sortie JSON attendu :
    {
      "rewrittenQuery": "string",
      "filters": {
        "year": "string (YYYY) ou null",
        "month": "string (MM) ou null",
        "type": "string (pv, convocation, rapport, deliberation, autre) ou null"
      }
    }
  `;

  const contextMessages = history
    .slice(-4)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const prompt = `Historique:\n${contextMessages}\n\nNouvelle question: ${userQuestion}\n\nReformulation JSON:`;

  try {
    const response = await gemini.generateContent({
      model: "gemini-1.5-flash", // Modèle rapide pour la reformulation
      systemInstruction: systemPrompt,
      userPrompt: prompt,
      generationConfig: { responseMimeType: "application/json" },
    });

    const text = response.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  } catch (error) {
    console.error("[DocumentSearch] Error reformulating query:", error);
    // Fallback: on retourne la question brute
    return { rewrittenQuery: userQuestion, filters: {} };
  }
}

/**
 * Récupère le contexte documentaire pertinent.
 * @param {string} userQuestion
 * @param {Array<{role:string, content:string}>} history
 * @param {string[]} [scope]
 * @returns {Promise<import("./types.js").DocContext>}
 */
export async function getDocContext(
  userQuestion,
  history = [],
  scope = DocumentSearchConfig.FILE_SEARCH_DEFAULT_STORES
) {
  try {
    // 1. Reformulation & Filtres
    const { rewrittenQuery, filters } = await reformulateQuery(userQuestion, history);
    const scopeKey = scope.sort().join(",");

    console.log(
      `[DocumentSearch] Query: "${userQuestion}" -> Rewritten: "${rewrittenQuery}"`,
      filters
    );

    // 2. Vérification Cache (Supabase)
    const cached = await cache.get(scopeKey, rewrittenQuery);
    if (cached) {
      console.log("[DocumentSearch] Cache HIT");
      return cached;
    }

    // 3. Recherche Gemini (Context Caching ou File Search)
    // On construit un prompt système qui inclut les filtres si nécessaire
    let searchSystemPrompt = `
      Tu es un moteur de recherche documentaire pour la ville de Corte.
      Utilise les outils de recherche pour trouver des extraits pertinents.
      Sélectionne au maximum ${DocumentSearchConfig.MAX_SNIPPETS} extraits.
      Retourne UNIQUEMENT du JSON strict suivant ce schéma :
      {
        "relevant": boolean,
        "query": "string",
        "snippets": [
          {
            "docId": "string",
            "title": "string",
            "sourceType": "string",
            "date": "string (YYYY-MM-DD)",
            "excerpt": "string"
          }
        ]
      }
    `;

    if (filters.year)
      searchSystemPrompt += `\nFILTRE: Cherche uniquement des documents de l'année ${filters.year}.`;
    if (filters.type)
      searchSystemPrompt += `\nFILTRE: Cherche uniquement des documents de type ${filters.type}.`;

    // Logique de choix du modèle et de la méthode (Cache vs File Search)
    const cacheId = DocumentSearchConfig.GEMINI_CACHE_ID;
    const searchModel = cacheId ? "gemini-1.5-flash-001" : "gemini-1.5-flash";

    const searchResponse = await gemini.generateContent({
      model: searchModel,
      systemInstruction: searchSystemPrompt,
      userPrompt: rewrittenQuery,
      cachedContent: cacheId,
      fileSearchStoreNames: scope, // Fallback si pas de cache
      generationConfig: { responseMimeType: "application/json" },
    });

    const responseText = searchResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error("Empty response from Gemini Search");

    /** @type {import("./types.js").DocContext} */
    const docContext = JSON.parse(responseText);

    // 4. Enrichissement (TODO: Mapper docId vers URL publique si possible)

    // 5. Mise en cache (Supabase)
    if (docContext.relevant) {
      await cache.set(scopeKey, rewrittenQuery, docContext);
    }

    return docContext;
  } catch (error) {
    console.error("[DocumentSearch] Critical error:", error);
    return {
      relevant: false,
      query: userQuestion,
      snippets: [],
    };
  }
}

/**
 * Formate le contexte pour l'injection dans le prompt système.
 * @param {import("./types.js").DocContext} docContext
 * @returns {string|null}
 */
export function formatDocContextForPrompt(docContext) {
  if (!docContext || !docContext.relevant || docContext.snippets.length === 0) {
    return null;
  }

  let output = "CONTEXTE DOCUMENTAIRE (Informations officielles) :\n\n";
  let charCount = output.length;

  for (const [index, snippet] of docContext.snippets.entries()) {
    const header = `${index + 1}) [${snippet.title || "Document sans titre"} - ${snippet.date || "Date inconnue"}]`;
    const body = `Extrait : « ${snippet.excerpt} »`;
    const block = `${header}\n${body}\n\n`;

    if (charCount + block.length > DocumentSearchConfig.MAX_CONTEXT_CHARS) {
      output += "... (suite tronquée pour respecter la limite de taille)\n";
      break;
    }

    output += block;
    charCount += block.length;
  }

  return output;
}
