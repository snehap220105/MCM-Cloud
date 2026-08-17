import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/components/mcmcx', import.meta.url)),
      'react-router-dom': fileURLToPath(new URL('./src/components/mcmcx/router-shim.js', import.meta.url))
    }
  },
  server: {
    port: 5173,
    host: true
  }
})
