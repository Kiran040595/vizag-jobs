import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Register from app code so we can check for updates when the PWA is reopened.
      injectRegister: false,
      includeAssets: [
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'og-image.png',
        'logo.png',
        'robots.txt',
        'sitemap.xml',
        'ads.txt',
      ],
      manifest: {
        name: 'Jobs in Vizag',
        short_name: 'Vizag Jobs',
        description: 'Find latest jobs in Vizag including IT jobs, freshers jobs, and non-IT jobs. Daily updates.',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-192x192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'icon-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        categories: ['business', 'productivity'],
        screenshots: [
          {
            src: 'screenshot1.png',
            sizes: '540x720',
            type: 'image/png'
          },
          {
            src: 'screenshot2.png',
            sizes: '540x720',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,gif,webp,woff,woff2,ttf,eot}'],
        globIgnores: ['**/assets/**/*.{jpg,jpeg}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        // Resume share + API routes must hit the network, not the SPA shell.
        navigateFallbackDenylist: [/^\/r\//, /^\/api\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        runtimeCaching: [
          {
            // Resume downloads: never cache; never fall back to the app shell.
            urlPattern: ({ url }) => url.pathname.startsWith('/r/') || url.pathname.startsWith('/api/r/'),
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            // Prefer fresh HTML shell after deploys; fall back to cache offline.
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' &&
              !url.pathname.startsWith('/r/') &&
              !url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /^https:\/\/(?:[a-z0-9-]+\.)?supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 3600
              }
            }
          },
          {
            urlPattern: /.*\.(?:jpg|jpeg|png|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 604800 // 7 days
              }
            }
          }
        ]
      }
    })
  ],
})
