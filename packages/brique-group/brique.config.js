export default {
  id: "group",
  status: "experimental", // post 2025 massive refactoring - aucune brique n'est "active" pour l'instant
  name: "Gestion des Groupes",
  feature: "group",
  routes: [
    {
      path: "/groups",
      component: "./src/pages/PageGroupList",
      protected: true,
    },
    {
      path: "/groups/:id",
      component: "./src/pages/PageGroupDetail",
      protected: false,
    },
    {
      path: "/groups/:id/admin",
      component: "./src/pages/GroupAdmin",
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
  },
};
