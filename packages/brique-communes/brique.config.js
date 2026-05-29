export default {
  id: "communes",
  status: "experimental", // post 2025 massive refactoring - aucune brique n'est "active" pour l'instant
  name: "Communes & Consultations",
  feature: "communes",
  description: "Brique pour la gestion des 36 000 communes et consultations nationales",

  // Routes exposées par la brique
  routes: [
    {
      path: "/consultation/barometre",
      component: "./src/pages/ConsultationDemocratieLocale",
      protected: false,
    },
  ],

  // Librairies internes (exposées via workspace context si besoin)
  libs: {
    consultations: "./src/lib/consultations.js",
  },
};
