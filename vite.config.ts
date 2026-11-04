import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// GitHub Pages serves the app from /schedule-planner/ (set by the deploy workflow); local dev stays at /.
const base = process.env.VITE_BASE ?? '/'

// Unit tests never reach Supabase, but the app's config gate needs both values; placeholders cover machines with
// no .env (CI). A local .env still wins, which the integration tests rely on.
const fileEnv = loadEnv('test', process.cwd(), 'VITE_')

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // The service worker updates itself; the task cache lives in IndexedDB so an update never touches data.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Daybook',
        short_name: 'Daybook',
        description: 'A calendar and task list that works offline and syncs to your account.',
        theme_color: '#254AA8',
        background_color: '#F5F7FA',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Fonts are bundled by Vite, so everything needed offline is precached.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    env: {
      VITE_SUPABASE_URL: fileEnv.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: fileEnv.VITE_SUPABASE_ANON_KEY || 'test-anon-key',
    },
  },
})
