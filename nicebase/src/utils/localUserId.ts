/**
 * Local user ID utility for offline usage
 * Creates and stores a local user ID in localStorage for users who haven't logged in
 */

import { db } from '../lib/db'
import { generateUUID } from './uuid'

const LOCAL_USER_ID_KEY = 'nicebase_local_user_id'
const MIGRATION_DONE_KEY = 'nicebase_local_migration_done'

/**
 * Gets or creates a local user ID for offline usage
 * @returns Local user ID string
 */
export function getLocalUserId(): string {
  if (typeof window === 'undefined') {
    return 'local-user-' + Date.now()
  }

  try {
    let localUserId = localStorage.getItem(LOCAL_USER_ID_KEY)

    if (!localUserId) {
      // Create a new local user ID
      localUserId = 'local-' + generateUUID()
      localStorage.setItem(LOCAL_USER_ID_KEY, localUserId)
    }

    return localUserId
  } catch (error) {
    // Fallback if localStorage is not available
    if (import.meta.env.DEV) {
      console.warn('Failed to access localStorage for local user ID:', error)
    }
    return 'local-user-' + Date.now()
  }
}

/**
 * Clears the local user ID (e.g., when user logs in)
 */
export function clearLocalUserId(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_USER_ID_KEY)
    } catch (error) {
      // Failed to clear local user ID - non-critical
      if (import.meta.env.DEV) {
        console.warn('Failed to clear local user ID:', error)
      }
    }
  }
}

/**
 * Returns the count of local (offline) memories that would be migrated.
 */
export async function countLocalMemories(): Promise<number> {
  try {
    const localMemories = await db.memories
      .filter((m) => m.userId.startsWith('local-') || m.userId.startsWith('local-user-'))
      .count()
    return localMemories
  } catch {
    return 0
  }
}

/**
 * Deletes all local (offline) memories permanently.
 */
export async function deleteLocalMemories(): Promise<void> {
  try {
    const localMemories = await db.memories
      .filter((m) => m.userId.startsWith('local-') || m.userId.startsWith('local-user-'))
      .toArray()
    for (const m of localMemories) {
      await db.memories.delete(m.id)
    }
    clearLocalUserId()
  } catch {
    // Best-effort
  }
}

/**
 * Migrates local (offline) memories to a cloud user after login.
 * Re-assigns the userId field on all memories that belong to any local-* user
 * and enqueues them for cloud sync.
 * Safe to call multiple times — skips if already migrated for this cloud user.
 */
export async function migrateLocalMemories(cloudUserId: string): Promise<number> {
  if (!cloudUserId || cloudUserId.startsWith('local')) return 0

  try {
    const doneKey = `${MIGRATION_DONE_KEY}_${cloudUserId}`
    if (localStorage.getItem(doneKey) === 'true') return 0

    // Find all memories belonging to any local user ID
    const localMemories = await db.memories
      .filter((m) => m.userId.startsWith('local-') || m.userId.startsWith('local-user-'))
      .toArray()

    if (localMemories.length === 0) {
      localStorage.setItem(doneKey, 'true')
      return 0
    }

    // Re-assign to cloud user and enqueue for sync + categorization
    const { addToSyncQueue } = await import('../services/syncQueueHelper')
    const { memoryService } = await import('../services/memoryService')
    const now = new Date().toISOString()
    for (const m of localMemories) {
      const updatedMemory = { ...m, userId: cloudUserId, synced: false, updatedAt: now }
      await db.memories.update(m.id, { userId: cloudUserId, synced: false, updatedAt: now })
      // Enqueue a 'create' operation so syncAll() picks it up
      await addToSyncQueue('create', updatedMemory, cloudUserId)
    }

    // Mark migration done for this cloud user
    localStorage.setItem(doneKey, 'true')

    // Clear old local user ID
    clearLocalUserId()

    // Trigger AI categorization for migrated uncategorized memories (fire-and-forget)
    for (const m of localMemories) {
      if (m.category === 'uncategorized' && m.text?.trim()) {
        memoryService._autoCategorize(m.id, m.text, cloudUserId).catch(() => {})
      }
    }

    return localMemories.length
  } catch {
    // Migration is best-effort
    return 0
  }
}
