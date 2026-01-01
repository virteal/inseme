export default {
  id: "group",
  name: "Gestion des Groupes",
  feature: "group",
  routes: [
    {
      path: "/groups",
      component: "./src/pages/GroupList.jsx",
      protected: true,
    },
    {
      path: "/groups/:id",
      component: "./src/pages/GroupDetail.jsx",
      protected: false,
    },
    {
      path: "/groups/:id/admin",
      component: "./src/pages/GroupAdmin.jsx",
      protected: true,
    },
  ],
  menuItems: [
    {
      id: "main-groups",
      label: "Groupes",
      path: "/groups",
      icon: "Users",
      position: "sidebar",
    },
  ],
  functions: {
    // À compléter plus tard si besoin de fonctions backend spécifiques
  },
  configSchema: {
    // Schéma de configuration si nécessaire
  }
};
