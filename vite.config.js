import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'RoadTrip GPS Tracker',
        short_name: 'RoadTrip',
        description: 'Mobile-first GPS trip recording with live HUD overlay and real-time map visualization',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['navigation', 'travel', 'utilities'],
        shortcuts: [
          {
            name: 'Start Recording',
            short_name: 'Record',
            description: 'Start GPS trip recording',
            url: '/?action=record',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/demotiles\.maplibre\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'maplibre-tiles',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    // HTTPS for geolocation testing
    https: false, // Set to true for production testing
    host: true, // Allow external connections for mobile testing
    port: 3000,
    strictPort: true
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    cssCodeSplit: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor';
            }
            if (id.includes('maplibre-gl')) {
              return 'maplibre';
            }
            // Other node_modules go to vendor-misc
            return 'vendor-misc';
          }
          
          // Component chunks
          if (id.includes('/components/')) {
            if (id.includes('MapView')) {
              return 'map-components';
            }
            if (id.includes('LiveHUD') || id.includes('CameraView')) {
              return 'hud-components';
            }
            return 'ui-components';
          }
          
          // Hook chunks
          if (id.includes('/hooks/')) {
            return 'hooks';
          }
          
          // Context and utilities
          if (id.includes('/context/') || id.includes('/utils/')) {
            return 'core';
          }
        },
        // Optimize chunk naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      }
    },
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  }
})
