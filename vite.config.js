import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

/**
 * Vite config — proxies /api calls to the local PHP server (Laragon default).
 * The target URL is read from .config.json so there is one place to change it.
 */
const appConfig = JSON.parse(readFileSync('.config.json', 'utf-8'))
const apiTarget = appConfig.api?.baseUrl ?? 'http://localhost'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
