// centralised app version (single source of truth)
// hardcoded value is the canonical version; CI/CD can override by setting process.env.APP_VERSION at build time
export const APP_VERSION = import.meta.env.APP_VERSION ?? "1.5.21";
export const DEPLOY_DATE = import.meta.env.DEPLOY_DATE ?? "2025-12-21";

// Palette Bauhaus sombre harmonisée avec le thème CSS
// Voir src/index.css pour la correspondance exacte
export const COLORS = [
  "#B35A4A", // bauhaus-red
  "#3B4E6B", // bauhaus-blue
  "#C1A05A", // bauhaus-yellow
  "#D0C1AA", // bauhaus-white
  "#E93D3D", // bauhaus-red-fresh (accent)
  "#2D58B8", // bauhaus-blue-fresh (accent)
];
export const PRIMARY_COLOR = "#B35A4A"; // bauhaus-red
export const SECONDARY_COLOR = "#3B4E6B"; // bauhaus-blue
// COLORS[0]=primary (rouge brique), COLORS[1]=secondary (bleu grisâtre),
// COLORS[2]=jaune ocre, COLORS[3]=offwhite, COLORS[4]=accent rouge vif, COLORS[5]=accent bleu vif

export const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwyzcR0hiou7CiQTv35Jek8CWgHTBPptps65v76YqISjE64J5tC1PkPVOb_QaIdZ5Vc/exec";

// ============================================================================
// CONFIGURATION DYNAMIQUE (depuis vault ou env vars)
// ============================================================================
// Ces valeurs sont les FALLBACKS utilisés au chargement initial.
// Une fois loadInstanceConfig() appelé, utiliser getConfig() pour les valeurs à jour.

import { getConfig as _getConfig } from "./common/config/instanceConfig.client.js";

// Helper pour récupérer une config avec fallback sur la valeur initiale
const getConfig = (key, envValue) => {
  try {
    const val = _getConfig(key);
    // On considère que "" (chaîne vide) doit aussi déclencher le fallback
    return val !== null && val !== undefined && val !== "" ? val : envValue;
  } catch {
    return envValue;
  }
};

// Configuration générique (commune, mouvement, liste)
// Ces exports restent pour la rétrocompatibilité
// TODO: enlever tout ça
export const CITY_NAME = import.meta.env.VITE_CITY_NAME || "Corte";
export const CITY_TAGLINE = import.meta.env.VITE_CITY_TAGLINE || "CAPITALE";
export const MOVEMENT_NAME = import.meta.env.VITE_MOVEMENT_NAME || "Pertitellu";
export const PARTY_NAME = import.meta.env.VITE_PARTY_NAME || "Petit Parti";
export const HASHTAG = import.meta.env.VITE_HASHTAG || "#PERTITELLU";
export const BOT_NAME = import.meta.env.VITE_BOT_NAME || "Ophélia";
export const VOLUNTEER_URL =
  import.meta.env.VITE_VOLUNTEER_URL || "https://entraide-cortenaise.lovable.app/";

// Configuration type de communauté
export const COMMUNITY_NAME = import.meta.env.VITE_COMMUNITY_NAME || CITY_NAME;
export const COMMUNITY_TYPE = import.meta.env.VITE_COMMUNITY_TYPE || "municipality";

// Configuration fédération nationale (consultations)
export const NATIONAL_API_URL = import.meta.env.VITE_NATIONAL_API_URL || null;
export const NATIONAL_API_KEY = import.meta.env.VITE_NATIONAL_API_KEY || null;
export const COMMUNE_INSEE = import.meta.env.VITE_COMMUNE_INSEE || null;
export const REGION_NAME = import.meta.env.VITE_REGION_NAME || "Corse";
export const REGION_CODE = import.meta.env.VITE_REGION_CODE || "COR";

// Si NATIONAL_API_URL === SUPABASE_URL, on est le hub national (Corte)
export const IS_NATIONAL_HUB =
  NATIONAL_API_URL && NATIONAL_API_URL === import.meta.env.VITE_SUPABASE_URL;

// ============================================================================
// FONCTIONS DYNAMIQUES (préférées aux constantes statiques)
// ============================================================================

/**
 * Récupère les valeurs de configuration dynamiques depuis le vault
 * Utiliser ces fonctions plutôt que les constantes statiques quand possible
 */
export const getDynamicConfig = () => ({
  cityName: getConfig("community_name", CITY_NAME),
  cityTagline: getConfig("community_tagline", CITY_TAGLINE),
  movementName: getConfig("movement_name", MOVEMENT_NAME),
  partyName: getConfig("party_name", PARTY_NAME),
  hashtag: getConfig("hashtag", HASHTAG),
  botName: getConfig("bot_name", BOT_NAME),
  communityName: getConfig("community_name", COMMUNITY_NAME),
  communityType: getConfig("community_type", COMMUNITY_TYPE),
  regionName: getConfig("region_name", REGION_NAME),
  regionCode: getConfig("region_code", REGION_CODE),
  contactEmail: getConfig("contact_email", "jean_hugues_robert@yahoo.com"),
});

// Niveaux de portée des consultations
export const CONSULTATION_SCOPES = {
  local: {
    id: "local",
    label: "Locale",
    description: "Consultation à l'échelle de la commune",
    icon: "🏘️",
    color: "#4caf50",
  },
  regional: {
    id: "regional",
    label: "Régionale",
    description: "Consultation à l'échelle de la région",
    icon: "🗺️",
    color: "#ff9800",
  },
  national: {
    id: "national",
    label: "Nationale",
    description: "Consultation à l'échelle nationale",
    icon: "🇫🇷",
    color: "#2196f3",
  },
};

// Configuration des libellés par type de communauté
export const COMMUNITY_LABELS = {
  municipality: {
    name: "commune",
    governance: "conseil municipal",
    meeting: "séance du conseil",
    decision: "délibération",
    representative: "élu",
    citizens: "citoyens",
    transparency: "transparence municipale",
  },
  association: {
    name: "association",
    governance: "conseil d'administration",
    meeting: "assemblée générale",
    decision: "résolution",
    representative: "membre du bureau",
    citizens: "adhérents",
    transparency: "transparence associative",
  },
  school: {
    name: "établissement",
    governance: "conseil d'administration",
    meeting: "conseil d'école",
    decision: "décision",
    representative: "représentant",
    citizens: "communauté éducative",
    transparency: "transparence scolaire",
  },
  university: {
    name: "université",
    governance: "conseil d'administration",
    meeting: "séance du CA",
    decision: "délibération",
    representative: "élu",
    citizens: "communauté universitaire",
    transparency: "transparence universitaire",
    // Spécifique université
    council: "CA",
    student_council: "CVU",
    student_union: "BDE",
    staff: "personnels",
  },
  company: {
    name: "entreprise",
    governance: "comité de direction",
    meeting: "réunion d'équipe",
    decision: "décision",
    representative: "manager",
    citizens: "collaborateurs",
    transparency: "transparence d'entreprise",
  },
  cooperative: {
    name: "coopérative",
    governance: "conseil d'administration",
    meeting: "assemblée générale",
    decision: "résolution",
    representative: "sociétaire",
    citizens: "coopérateurs",
    transparency: "transparence coopérative",
  },
  online_community: {
    name: "communauté",
    governance: "modération",
    meeting: "assemblée virtuelle",
    decision: "décision collective",
    representative: "modérateur",
    citizens: "membres",
    transparency: "transparence communautaire",
  },
  neighborhood: {
    name: "quartier",
    governance: "comité de quartier",
    meeting: "réunion de quartier",
    decision: "décision",
    representative: "représentant",
    citizens: "habitants",
    transparency: "transparence de quartier",
  },
  copropriete: {
    name: "copropriété",
    governance: "conseil syndical",
    meeting: "assemblée générale",
    decision: "résolution",
    representative: "syndic",
    citizens: "copropriétaires",
    transparency: "transparence de la copropriété",
  },
  cse: {
    name: "CSE",
    governance: "bureau du CSE",
    meeting: "réunion plénière",
    decision: "délibération",
    representative: "élu du personnel",
    citizens: "salariés",
    transparency: "transparence sociale",
  },
  professional: {
    name: "organisation professionnelle",
    governance: "conseil professionnel",
    meeting: "assemblée professionnelle",
    decision: "résolution",
    representative: "représentant professionnel",
    citizens: "professionnels",
    transparency: "transparence professionnelle",
  },
  cultural: {
    name: "communauté culturelle",
    governance: "comité culturel",
    meeting: "assemblée culturelle",
    decision: "décision",
    representative: "représentant culturel",
    citizens: "membres",
    transparency: "transparence culturelle",
  },
  health: {
    name: "communauté de santé",
    governance: "comité de santé",
    meeting: "assemblée de santé",
    decision: "décision",
    representative: "représentant",
    citizens: "membres",
    transparency: "transparence sanitaire",
  },
};

// Fonction utilitaire pour obtenir les libellés de la communauté actuelle
export const getCommunityLabels = () => {
  const type = getConfig("community_type", COMMUNITY_TYPE);
  return COMMUNITY_LABELS[type] || COMMUNITY_LABELS.municipality;
};

// ============================================================================
// RE-EXPORT du module instanceConfig pour faciliter l'accès
// ============================================================================
export { _getConfig as getInstance };
