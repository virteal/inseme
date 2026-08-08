import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Keep React single-instance across aliased workspace packages.
    // Do NOT dedupe react-router here: under pnpm, react-router lives next to
    // react-router-dom@7 and dedupe breaks Vite resolution of "react-router/dom".
    // Router context is unified by: (1) peerDeps on room/ui, (2) no nested RR in
    // packages/room, (3) useOpheliaChat no longer calls useNavigate().
    dedupe: ["react", "react-dom"],
    alias: {
      "@inseme/room": path.resolve(__dirname, "../../packages/room"),
      "@inseme/ui": path.resolve(__dirname, "../../packages/ui"),
      "@inseme/ui/style.css": path.resolve(__dirname, "../../packages/ui/src/index.css"),
      "@inseme/cop-host": path.resolve(__dirname, "../../packages/cop-host"),
      "@inseme/kudocracy": path.resolve(__dirname, "../../packages/kudocracy"),
      "@inseme/ophelia": path.resolve(__dirname, "../../packages/ophelia/index.js"),
      "@inseme/brique-kudocracy": path.resolve(__dirname, "../../packages/brique-kudocracy/src"),
      "@inseme/brique-communes": path.resolve(__dirname, "../../packages/brique-communes/src"),
      "@inseme/brique-tasks": path.resolve(__dirname, "../../packages/brique-tasks/src"),
      "@inseme/brique-map": path.resolve(__dirname, "../../packages/brique-map/src"),
      "@inseme/brique-actes": path.resolve(__dirname, "../../packages/brique-actes/src"),
      "@inseme/brique-group": path.resolve(__dirname, "../../packages/brique-group/src"),
      "@inseme/cop-core": path.resolve(__dirname, "../../packages/cop-core/dist/index.js"),
      "@inseme/cop-kernel": path.resolve(__dirname, "../../packages/cop-kernel/src/index.js"),
      "@inseme/brique-ophelia": path.resolve(__dirname, "../../packages/brique-ophelia/index.jsx"),
      // Workspace packages (room, ui, briques) import react-router-dom as a peer.
      // Vite resolves from the importing file's tree, so force the app's single v7 copy.
      // Do not also alias "react-router" — it lives next to rrd under pnpm and must stay there.
      "react-router-dom": path.resolve(__dirname, "node_modules/react-router-dom"),
    },
  },
  optimizeDeps: {
    include: ["react-router-dom"],
  },
  build: {
    sourcemap: true,
    minify: mode === "production" ? "esbuild" : false,
  },
  server: {
    watch: {
      usePolling: false,
      interval: 500,
    },
    hmr: {
      overlay: true,
    },
  },
  css: {
    preprocessorOptions: {
      css: {
        charset: false,
      },
    },
  },
}));
