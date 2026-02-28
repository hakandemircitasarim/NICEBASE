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
 * Migrates local (offline) memories to a cloud user after login.
 * Re-assigns the userId field on all memories that belong to any local-* user.
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

    // Re-assign to cloud user
    for (const m of localMemories) {
      await db.memories.update(m.id, { userId: cloudUserId, synced: false })
    }

    // Mark migration done for this cloud user
    localStorage.setItem(doneKey, 'true')

    // Clear old local user ID
    clearLocalUserId()

    return localMemories.length
  } catch {
    // Migration is best-effort
    return 0
  }
}










