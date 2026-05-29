/**
 * @type {import('@inseme/cop-host').BriqueConfig}
 *
 * Auxilia — brique d'hospitalité numérique (data & power).
 *
 * Permet à une personne disposant d'une ressource critique (connexion mobile,
 * batterie, point de recharge) d'en partager temporairement une fraction avec
 * une personne proche qui en manque. Service d'hospitalité conforme à la
 * tradition d'accueil méditerranéenne, instanciation humaine du store-and-forward
 * des Energy Packet Networks (cadre FractaVolta).
 *
 * Spec complète : AUXILIA_SPEC.md à la racine du package.
 */
export default {
  // Identifiant unique de la brique (kebab-case, sans préfixe brique-).
  id: "auxilia",

  // Maturity level of this brique.
  // Context (May 2026): massive incomplete refactoring done end of 2025.
  // No brique is currently considered "active".
  // Possible values: "skeleton" | "experimental" | "active" | "deprecated"
  status: "skeleton", // Very early stage — mostly declarations and specs

  // Nom d'affichage administratif.
  name: "Auxilia — hospitalité data & power",

  // Clé du feature flag dans instance_config (feature_auxilia).
  feature: "auxilia",

  // --- FRONTEND ---

  routes: [
    {
      path: "/auxilia",
      component: "./src/pages/AuxiliaHome.jsx",
      protected: false,
    },
    {
      path: "/auxilia/need",
      component: "./src/pages/Need.jsx",
      protected: false,
    },
    {
      path: "/auxilia/give",
      component: "./src/pages/Give.jsx",
      protected: true,
    },
    {
      path: "/auxilia/hub/:hubId",
      component: "./src/pages/Hub.jsx",
      protected: false,
    },
    {
      path: "/auxilia/session/:sessionId",
      component: "./src/pages/Session.jsx",
      protected: true,
    },
    {
      path: "/auxilia/incident/:sessionId",
      component: "./src/pages/Incident.jsx",
      protected: true,
    },
    {
      path: "/auxilia/charte",
      component: "./src/pages/Charte.jsx",
      protected: false,
    },
    {
      path: "/auxilia/stats",
      component: "./src/pages/Stats.jsx",
      protected: false,
    },
  ],

  menuItems: [
    {
      id: "auxilia-home",
      label: "Auxilia",
      path: "/auxilia",
      // Phosphor icon. Alternatives possibles : Handshake, Plug, Lightning, Heart.
      icon: "HandHeart",
      position: "header",
    },
  ],

  // --- BACKEND (NETLIFY) ---

  // Functions Node.js classiques. Nommage compilé : /api/auxilia-<key>.
  functions: {
    "create-offer": {
      handler: "./src/functions/create-offer.js",
    },
    "create-request": {
      handler: "./src/functions/create-request.js",
    },
    "match-request": {
      handler: "./src/functions/match-request.js",
    },
    "accept-match": {
      handler: "./src/functions/accept-match.js",
    },
    "confirm-presence": {
      handler: "./src/functions/confirm-presence.js",
    },
    "start-session": {
      handler: "./src/functions/start-session.js",
    },
    "end-session": {
      handler: "./src/functions/end-session.js",
    },
    "report-incident": {
      handler: "./src/functions/report-incident.js",
    },
    "cleanup-expired": {
      handler: "./src/functions/cleanup-expired.js",
      // Tous les jours à 03:00 UTC, purge des offres expirées.
      schedule: "0 3 * * *",
    },
    "daily-stats": {
      handler: "./src/functions/daily-stats.js",
      // Tous les jours à 23:55 UTC, agrégation des stats publiques.
      schedule: "55 23 * * *",
    },
  },

  // Edge Functions (Deno) pour faible latence et streaming.
  edgeFunctions: {
    "hub-state": {
      path: "/auxilia/hub/:id/state",
      handler: "./src/edge/hub-state.js",
    },
    "session-events": {
      path: "/auxilia/session/:id/events",
      handler: "./src/edge/session-events.js",
    },
    "qr-resolver": {
      path: "/auxilia/qr/:token",
      handler: "./src/edge/qr-resolver.js",
    },
  },

  // --- CONFIGURATION ---

  // Paramètres attendus dans instance_config pour chaque instance qui active la brique.
  configSchema: {
    auxilia_default_hub_id: {
      type: "string",
      description:
        "UUID du hub par défaut de l'instance (typiquement la commune). " +
        "Si absent, l'utilisateur doit choisir un hub explicitement.",
    },
    auxilia_session_max_minutes: {
      type: "integer",
      default: 15,
      description: "Durée maximale par défaut d'une session de transfert.",
    },
    auxilia_offer_ttl_minutes: {
      type: "integer",
      default: 30,
      description: "Durée de vie par défaut d'une offre publiée avant expiration automatique.",
    },
    auxilia_min_battery_percent: {
      type: "integer",
      default: 30,
      description:
        "Seuil de batterie minimal après don pour un donneur power. " +
        "Protection contre l'épuisement du donneur.",
    },
    auxilia_languages_enabled: {
      type: "array",
      default: ["fr", "en", "it"],
      description: "Langues activées pour cette instance. Codes ISO 639-1.",
    },
    auxilia_sms_provider: {
      type: "string",
      default: "supabase",
      description:
        "Fournisseur OTP SMS. 'supabase' utilise l'auth native cop-host. " +
        "Alternatives possibles : twilio, messagebird, vonage, ovh.",
    },
    auxilia_panneau_pdf_url: {
      type: "string",
      description:
        "URL d'un PDF imprimable des panneaux physiques multilingues pour les hubs. " +
        "Optionnel.",
    },
  },
};
