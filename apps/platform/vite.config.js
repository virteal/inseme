import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ["remark-gfm"],
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
