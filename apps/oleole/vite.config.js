import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Olé Olé",
        short_name: "Olé Olé",
        description: "Présence territoriale en Corse — C.O.R.S.I.C.A. / John",
        theme_color: "#1a1a1a",
        background_color: "#fbf7f0",
        display: "standalone",
        start_url: "/",
        lang: "fr",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  envDir: "../../",
  server: {
    port: 5190,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@inseme/brique-oleole": path.resolve(__dirname, "../../packages/brique-oleole"),
    },
  },
  define: {
    "process.env": {},
  },
  build: {
    sourcemap: true,
    minify: mode === "production" ? "esbuild" : false,
  },
}));
