// src/lib/meta.js
// Mise à jour dynamique des métadonnées (SEO, OpenGraph) à partir de la config de l'instance

import { getConfig } from "../common/config/instanceConfig.client.js";

/**
 * Met à jour les balises meta et le titre de la page à partir de la configuration actuelle
 */
export function updatePageMeta() {
  const partyName = getConfig("party_name", "Inseme");
  const cityName = getConfig("city_name", "Corte");
  const appUrl = getConfig("app_url", window.location.origin);
  const fbAppId = getConfig("facebook_app_id", "");

  console.log(`🏷️ Mise à jour des métas pour "${partyName}" (${cityName})`);

  // Titre
  document.title = `Consultation Citoyenne - ${partyName}`;

  // Description
  const description = `Plateforme de consultation citoyenne pour ${cityName}, incluant un wiki collaboratif et un système de propositions citoyennes.`;
  updateMeta("description", description);
  updateMeta("og:description", description, "property");

  // OpenGraph
  updateMeta("og:title", `Consultation Citoyenne - ${partyName}`, "property");
  updateMeta("og:url", appUrl.replace(/\/$/, ""), "property");
  updateMeta("fb:app_id", fbAppId, "property");

  // Images
  const ogImageUrl = `${appUrl.replace(/\/$/, "")}/images/og-image.png`;
  updateMeta("og:image", ogImageUrl, "property");
  updateMeta("twitter:image", ogImageUrl, "name");
}

/**
 * Utilitaire pour mettre à jour ou créer une balise meta
 */
function updateMeta(id, content, attr = "name") {
  if (!content) return;

  // Essayer par ID d'abord (recommandé pour nos tags personnalisés)
  const idMap = {
    description: "page-description",
    "og:description": "og-description",
    "og:title": "og-title",
    "og:url": "og-url",
    "fb:app_id": "fb-app-id",
    "og:image": "og-image",
    "twitter:image": "twitter-image",
  };

  const elementId = idMap[id];
  let el = elementId ? document.getElementById(elementId) : null;

  // Sinon par sélecteur d'attribut
  if (!el) {
    el = document.querySelector(`meta[${attr}="${id}"]`);
  }

  if (el) {
    el.setAttribute("content", content);
  } else {
    // Créer si n'existe pas
    const newMeta = document.createElement("meta");
    newMeta.setAttribute(attr, id);
    newMeta.setAttribute("content", content);
    if (elementId) newMeta.id = elementId;
    document.head.appendChild(newMeta);
  }
}
