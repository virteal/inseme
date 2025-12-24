// netlify/lib/getOpheliaAnswer.js
// Fonction utilitaire pour obtenir une réponse complète d'Ophélia (non-stream)
import handler from "../../rag_chatbot.v3.js";

/**
 * Appelle le moteur RAG Ophélia et retourne la réponse complète (non streamée)
 * @param {Object} params
 * @param {string} params.question
 * @param {Array} [params.conversation_history]
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {string} [params.modelMode]
 * @returns {Promise<{answer: string, metadata: object, sources: Array}>}
 */
export async function getOpheliaAnswer({
  question,
  conversation_history = [],
  provider,
  model,
  modelMode,
}) {
  // Simule une requête POST compatible avec rag_chatbot_v2.js
  const req = {
    method: "POST",
    json: async () => ({
      question,
      conversation_history,
      provider,
      model,
      modelMode,
    }),
  };
  // Appel du handler (en mode local, pas via HTTP)
  const res = await handler(req);
  const text = await res.text();
  // On suppose que la réponse est en texte brut (stream), on prend tout
  // (À améliorer si besoin pour parser les métadonnées/sources)
  return {
    answer: text,
    metadata: {},
    sources: [],
  };
}
