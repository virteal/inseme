// packages/ophelia/websearch.js
/**
 * Logique partagée pour la recherche web via Brave Search API.
 * Utilisée par les Edge Functions de la Plateforme et d'Inseme.
 */

export async function performWebSearch(query, { apiKey, searchLang = "fr", country = "FR", count = 10 } = {}) {
  if (!apiKey) {
    console.warn("[WebSearch] ⚠️ API Key manquante");
    return `Recherche web non configurée pour: "${query}".`;
  }

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.append("q", query);
    url.searchParams.append("count", count.toString());
    url.searchParams.append("search_lang", searchLang);
    url.searchParams.append("country", country);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) throw new Error(`Brave API: ${response.status}`);

    const data = await response.json();
    let resultText = `🔍 Résultats pour "${query}":\n\n`;

    // Résultats web classiques
    if (data.web?.results?.length > 0) {
      data.web.results.slice(0, count).forEach((result, i) => {
        resultText += `📄 ${i + 1}. **${result.title}**\n`;
        resultText += `${result.description?.substring(0, 300) || "Pas de description"}...\n`;
        resultText += `🔗 [Source](${result.url})\n\n`;
      });
    } else {
      resultText += "Aucun résultat web trouvé.\n\n";
    }

    // Résultats locaux (POI, horaires, etc.)
    if (data.locations?.results?.length > 0) {
      resultText += `📍 **Infos locales :**\n`;
      data.locations.results.slice(0, 5).forEach((loc) => {
        resultText += `- **${loc.title}**\n`;
        if (loc.address) resultText += `  📍 ${loc.address}\n`;
        if (loc.phone) resultText += `  📞 ${loc.phone}\n`;
        if (loc.hours) resultText += `  ⏰ ${loc.hours}\n`;
      });
    }

    return resultText;
  } catch (error) {
    console.error("[WebSearch] ❌ Erreur:", error.message);
    return `⚠️ Erreur de recherche: ${error.message}. Accès Internet indisponible.`;
  }
}
