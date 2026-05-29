export default {
  id: "host",
  status: "experimental", // post 2025 massive refactoring - aucune brique n'est "active" pour l'instant
  name: "Host Runtime",
  feature: "host",
  routes: [],
  menuItems: [],
  tools: [],
  functions: {},
  edgeFunctions: {
    upload: {
      handler: "./src/edge/upload.js",
      path: "/api/upload",
    },
    robots: {
      handler: "./src/edge/robots.js",
      path: "/robots.txt",
    },
  },
  configSchema: {},
};
