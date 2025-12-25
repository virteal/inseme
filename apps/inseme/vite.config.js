import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  optimizeDeps: {
    include: ['remark-gfm']
  },
  build: {
    sourcemap: true,
    minify: mode === 'production' ? 'esbuild' : false,
  }
}))
