import { App as CapacitorApp } from '@capacitor/app'
import { isNative } from '../utils/capacitor'
import { memoryService } from './memoryService'

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
  try {
    await memoryService.syncAll(userId)
  } catch {
    // Swallow: sync is best-effort; errors are logged inside memoryService.
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
    state.intervalId = window.setInterval(() => {
      if (!state.userId) return
      if (!navigator.onLine) return
      safeSyncNow(state.userId)
    }, 60_000)

    // Native resume sync
    if (isNative()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return
        if (!state.userId) return
        safeSyncNow(state.userId)
      })
        .then((handler) => {
          state.resumeHandler = handler
        })
        .catch(() => {
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


