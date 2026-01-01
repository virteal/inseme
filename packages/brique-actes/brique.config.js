export default {
    id: "actes",
    name: "Actes Administratifs",
    feature: "administrative_acts",
    routes: [
      {
        path: "/actes",
        component: "./src/pages/ActesHome.jsx",
        protected: false,
      },
      {
        path: "/actes/dashboard",
        component: "./src/pages/ActesDashboard.jsx",
        protected: true,
      },
      {
        path: "/actes/list",
        component: "./src/pages/ActesList.jsx",
        protected: false,
      },
      {
        path: "/actes/new",
        component: "./src/pages/ActeForm.jsx",
        protected: true,
      },
      {
        path: "/actes/:id",
        component: "./src/pages/ActeDetail.jsx",
        protected: false,
      },
      {
        path: "/demandes",
        component: "./src/pages/DemandesList.jsx",
        protected: false,
      },
      {
        path: "/demandes/new",
        component: "./src/pages/DemandeForm.jsx",
        protected: true,
      },
      {
        path: "/demandes/:id",
        component: "./src/pages/DemandeDetail.jsx",
        protected: false,
      },
    ],
    menuItems: [
      {
        id: "main-actes",
        label: "Actes",
        path: "/actes",
        icon: "FileText",
        position: "header",
      },
      {
        id: "main-demandes",
        label: "Demandes",
        path: "/demandes",
        icon: "Clipboard",
        position: "header",
      },
    ],
    tools: [
        {
            type: "function",
            function: {
              name: "search_actes",
              description: "Rechercher des actes administratifs publiés.",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  year: { type: "number" },
                  type: { type: "string" }
                }
              }
            }
        },
        {
            type: "function",
            function: {
              name: "get_demande_status",
              description: "Obtenir le statut d'une demande administrative.",
              parameters: {
                type: "object",
                properties: {
                  demande_id: { type: "string" }
                },
                required: ["demande_id"]
              }
            }
        }
    ],
    configSchema: {
      municipality_name: { type: "string" },
      publication_delay_days: { type: "number" }
    }
  };
  
