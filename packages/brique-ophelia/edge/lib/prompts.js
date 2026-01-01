/**
 * packages/brique-ophelia/edge/lib/prompts.js
 * Assemblage dynamique du prompt système d'Ophélia.
 * Restauration de la parité avec rag_chatbotv3.js (fetch remote prompts, fallbacks).
 */

async function fetchPublicSystemPrompt(siteUrl) {
  if (!siteUrl) return null;
  const promptFiles = ["bob-system.md", "bob-db-capabilities.md"];
  const collected = [];

  for (const fileName of promptFiles) {
    const promptUrl = `${siteUrl}/prompts/${fileName}`;
    try {
      console.log(`[Prompt] ➜ fetching system prompt from ${promptUrl}`);
      const response = await fetch(promptUrl);
      if (!response.ok) continue;

      const content = await response.text();
      if (content.trim()) {
        collected.push(`<!-- ${fileName} -->\n${content.trim()}`);
      }
    } catch (error) {
      console.warn(`[SystemPrompt] Erreur fetch ${fileName}:`, error.message);
    }
  }

  return collected.length > 0 ? collected.join("\n\n---\n\n") : null;
}

export async function buildSystemPrompt(identity, role, context = {}, runtime = {}) {
  const { getConfig } = runtime;
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  let basePrompt = `📅 **Date actuelle :** ${dateStr}, ${timeStr}\n\n`;

  // 1. Identity & Role
  basePrompt += identity.toSystemMessage();
  basePrompt += `\n\n[MISSION ACTUELLE : ${role.name.toUpperCase()}]\n${role.missionPrompt}`;

  // 2. Dynamic Remote Prompt
  const siteUrl = getConfig?.("URL") || getConfig?.("DEPLOY_PRIME_URL");
  const remotePrompt = await fetchPublicSystemPrompt(siteUrl);
  if (remotePrompt) {
    basePrompt += `\n\n[INSTRUCTIONS DISTANTES]\n${remotePrompt}`;
  } else {
    // 3. Environment Fallbacks
    const city = getConfig?.("CITY_NAME") || "Corte";
    const movement = getConfig?.("MOVEMENT_NAME") || "Inseme";
    const bot = getConfig?.("BOT_NAME") || "Ophélia";
    basePrompt += `\n\n[CONTEXTE LOCAL DEFAULT]
- Tu es **${bot}**, l'assistant officiel de **${movement}** pour la commune de **${city}**.
- Réponds en français de manière factuelle et concise.
- Utilise les outils 'web_search' ou 'vector_search' pour les infos locales.`;
  }

  // 4. Room & Context Window
  let roomContext = "";
  if (context.room_settings) {
    const rs = context.room_settings;
    roomContext = `\n\n[CONTEXTE DE LA SALLE]\n- Nom : ${rs.name || "Inconnu"}
- Modèle : ${rs.governance_model || "agora"}
- Langue : ${rs.language || "fr"}
- Agenda : ${JSON.stringify(context.agenda || [])}`;
    
    if (context.speech_stats) {
        roomContext += `\n\n[STATISTIQUES DE PAROLE]\n${Object.entries(context.speech_stats).map(([id, time]) => `- ${id} : ${Math.round(time)}s`).join("\n")}`;
    }

    if (context.wiki_results && context.wiki_results.length > 0) {
        roomContext += `\n\n[CONNAISSANCES WIKI PERTINENTES]\n${context.wiki_results.map(w => `### ${w.title}\n${w.content}`).join("\n\n")}`;
    }

    if (context.consents) {
        roomContext += `\n\n[CONSENTEMENTS ET ENREGISTREMENT]\n${JSON.stringify(context.consents)}`;
    }
  }

  const instructions = `\n\n[CONSIGNES MÉTIER]
- Markdown obligatoire (titres, listes, liens).
- Cite tes sources.
- Si incertain, utilise 'vector_search' ou 'web_search'.
- Garde l'historique propre de tout bloc <Think> (traitement interne).
`;

  return `${basePrompt}${roomContext}${instructions}`.trim();
}
