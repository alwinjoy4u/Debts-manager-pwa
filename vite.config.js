import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app from a sub-path (https://<user>.github.io/<repo>/);
// the deploy workflow passes that path in as BASE_PATH.
const base = (process.env.BASE_PATH || '').replace(/\/?$/, '/')

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png'],
      manifest: {
        name: 'Debts Manager',
        short_name: 'Debts',
        description: 'Keep track of who owes whom, offline.',
        id: base,
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f4f6f5',
        theme_color: '#00a86b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },        ],
      },
    }),
  ],
})
