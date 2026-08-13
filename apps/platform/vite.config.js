import process from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isJhnProfileBuild = process.env.INSEME_DEPLOYMENT_PROFILE === "jhn";

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
      "@inseme/brique-oleole": path.resolve(__dirname, "../../packages/brique-oleole"),
      "@inseme/brique-actes": path.resolve(__dirname, "../../packages/brique-actes/src"),
      "@inseme/brique-group": path.resolve(__dirname, "../../packages/brique-group/src"),
      "@inseme/cop-core": path.resolve(__dirname, "../../packages/cop-core/dist/index.js"),
      // The browser must not bundle the full kernel: it exports Node-only
      // persistence, stdio and webhook modules. Platform UI uses the safe
      // accounting subset instead.
      "@inseme/cop-kernel": path.resolve(__dirname, "../../packages/cop-kernel/src/browser.js"),
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
    // JHN production deploys are intentional and source maps are not served to
    // users. Avoid the costly source-map pass on the large legacy bundle under
    // Windows/Node 24; non-JHN builds keep their existing diagnostics.
    sourcemap: !isJhnProfileBuild,
    // Vite/esbuild minification currently hangs or terminates with STATUS_STACK_BUFFER_OVERRUN
    // on the JHN profile's large legacy frontend bundle under Windows/Node 24. Preserve production
    // minification and source maps for every other profile until frontend minimization
    // makes this workaround unnecessary.
    minify: isJhnProfileBuild ? false : mode === "production" ? "esbuild" : false,
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
