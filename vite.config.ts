import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Phone cameras (gate scanner) only work in a secure context, so LAN testing
// needs the dev server on HTTPS. Opt in with VITE_DEV_HTTPS=1.
const devHttps = ['1', 'true', 'yes'].includes((process.env.VITE_DEV_HTTPS ?? '').toLowerCase())
const backendTarget = process.env.VITE_DEV_BACKEND ?? 'http://localhost:4000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(devHttps ? [basicSsl()] : [])],
  appType: 'spa',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    host: true, // Listen on all network interfaces
    port: 5173,
    // Same-origin passthrough so an HTTPS page never has to call the plain-HTTP
    // backend directly (browsers block that as mixed content).
    proxy: {
      '/api': { target: backendTarget, changeOrigin: true },
      '/ws': { target: backendTarget, ws: true, changeOrigin: true },
    },
  },
})
