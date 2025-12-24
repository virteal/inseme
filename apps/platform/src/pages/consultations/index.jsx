// src/pages/consultations/index.jsx
// Point d'entrée pour les consultations
// Exporte les consultations disponibles et les utilitaires de catalogue

import ConsultationQuasquara from "./ConsultationQuasquara";
import ConsultationDemocratieLocale from "./ConsultationDemocratieLocale";
import ConsultationsHome from "./ConsultationsHome";

// Page d'accueil des consultations (nouvelle route /)
export default ConsultationsHome;

// Export nommé pour accès direct
export { ConsultationQuasquara, ConsultationDemocratieLocale, ConsultationsHome };

/**
 * Structure de fédération des consultations :
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  NIVEAUX DE PORTÉE (scope)                                   │
 * ├─────────────────────────────────────────────────────────────┤
 * │  local     → Commune seule (ex: Quasquara à Corte)          │
 * │  regional  → Région (ex: Corse - toutes les communes)       │
 * │  national  → France entière (baromètre démocratie locale)   │
 * │  custom    → Réseau personnalisé (groupe de communes)       │
 * └─────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  MODES DE FONCTIONNEMENT                                     │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Hébergée   → Consultation créée sur cette instance         │
 * │  Importée   → Consultation venant d'une autre instance      │
 * │              (les réponses sont synchronisées vers source)  │
 * └─────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  RÔLE DES INSTANCES                                          │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Hub       → Agrège les réponses des autres communes        │
 * │  Nœud      → Participe au réseau, peut importer             │
 * │  Autonome  → Fonctionne seul (local uniquement)             │
 * └─────────────────────────────────────────────────────────────┘
 */

// Catalogue des consultations actives
// scope: "local" | "regional" | "national" | "custom"
// federated: true si les réponses sont synchronisées vers une base centrale
// imported: true si la consultation vient d'une autre instance
// petitions: liens optionnels vers des pétitions citoyennes associées
//   - local: pétition à l'échelle de la commune
//   - regional: pétition à l'échelle régionale
//   - national: pétition à l'échelle nationale
export const CONSULTATIONS = [
  {
    slug: "quasquara-2024",
    title: "L'affaire de Quasquara",
    description: "Consultation sur la croix de Quasquara à Corte",
    component: ConsultationQuasquara,
    scope: "local",
    federated: false,
    imported: false,
    shareEnabled: true,
    shareMessage: "Donnez votre avis sur la croix de Quasquara !",
    // Pétitions associées (optionnel)
    petitions: {
      // local: {
      //   url: "https://petition.corte.fr/quasquara",
      //   title: "Pétition pour le retrait de la croix",
      //   platform: "Mairie de Corte",
      // },
    },
  },
  {
    slug: "democratie-locale-2024",
    title: "Baromètre de la démocratie locale",
    description: "Comment fonctionne la démocratie dans votre commune ?",
    component: ConsultationDemocratieLocale,
    scope: "national",
    federated: true,
    imported: false, // Corte est le hub, donc hébergée
    shareEnabled: true,
    shareMessage: "Participez au baromètre national de la démocratie locale !",
    // Pétitions associées pour proposer des mesures d'amélioration
    petitions: {
      // Pétition locale pour améliorer la démocratie dans la commune
      // local: {
      //   url: "https://petition.corte.fr/democratie-participative",
      //   title: "Pour une démocratie participative à Corte",
      //   platform: "Plateforme citoyenne locale",
      // },
      // Pétition régionale
      // regional: {
      //   url: "https://petitions.corse.fr/democratie-regionale",
      //   title: "Renforcer la participation citoyenne en Corse",
      //   platform: "Région Corse",
      // },
      // Pétition nationale sur le Sénat ou l'Assemblée
      national: {
        url: "https://petitions.senat.fr/",
        title: "Pétitions citoyennes au Sénat",
        platform: "Sénat",
        icon: "🏛️",
      },
    },
  },
];

// ============================================================================
// TEMPLATES POUR FUTURS DÉVELOPPEMENTS
// ============================================================================

/**
 * Exemple: Consultation régionale Corse
 * (pourrait être créée par le hub régional et importée par chaque commune)
 */
// {
//   slug: "transport-corse-2025",
//   title: "Transports en Corse",
//   description: "Votre avis sur les transports insulaires",
//   scope: "regional",
//   federated: true,
//   imported: true, // Importée du hub régional
//   sourceInstance: "https://region-corse.survey.app",
//   shareEnabled: true,
// }

/**
 * Exemple: Réseau personnalisé de communes
 * (groupe de communes travaillant ensemble sur un projet)
 */
// {
//   slug: "projet-intercommunal-2025",
//   title: "Aménagement intercommunal",
//   description: "Consultation des communes du bassin de vie",
//   scope: "custom",
//   federated: true,
//   network: ["commune-a", "commune-b", "commune-c"],
//   shareEnabled: true,
// }

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Récupère une consultation par son slug depuis le catalogue local
 * @param {string} slug - Identifiant de la consultation
 * @returns {Object|undefined}
 */
export function getConsultationFromCatalog(slug) {
  return CONSULTATIONS.find((c) => c.slug === slug);
}

/**
 * Filtre les consultations par portée
 * @param {string} scope - "local" | "regional" | "national" | "custom"
 * @returns {Array}
 */
export function getConsultationsByScope(scope) {
  return CONSULTATIONS.filter((c) => c.scope === scope);
}

/**
 * Récupère les consultations fédérées (pour l'agrégation nationale/régionale)
 * @returns {Array}
 */
export function getFederatedConsultations() {
  return CONSULTATIONS.filter((c) => c.federated);
}

/**
 * Récupère les consultations importées
 * @returns {Array}
 */
export function getImportedConsultations() {
  return CONSULTATIONS.filter((c) => c.imported);
}

/**
 * Récupère les consultations hébergées localement
 * @returns {Array}
 */
export function getHostedConsultations() {
  return CONSULTATIONS.filter((c) => !c.imported);
}

/**
 * Vérifie si une consultation nécessite une synchronisation
 * @param {Object} consultation - La consultation
 * @returns {boolean}
 */
export function needsSync(consultation) {
  return consultation.federated || consultation.imported;
}

// Réexports depuis le module centralisé des pétitions
// Ceci permet de garder la compatibilité avec le code existant
export {
  extractPetitionsFromConsultation as getConsultationPetitions,
  hasPetitions,
} from "../../lib/petitions";

// Historique des consultations :
// - ConsultationQuasquara : Décembre 2024 - L'affaire de la croix de Quasquara (local)
// - ConsultationDemocratieLocale : Décembre 2024 - Baromètre national (fédéré)
