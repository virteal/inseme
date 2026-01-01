// src/lib/petitions.js
// Module centralisé pour la gestion des pétitions citoyennes
// Utilisé par : consultations, propositions, signalements

/**
 * Plateformes de pétitions recommandées
 */
export const PETITION_PLATFORMS = {
  "change.org": {
    name: "Change.org",
    icon: "✊",
    color: "#e94e4e",
    url: "https://www.change.org",
  },
  "mesopinions.com": {
    name: "MesOpinions",
    icon: "📝",
    color: "#3b82f6",
    url: "https://www.mesopinions.com",
  },
  "petitions.senat.fr": {
    name: "Sénat",
    icon: "🏛️",
    color: "#1e40af",
    url: "https://petitions.senat.fr",
  },
  "petitions.assemblee-nationale.fr": {
    name: "Assemblée nationale",
    icon: "🇫🇷",
    color: "#dc2626",
    url: "https://petitions.assemblee-nationale.fr",
  },
};

/**
 * Labels et icônes par scope de pétition
 */
export const PETITION_SCOPES = {
  local: {
    id: "local",
    label: "Pétition locale",
    shortLabel: "Locale",
    icon: "🏘️",
    color: "#4caf50",
  },
  regional: {
    id: "regional",
    label: "Pétition régionale",
    shortLabel: "Régionale",
    icon: "🗺️",
    color: "#ff9800",
  },
  national: {
    id: "national",
    label: "Pétition nationale",
    shortLabel: "Nationale",
    icon: "🏛️",
    color: "#2196f3",
  },
};

/**
 * Détecte la plateforme à partir d'une URL de pétition
 * @param {string} url - URL de la pétition
 * @returns {Object|null} Informations sur la plateforme
 */
export function detectPetitionPlatform(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");

    // Cherche une correspondance dans les plateformes connues
    for (const [domain, info] of Object.entries(PETITION_PLATFORMS)) {
      if (hostname === domain || hostname.endsWith("." + domain)) {
        return { domain, ...info };
      }
    }

    // Plateforme inconnue
    return {
      domain: hostname,
      name: hostname,
      icon: "📋",
      color: "#6b7280",
    };
  } catch {
    return null;
  }
}

/**
 * Valide une URL de pétition
 * Accepte les URLs des plateformes connues ou toute URL HTTPS valide
 * @param {string} url - L'URL à valider
 * @returns {{ valid: boolean, error?: string, warning?: string, platform?: Object }}
 */
export function validatePetitionUrl(url) {
  if (!url || !url.trim()) {
    return { valid: true }; // Champ optionnel - vide = valide
  }

  const trimmed = url.trim();

  // Validation du format URL
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "L'URL doit commencer par http:// ou https://" };
    }
  } catch {
    return { valid: false, error: "Format d'URL invalide" };
  }

  // Détection de la plateforme
  const platform = detectPetitionPlatform(trimmed);

  // Vérification si c'est une plateforme recommandée
  const recommendedDomains = ["change.org", "mesopinions.com"];
  const isRecommended =
    platform &&
    recommendedDomains.some(
      (domain) => platform.domain === domain || platform.domain.endsWith("." + domain)
    );

  if (!isRecommended) {
    return {
      valid: true,
      warning: "Conseil : Change.org et MesOpinions.com sont les plateformes recommandées",
      platform,
    };
  }

  return { valid: true, platform };
}

/**
 * Extrait les pétitions d'un objet consultation avec leur scope
 * Supporte deux formats :
 *   1. Format catalogue JS : { petitions: { local: { url, title }, ... } }
 *   2. Format base de données : { petition_local, petition_regional, petition_national, petitions_metadata }
 *
 * @param {Object} consultation - Objet consultation avec propriété petitions ou colonnes DB
 * @returns {Array<{ scope: string, url: string, title: string, platform?: string, icon?: string }>}
 */
export function extractPetitionsFromConsultation(consultation) {
  if (!consultation) return [];

  const petitions = [];
  const scopes = ["local", "regional", "national"];

  // Format 1 : Catalogue JS avec objet petitions
  if (consultation.petitions) {
    for (const scope of scopes) {
      const petition = consultation.petitions[scope];
      if (petition && petition.url) {
        const detectedPlatform = detectPetitionPlatform(petition.url);

        petitions.push({
          scope,
          url: petition.url,
          title: petition.title || "Signer la pétition",
          platform: petition.platform || detectedPlatform?.name,
          icon: petition.icon || detectedPlatform?.icon || PETITION_SCOPES[scope].icon,
          scopeInfo: PETITION_SCOPES[scope],
        });
      }
    }
    return petitions;
  }

  // Format 2 : Colonnes base de données (petition_local, petition_regional, petition_national)
  const metadata = consultation.petitions_metadata || {};

  for (const scope of scopes) {
    const url = consultation[`petition_${scope}`];
    if (url) {
      const scopeMetadata = metadata[scope] || {};
      const detectedPlatform = detectPetitionPlatform(url);

      petitions.push({
        scope,
        url,
        title: scopeMetadata.title || "Signer la pétition",
        platform: scopeMetadata.platform || detectedPlatform?.name,
        icon: scopeMetadata.icon || detectedPlatform?.icon || PETITION_SCOPES[scope].icon,
        scopeInfo: PETITION_SCOPES[scope],
      });
    }
  }

  return petitions;
}

/**
 * Vérifie si une consultation a des pétitions associées
 * Supporte les deux formats (catalogue JS et colonnes DB)
 * @param {Object} consultation - Objet consultation
 * @returns {boolean}
 */
export function hasPetitions(consultation) {
  if (!consultation) return false;

  // Format catalogue JS
  if (consultation.petitions) {
    return ["local", "regional", "national"].some((scope) => consultation.petitions[scope]?.url);
  }

  // Format colonnes DB
  return !!(
    consultation.petition_local ||
    consultation.petition_regional ||
    consultation.petition_national
  );
}

/**
 * Formate une URL de pétition pour l'affichage (domaine simplifié)
 * @param {string} url - URL complète
 * @returns {string} Domaine simplifié
 */
export function formatPetitionDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Liste des plateformes recommandées pour l'affichage dans les formulaires
 * @returns {Array<{ name: string, url: string }>}
 */
export function getRecommendedPlatforms() {
  return [
    { name: "Change.org", url: "https://www.change.org" },
    { name: "MesOpinions.com", url: "https://www.mesopinions.com" },
  ];
}
