/**
 * packages/brique-cyrnea/brique.config.js
 * Configuration de la brique Bar Convivialité (Cyrnea)
 */

export default {
  id: "cyrnea",
  name: "Cyrnea",
  description: "Module de convivialité bar: jeux, musique, défis et interaction QR.",
  
  routes: [
    {
      path: "/bar",
      component: "./src/pages/BarmanDashboard.jsx",
      protected: true,
    },
    {
      path: "/q",
      component: "./src/pages/ClientMiniApp.jsx",
      protected: false,
    },
  ],

  libs: {
    "games": "./src/lib/gameManager.js",
    "vibe": "./src/lib/vibeMonitor.js",
    "music": "./src/lib/playlistManager.js"
  }
};
