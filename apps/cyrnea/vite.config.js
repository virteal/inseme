import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@inseme/core": path.resolve(__dirname, "../../packages/inseme-core"),
      "@inseme/ui": path.resolve(__dirname, "../../packages/ui"),
      "@inseme/cop-host": path.resolve(__dirname, "../../packages/cop-host"),
      "@inseme/brique-cyrnea": path.resolve(__dirname, "../../packages/brique-cyrnea"),
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
