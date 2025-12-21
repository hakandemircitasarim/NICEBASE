// Service Worker Registration
import i18n from '../i18n'
import { errorLoggingService } from '../services/errorLoggingService'

export function registerServiceWorker() {
  // Only register service worker in production
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // Dynamic import for PWA register
    // @ts-ignore - virtual module
    import('virtual:pwa-register').then(({ registerSW }: any) => {
      const updateSW = registerSW({
        onNeedRefresh() {
          // Show update notification
          const message = i18n.t('newVersionAvailable')
          
          if (confirm(message)) {
            updateSW(true)
          }
        },
        onOfflineReady() {
          // App is ready to work offline
          if (import.meta.env.DEV) {
            console.log('App ready to work offline')
          }
        },
        onRegistered(registration: any) {
          // Service worker registered successfully
          if (import.meta.env.DEV) {
            console.log('Service Worker registered:', registration)
          }
        },
        onRegisterError(error: any) {
          errorLoggingService.logError(
            error instanceof Error ? error : new Error('Service Worker registration error'),
            'error'
          )
        }
      })
    }).catch(() => {
      // PWA plugin not available - this is expected in some environments
      if (import.meta.env.DEV) {
        console.warn('PWA plugin not available')
      }
    })
  } else if (import.meta.env.DEV) {
    // Aggressively unregister any existing service workers in dev mode
    if ('serviceWorker' in navigator) {
      // Unregister all service workers
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister().then(success => {
            // Service worker unregistered in dev mode
            if (import.meta.env.DEV && success) {
              console.log('Service Worker unregistered in dev mode')
            }
          })
        })
      })
      
      // Clear all caches
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            caches.delete(cacheName).then(success => {
              // Cache cleared in dev mode
              if (import.meta.env.DEV && success) {
                console.log('Cache cleared:', cacheName)
              }
            })
          })
        })
      }
    }
  }
}

