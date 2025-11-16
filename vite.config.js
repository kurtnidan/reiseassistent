import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 🔹 GitHub Pages ligger på /reiseassistent/
  base: '/reiseassistent/',

  // 🔹 Bygg inn i docs/-mappen (GitHub Pages leser herfra)
  build: {
    outDir: 'docs'
  },

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png'
      ],
      manifest: {
        name: 'Reiseassistent / Travel Assistant',
        short_name: 'Reise/Travel',
        start_url: '/reiseassistent/',
        scope: '/reiseassistent/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0ea5e9',
        icons: [
          // 🔹 uten / foran → blir /reiseassistent/icons/...
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // offline.html vil ligge på /reiseassistent/offline.html
        navigateFallback: '/reiseassistent/offline.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /wikipedia|wikimedia/.test(url.hostname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'wiki-cache' }
          },
          {
            urlPattern: ({ url }) => /open-meteo|exchangerate\.host/.test(url.hostname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'api-cache' }
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'img-cache' }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ]
})
