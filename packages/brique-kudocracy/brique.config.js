export default {
    id: "democracy", // exposed as 'democracy' or 'kudocracy'? Let's use 'democracy' for the ID/routes to be clean.
    name: "Gouvernance Citoyenne",
    feature: "democracy",
    routes: [
      {
        path: "/democracy",
        component: "./src/pages/DemocracyDashboard.jsx",
        protected: false,
      },
      {
        path: "/propositions",
        component: "./src/pages/PropositionList.jsx",
        protected: false,
      },
      {
        path: "/propositions/new",
        component: "./src/pages/PropositionCreate.jsx",
        protected: true,
      },
      {
        path: "/consultations",
        component: "./src/pages/ConsultationList.jsx",
        protected: false,
      },
    ],
    menuItems: [
      {
        id: "main-democracy",
        label: "Gouvernance",
        path: "/democracy",
        icon: "Scale", // Balance/Justice icon
        position: "header",
      },
    ],
    tools: [
        {
            type: "function",
            function: {
              name: "search_propositions",
              description: "Rechercher des propositions citoyennes soumis au vote.",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  status: { type: "string", enum: ["active", "closed", "draft"] }
                }
              }
            }
        }
    ],
    configSchema: {}
  };
  
