// Dynamic metadata initialization
// ⚠️ FICHIER GÉNÉRÉ AUTOMATIQUEMENT - NE PAS MODIFIER
// Généré par scripts/generate-meta-init.js lors du build
// Dernière génération: 2025-12-25T20:09:34.078Z

const CITY_NAME = "Corte";
const PARTY_NAME = "Petit Parti";
const SITE_URL = "https://lepp.fr";

// Mise à jour dynamique des métadonnées
const pageTitle = document.getElementById("page-title");
if (pageTitle) pageTitle.textContent = `Consultation Citoyenne - ${PARTY_NAME}`;

const pageDesc = document.getElementById("page-description");
if (pageDesc) {
  pageDesc.setAttribute(
    "content",
    `Plateforme de consultation citoyenne pour les élections municipales de ${CITY_NAME}, incluant un wiki collaboratif et un système de propositions citoyennes.`
  );
}

const ogTitle = document.getElementById("og-title");
if (ogTitle) ogTitle.setAttribute("content", `Consultation Citoyenne - ${PARTY_NAME}`);

const ogDesc = document.getElementById("og-description");
if (ogDesc) {
  ogDesc.setAttribute(
    "content",
    `Participez à la démocratie locale de ${CITY_NAME} avec notre plateforme de consultation citoyenne.`
  );
}

// Ensure an explicit og:image is set (Facebook requires explicit image meta)
const ogImageUrl = `${SITE_URL.replace(/\/$/, "")}/images/og-image.png`;
const ogEl = document.getElementById("og-image");
const twEl = document.getElementById("twitter-image");
if (ogEl) ogEl.setAttribute("content", ogImageUrl);
if (twEl) twEl.setAttribute("content", ogImageUrl);

// Set og:url explicitly for Facebook debugger
const ogUrlEl = document.getElementById("og-url");
if (ogUrlEl) ogUrlEl.setAttribute("content", SITE_URL.replace(/\/$/, ""));
