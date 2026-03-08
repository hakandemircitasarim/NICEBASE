import { isNative } from '../utils/capacitor'
import { memoryService } from './memoryService'
import { errorLoggingService } from './errorLoggingService'
import { App } from '@capacitor/app'

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

    // Periodic sync (best effort) while online
    // 5 minutes instead of 30 seconds — the old 30s interval was causing
    // massive Supabase egress (~2 GB/month) because syncAll does SELECT * FROM memories
    state.intervalId = window.setInterval(() => {
      if (!state.userId) return
      if (!navigator.onLine) return
      safeSyncNow(state.userId)
    }, 5 * 60 * 1000) // 5 minutes

    // Native resume sync
    // Note: App is imported statically to avoid the "thenable trap" — returning
    // a Capacitor proxy from an async function causes Promise.resolve() to call
    // plugin.then(), which triggers "App.then() is not implemented on android".
    if (isNative()) {
      App.addListener('appStateChange', (data: unknown) => {
        const { isActive } = data as { isActive: boolean }
        if (!isActive) return
        if (!state.userId) return
        safeSyncNow(state.userId)
      }).then((handle) => {
        state.resumeHandler = { remove: async () => { await handle.remove() } }
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




