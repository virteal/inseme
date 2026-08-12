export default {
  id: "oleole",
  status: "experimental",
  name: "Olé Olé — Presence / Place",
  feature: "oleole",
  routes: [
    {
      path: "/",
      component: "./src/pages/OleoleHome",
      protected: false,
    },
    {
      path: "/oleole",
      component: "./src/pages/OleoleHome",
      protected: false,
    },
  ],
  menuItems: [
    {
      id: "main-oleole",
      label: "Olé Olé",
      path: "/oleole",
      icon: "MapPin",
      position: "header",
    },
  ],
  tools: [
    {
      type: "function",
      handler: "./src/edge/tool-search-places.js",
      function: {
        name: "search_places",
        description:
          "Rechercher des lieux (Place) Olé Olé en Corse. IDs internes place:… avec provenance OSM/Overture.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Nom ou type de lieu" },
            limit: { type: "number", description: "Nombre max de résultats" },
          },
        },
      },
    },
    {
      type: "function",
      handler: "./src/edge/tool-get-presence.js",
      function: {
        name: "get_presence",
        description:
          "Obtenir les agrégats de présences contribuées (fenêtre now/tonight/tomorrow). Jamais de positions individuelles précises.",
        parameters: {
          type: "object",
          properties: {
            window: {
              type: "string",
              enum: ["now", "tonight", "tomorrow"],
              description: "Fenêtre temporelle",
            },
          },
        },
      },
    },
    {
      type: "function",
      handler: "./src/edge/tool-get-presence-map.js",
      function: {
        name: "get_presence_map",
        description: "GeoJSON des agrégats de présence pour la carte (même couche que l'UI).",
        parameters: {
          type: "object",
          properties: {
            window: { type: "string", enum: ["now", "tonight", "tomorrow"] },
          },
        },
      },
    },
    {
      type: "function",
      handler: "./src/edge/tool-declare-presence.js",
      function: {
        name: "declare_presence",
        description:
          "Proposer ou confirmer une PresenceClaim courante. Sans confirm=true, renvoie une proposition structurée.",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: "Énoncé en langage naturel" },
            place_ref: { type: "string" },
            place_name: { type: "string" },
            precision: { type: "string", enum: ["municipality", "area", "poi", "precise"] },
            valid_until: { type: "string" },
            discovery: { type: "boolean" },
            social: { type: "boolean" },
            oleole: { type: "boolean" },
            confirm: { type: "boolean" },
          },
        },
      },
    },
    {
      type: "function",
      handler: "./src/edge/tool-declare-future-presence.js",
      function: {
        name: "declare_future_presence",
        description: "Proposer/confirmer une présence future (modality intended).",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string" },
            place_ref: { type: "string" },
            place_name: { type: "string" },
            valid_from: { type: "string" },
            valid_until: { type: "string" },
            discovery: { type: "boolean" },
            social: { type: "boolean" },
            oleole: { type: "boolean" },
            confirm: { type: "boolean" },
          },
        },
      },
    },
    {
      type: "function",
      handler: "./src/edge/tool-set-presence-mode.js",
      function: {
        name: "set_presence_mode",
        description:
          "Changer le mode de contribution (off|manual|assisted|auto). Pause/révocation immédiate supportée.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["off", "manual", "assisted", "auto"] },
            precision: { type: "string", enum: ["municipality", "area", "poi", "precise"] },
            paused: { type: "boolean" },
            confirm: { type: "boolean" },
          },
        },
      },
    },
    {
      type: "function",
      handler: "./src/edge/tool-get-my-presence-state.js",
      function: {
        name: "get_my_presence_state",
        description: "État de présence et politique du sujet courant (claims actives, mode auto).",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
  ],
  configSchema: {
    map_default_lat: { type: "string" },
    map_default_lng: { type: "string" },
    map_default_zoom: { type: "number" },
  },
  edgeFunctions: {
    "presence-api": {
      handler: "./src/edge/presence-api.js",
      path: "/api/oleole/*",
    },
  },
};
