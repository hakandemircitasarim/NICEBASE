import { isNative } from '../utils/capacitor'
import { memoryService } from './memoryService'
import type { WindowWithCapacitor } from '../types/capacitor'
import { errorLoggingService } from './errorLoggingService'

// Mutex to prevent concurrent sync operations
let syncInProgress = false

// Load Capacitor App - in native it's available via window, in web it's not
async function loadCapacitorApp() {
  if (!isNative()) return null
  
  try {
    if (typeof window !== 'undefined') {
      const plugins = (window as WindowWithCapacitor).CapacitorPlugins
      if (plugins?.App) {
        return plugins.App
      }
    }
    // Try dynamic import as fallback
    const module = await import('@capacitor/app')
    return module.App
  } catch {
    return null
  }
}

type SyncState = {
  userId: string | null
  started: boolean
  intervalId: number | null
  onlineHandler?: () => void
  resumeHandler?: { remove: () => Promise<void> } | null
}

const state: SyncState = {
  userId: null,
  started: false,
  intervalId: null,
  resumeHandler: null,
}

async function safeSyncNow(userId: string) {
  if (syncInProgress) return // Skip if another sync is already running
  syncInProgress = true
  try {
    await memoryService.syncAll(userId)
  } catch (err) {
    // Log sync errors but don't throw - sync is best-effort
    errorLoggingService.logError(
      err instanceof Error ? err : new Error('Sync error'),
      'warning',
      userId
    )
  } finally {
    syncInProgress = false
  }
}

export const memorySyncService = {
  start(userId: string) {
    if (!userId) return
    if (state.started && state.userId === userId) return

    // Stop previous instance if user switched
    if (state.started) {
      this.stop()
    }

    state.userId = userId
    state.started = true

    // Flush on (re)connect
    state.onlineHandler = () => {
      if (!state.userId) return
      safeSyncNow(state.userId)
    }
    window.addEventListener('online', state.onlineHandler)

    // Periodic sync (best effort) while online - every 30 seconds to reduce load
    state.intervalId = window.setInterval(() => {
      if (!state.userId) return
      if (!navigator.onLine) return
      safeSyncNow(state.userId)
    }, 30_000)

    // Native resume sync
    if (isNative()) {
      loadCapacitorApp().then((CapacitorApp) => {
        if (!CapacitorApp) return
        const listenerResult = (CapacitorApp.addListener as (event: string, callback: (data: unknown) => void) => { remove: () => void } | Promise<{ remove: () => Promise<void> }>)('appStateChange', (data: unknown) => {
          const { isActive } = data as { isActive: boolean }
          if (!isActive) return
          if (!state.userId) return
          safeSyncNow(state.userId)
        })
        
        // Handle both sync and async listener return types
        if (listenerResult instanceof Promise) {
          listenerResult.then((handler: { remove: () => Promise<void> } | { remove: () => void }) => {
            if (handler && 'remove' in handler) {
              const removeFn = handler.remove
              state.resumeHandler = typeof removeFn === 'function' 
                ? { remove: async () => { await removeFn() } }
                : null
            }
          }).catch(() => {
            // ignore
          })
        } else if (listenerResult && 'remove' in listenerResult) {
          const removeFn = listenerResult.remove
          state.resumeHandler = typeof removeFn === 'function' 
            ? { remove: async () => { await Promise.resolve(removeFn()) } }
            : null
        }
      }).catch(() => {
        // ignore
      })
    }

    // Initial attempt
    safeSyncNow(userId)
  },

  async syncNow() {
    if (!state.userId) return
    await safeSyncNow(state.userId)
  },

  stop() {
    if (!state.started) return

    if (state.onlineHandler) {
      window.removeEventListener('online', state.onlineHandler)
    }

    if (state.intervalId != null) {
      window.clearInterval(state.intervalId)
    }

    if (state.resumeHandler) {
      state.resumeHandler.remove().catch(() => {
        // ignore
      })
    }

    state.userId = null
    state.started = false
    state.intervalId = null
    state.onlineHandler = undefined
    state.resumeHandler = null
  },
}




