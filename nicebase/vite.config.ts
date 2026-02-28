import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    host: true, // Listen on all addresses
    strictPort: false, // Try next available port if 5173 is busy
    open: false, // Don't auto-open browser
    hmr: {
      overlay: true, // Show errors in overlay
    },
  },
  optimizeDeps: {
    force: false, // Don't force re-optimization unless needed
    include: ['react', 'react-dom', 'react-router-dom', 'recharts'],
    exclude: ['@capacitor/browser'], // Exclude Capacitor plugins from optimization - they're only available in native builds
    esbuildOptions: {
      // Ensure React is treated as external dependency for recharts
      define: {
        global: 'globalThis',
      },
    },
  },
  clearScreen: false, // Keep terminal output visible
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'NICEBASE - Kişisel Duygusal Çapan',
        short_name: 'NICEBASE',
        description: 'Güzel anılarınızı kaydedin ve hatırlayın',
        theme_color: '#FF6B35',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /^https:\/\/api\.openai\.com\/.*/i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'openai-cache',
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              networkTimeoutSeconds: 3
            }
          }
        ]
      },
      devOptions: {
        enabled: false, // Disable service worker in dev mode to avoid connection issues
        type: 'module'
      }
    })
  ],
  build: {
    rollupOptions: {
      external: (id) => {
        // Mark Capacitor plugins as external - they're only available in native builds
        if (id.startsWith('@capacitor/')) {
          return true
        }
        return false
      },
      output: {
        manualChunks: (id) => {
          // React and core - include recharts with React to avoid multiple React instances
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('recharts')) {
            return 'react-vendor'
          }
          // UI libraries
          if (id.includes('framer-motion') || id.includes('lucide-react')) {
            return 'ui-vendor'
          }
          // AI
          if (id.includes('openai')) {
            return 'ai-vendor'
          }
          // Utils
          if (id.includes('date-fns') || id.includes('i18next') || id.includes('dexie')) {
            return 'utils-vendor'
          }
          // Supabase
          if (id.includes('@supabase')) {
            return 'supabase-vendor'
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false, // Disable sourcemaps in production for smaller bundle
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true
      }
    }
  }
})

