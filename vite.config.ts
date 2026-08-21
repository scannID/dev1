import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Phone cameras (gate scanner) only work in a secure context, so LAN testing
// needs the dev server on HTTPS. Opt in with VITE_DEV_HTTPS=1.
const devHttps = ['1', 'true', 'yes'].includes((process.env.VITE_DEV_HTTPS ?? '').toLowerCase())
const backendTarget = process.env.VITE_DEV_BACKEND ?? 'http://localhost:4000'

// https://vite.dev/config/
//
// ── SSR / SSG evaluation note ──────────────────────────────────────────────
// This is a client-side SPA. view-source shows an empty <div id="root">.
// Consequences:
//   • Googlebot can execute JavaScript and index the rendered content, but it
//     takes longer and social-link unfurlers (Slack, WhatsApp, iMessage) cannot.
//   • The <title>, description, and OG tags injected by usePageMeta are invisible
//     to bots that don't run JavaScript.
//
// To fix properly, migrate to SSR/SSG:
//   - Next.js App Router: static generateMetadata() exports, generateStaticParams()
//     for dynamic routes, ISR for QR/ticket pages. Minimal code change for routes
//     already using usePageMeta — just move values to generateMetadata().
//   - Vite SSR (vite-plugin-ssr / Vike): lower-friction migration from this Vite
//     setup; keeps the existing component structure.
//   - Remix: good fit if you want server loaders to co-locate with route components.
//
// Until migrated: the JSON-LD in index.html and the static og:image/og:title
// defaults cover the landing page for social sharing. Per-route titles are
// client-side only and won't appear in unfurler previews for deep links.
// ───────────────────────────────────────────────────────────────────────────
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(devHttps ? [basicSsl()] : [])],
  appType: 'spa',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    // Never expose source maps publicly. Set to 'hidden' here so Vite generates
    // .map files but does NOT add the sourceMappingURL comment to the bundle —
    // you can upload them to Sentry/Datadog out-of-band without serving them.
    // Change to false to skip generation entirely if you don't use error monitoring.
    sourcemap: 'hidden',
    // Raise the warning limit slightly — Kodte bundles Keycloak + Konva which are large.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Manual chunking keeps the critical path small and large infrequent libs
        // in separate chunks that are only downloaded when that route is used.
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-keycloak': ['keycloak-js'],
          'vendor-ui': ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          'vendor-canvas': ['konva', 'react-konva'],
          'vendor-qr': ['qrcode', 'jsqr', 'jsbarcode'],
        },
      },
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
