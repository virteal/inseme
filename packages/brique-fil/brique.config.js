export default {
  id: "fil",
  name: "Le Fil",
  feature: "fil",
  routes: [
    {
      path: "/fil",
      component: "./src/pages/FilFeed.jsx",
      protected: false,
    },
    {
      path: "/fil/new",
      component: "./src/pages/FilSubmissionForm.jsx",
      protected: true,
    },
    {
      path: "/fil/:id",
      component: "./src/pages/FilItemDetail.jsx",
      protected: false,
    },
  ],
  menuItems: [
    {
      id: "main-fil",
      label: "Le Fil",
      path: "/fil",
      icon: "Lightning", // Lucide/Phosphor icon name
      position: "sidebar",
    },
  ],
  functions: {
     // Standard Node functions if needed
  },
  edgeFunctions: {
     "create-item": {
        handler: "./src/edge/create-item.js",
        path: "/api/fil/items" 
     },
     "vote": {
        handler: "./src/edge/vote.js",
        path: "/api/fil/vote"
     }
  },
  tools: [
    {
      type: "function",
      function: {
        name: "read_fil",
        description: "Obtenir les dernières actualités du Fil.",
        parameters: {
          type: "object",
          properties: {
             limit: { type: "number", description: "Nombre d'items (défaut: 5)." },
             period: { type: "string", enum: ["day", "week", "all"], description: "Période temporelle." }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "post_to_fil",
        description: "Publier un lien ou une info sur le Fil.",
        parameters: {
          type: "object",
          properties: {
             url: { type: "string", description: "L'URL à partager." },
             title: { type: "string", description: "Titre optionnel." },
             content: { type: "string", description: "Description optionnelle." }
          },
          required: ["url"]
        }
      }
    }
  ]

};
