import { Memory } from '../types'
import { db, SyncQueueItemV2 } from '../lib/db'
import { supabase } from '../lib/supabase'
import { memoryToSupabase, memoryFromSupabase, memoryUpdatesToSupabase } from '../lib/memoryMapper'
import { errorLoggingService } from './errorLoggingService'
import { withTimeout } from '../utils/timeout'
import { addToSyncQueue } from './syncQueueHelper'
import { photoStorageService } from './photoStorageService'
import { aiyaService } from './aiyaService'
import i18n from '../i18n'
import { generateUUID } from '../utils/uuid'

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || ''
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''
let warnedSupabaseMisconfig = false

function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

function isLocalUserId(userId: string): boolean {
  return userId.startsWith('local-') || userId.startsWith('local-user-')
}

function canQueueForSync(userId: string): boolean {
  // Only queue changes for cloud-intended users.
  return !isLocalUserId(userId) && hasSupabaseConfig()
}

let lastSessionCheckAt = 0
let lastSessionOk = false
async function hasAuthSessionCached(): Promise<boolean> {
  const now = Date.now()
  if (now - lastSessionCheckAt < 5000) return lastSessionOk
  lastSessionCheckAt = now
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), 3000)
    lastSessionOk = Boolean(data.session)
    return lastSessionOk
  } catch {
    lastSessionOk = false
    return false
  }
}

/**
 * Sync queue item type
 */
type LegacySyncQueueItem = {
  id: string
  type: 'create' | 'update' | 'delete'
  data: Memory | { id: string; updates: Partial<Memory> } | { id: string }
  timestamp: number
}

/**
 * Syncs a create operation from the sync queue
 * @param item - Sync queue item with type 'create'
 * @returns true if sync was successful, false otherwise
 */
async function syncCreateLegacy(item: LegacySyncQueueItem): Promise<boolean> {
  try {
    const result = await withTimeout(
      Promise.resolve(supabase.from('memories').insert(memoryToSupabase(item.data as Memory))),
      15000
    )
    const { error } = result as { error: unknown }
    if (!error) {
      await db.memories.update((item.data as Memory).id, { synced: true })
      await db.syncQueue.delete(item.id)
      return true
    }
    return false
  } catch (err) {
    errorLoggingService.logError(
      err instanceof Error ? err : new Error('Sync create error'),
      'error'
    )
    return false
  }
}

/**
 * Syncs an update operation from the sync queue
 * @param item - Sync queue item with type 'update'
 * @returns true if sync was successful, false otherwise
 */
async function syncUpdateLegacy(item: LegacySyncQueueItem): Promise<boolean> {
  try {
    const updateData = item.data as { id: string; updates: Partial<Memory> }
    const supabaseUpdates = memoryUpdatesToSupabase(updateData.updates)
    
    const result = await withTimeout(
      Promise.resolve(supabase.from('memories').update(supabaseUpdates).eq('id', updateData.id)),
      15000
    )
    const { error } = result as { error: unknown }
    if (!error) {
      await db.memories.update(updateData.id, { synced: true })
      await db.syncQueue.delete(item.id)
      return true
    }
    return false
  } catch (err) {
    errorLoggingService.logError(
      err instanceof Error ? err : new Error('Sync update error'),
      'error'
    )
    return false
  }
}

/**
 * Syncs a delete operation from the sync queue
 * @param item - Sync queue item with type 'delete'
 * @returns true if sync was successful, false otherwise
 */
async function syncDeleteLegacy(item: LegacySyncQueueItem): Promise<boolean> {
  try {
    const deleteData = item.data as { id: string }
    const result = await withTimeout(
      Promise.resolve(supabase.from('memories').delete().eq('id', deleteData.id)),
      15000
    )
    const { error } = result as { error: unknown }
    if (!error) {
      await db.syncQueue.delete(item.id)
      return true
    }
    return false
  } catch (err) {
    errorLoggingService.logError(
      err instanceof Error ? err : new Error('Sync delete error'),
      'error'
    )
    return false
  }
}

function opPriority(op: SyncQueueItemV2['op']): number {
  switch (op) {
    case 'create': return 0
    case 'photoUpload': return 1
    case 'update': return 2
    case 'delete': return 3
    default: return 9
  }
}

function backoffMs(attempt: number) {
  // Exponential backoff with cap: 2s, 4s, 8s... up to 5min
  const base = 2000
  const ms = base * Math.pow(2, Math.max(0, attempt))
  return Math.min(ms, 5 * 60 * 1000)
}

async function syncV2Item(item: SyncQueueItemV2): Promise<{ ok: boolean; error?: string }> {
  try {
    if (item.op === 'create') {
      const m = item.payload as Memory
      const remotePhotos = await photoStorageService.ensureRemotePhotoUrls({
        userId: m.userId,
        memoryId: m.id,
        photos: m.photos || [],
      })
      if (remotePhotos.join('|') !== (m.photos || []).join('|')) {
        await db.memories.update(m.id, { photos: remotePhotos })
        m.photos = remotePhotos
      }
      // Idempotent create: upsert by primary key (id)
      const result = await withTimeout(
        Promise.resolve(
          supabase.from('memories').upsert(memoryToSupabase(m), { onConflict: 'id' as any })
        ),
        15000
      )
      const { error } = result as { error: any }
      if (!error) {
        await db.memories.update(m.id, { synced: true })
        return { ok: true }
      }
      return { ok: false, error: error?.message || 'create failed' }
    }

    if (item.op === 'update') {
      const updateData = item.payload as { id: string; updates: Partial<Memory> }
      if (updateData.updates.photos) {
        // Upload local refs to storage and replace with URLs
        const local = await db.memories.get(updateData.id)
        const userId = local?.userId || item.userId
        const remotePhotos = await photoStorageService.ensureRemotePhotoUrls({
          userId,
          memoryId: updateData.id,
          photos: updateData.updates.photos,
        })
        updateData.updates.photos = remotePhotos
        await db.memories.update(updateData.id, { photos: remotePhotos })
      }
      const supabaseUpdates = memoryUpdatesToSupabase(updateData.updates)
      const result = await withTimeout(
        Promise.resolve(supabase.from('memories').update(supabaseUpdates).eq('id', updateData.id)),
        15000
      )
      const { error } = result as { error: any }
      if (!error) {
        await db.memories.update(updateData.id, { synced: true })
        return { ok: true }
      }
      return { ok: false, error: error?.message || 'update failed' }
    }

    if (item.op === 'delete') {
      const deleteData = item.payload as { id: string }
      const result = await withTimeout(
        Promise.resolve(supabase.from('memories').delete().eq('id', deleteData.id)),
        15000
      )
      const { error } = result as { error: any }
      if (!error) return { ok: true }
      return { ok: false, error: error?.message || 'delete failed' }
    }

    // photoUpload handled later (photo storage pipeline)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'sync error' }
  }
}

/**
 * Pulls memories from cloud and merges with local database
 * @param userId - User ID to fetch memories for
 */
async function pullFromCloud(userId: string): Promise<void> {
  try {
    if (!navigator.onLine) return
    if (isLocalUserId(userId)) return
    if (!hasSupabaseConfig()) return
    const hasSession = await hasAuthSessionCached()
    if (!hasSession) return

    const result = await withTimeout(
      Promise.resolve(supabase
        .from('memories')
        .select('*')
        .eq('user_id', userId)),
      15000
    ) as { data: unknown[] | null; error: unknown }
    
    const { data: cloudMemories } = result

    if (cloudMemories) {
      for (const memoryData of cloudMemories) {
        const memory = memoryFromSupabase(memoryData as Parameters<typeof memoryFromSupabase>[0])
        const local = await db.memories.get(memory.id)
        const cloudNewer = !local || new Date(memory.updatedAt) > new Date(local.updatedAt)

        // Conflict protection: never overwrite unsynced local edits.
        if (local && !local.synced && cloudNewer) {
          await db.memories.update(local.id, {
            conflict: true,
            conflictCloud: memory,
            conflictDetectedAt: new Date().toISOString(),
          })
          continue
        }

        if (!local || cloudNewer) {
          await db.memories.put(memory)
        }
      }
    }
  } catch (err) {
    errorLoggingService.logError(
      err instanceof Error ? err : new Error('Pull from cloud error'),
      'error',
      userId
    )
  }
}

export const memoryService = {
  async getSyncStatus(userId: string): Promise<{
    pending: number
    failed: number
    inProgress: number
    lastError: string | null
    conflicts: number
  }> {
    const items = await db.syncQueueV2.where('userId').equals(userId).toArray()
    const pending = items.filter((i) => i.status === 'pending').length
    const failed = items.filter((i) => i.status === 'failed').length
    const inProgress = items.filter((i) => i.status === 'in_progress').length
    const lastError = [...items]
      .filter((i) => i.lastError)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0]?.lastError || null

    const conflicts = await db.memories
      .where('userId')
      .equals(userId)
      .filter((m) => Boolean((m as any).conflict))
      .count()

    return { pending, failed, inProgress, lastError, conflicts }
  },

  // Get all memories (from IndexedDB first, then sync)
  async getAll(userId: string): Promise<Memory[]> {
    // Always read from local DB first (offline-first).
    // If we're a cloud user and have a valid session, also pull latest from Supabase so that
    // a second device can see the same data without requiring a manual "Sync" click.
    const localMemories = await db.memories.where('userId').equals(userId).toArray()

    // Pull from cloud only when it makes sense (avoid 401 spam & local-only users).
    try {
      if (
        navigator.onLine &&
        hasSupabaseConfig() &&
        !isLocalUserId(userId) &&
        (await hasAuthSessionCached())
      ) {
        await withTimeout(pullFromCloud(userId), 15000)
      }
    } catch {
      // Non-blocking: if pull fails, we still return local data.
    }

    const memories = await db.memories.where('userId').equals(userId).toArray()
    // If pull didn't change anything, this is effectively the same as localMemories.
    // Sorting is applied consistently either way.
    return memories.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  },

  // Get single memory
  async getById(id: string): Promise<Memory | undefined> {
    return await db.memories.get(id)
  },

  // Create memory
  async create(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'synced'>): Promise<Memory> {
    const newMemory: Memory = {
      ...memory,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: false,
    }

    // Save to IndexedDB
    await db.memories.add(newMemory)

    // Cloud sync:
    // - Never attempt Supabase for local/offline users (avoids 401 spam)
    // - Only attempt if Supabase is configured and we have an auth session
    if (!hasSupabaseConfig()) {
      if (!warnedSupabaseMisconfig) {
        warnedSupabaseMisconfig = true
        if (import.meta.env.DEV) {
          console.warn('Supabase configuration missing; skipping cloud sync.')
        }
      }
      return newMemory
    }

    if (isLocalUserId(newMemory.userId)) {
      return newMemory
    }

    if (!navigator.onLine) {
      if (canQueueForSync(newMemory.userId)) {
        await addToSyncQueue('create', newMemory)
      }
      return newMemory
    }

    const hasSession = await hasAuthSessionCached()
    if (!hasSession) {
      if (canQueueForSync(newMemory.userId)) {
        await addToSyncQueue('create', newMemory)
      }
      return newMemory
    }

    try {
      // Upload photos first (Storage), so DB row stores URLs only
      if (newMemory.photos?.length) {
        const remotePhotos = await photoStorageService.ensureRemotePhotoUrls({
          userId: newMemory.userId,
          memoryId: newMemory.id,
          photos: newMemory.photos,
        })
        newMemory.photos = remotePhotos
        await db.memories.update(newMemory.id, { photos: remotePhotos })
      }
      const result = await withTimeout(
        Promise.resolve(
          supabase.from('memories').upsert(memoryToSupabase(newMemory), { onConflict: 'id' as any })
        ),
        15000 // 15 seconds timeout
      )
      const { error } = result as { error: unknown }
      if (!error) {
        await db.memories.update(newMemory.id, { synced: true })
        newMemory.synced = true
      } else if (canQueueForSync(newMemory.userId)) {
        await addToSyncQueue('create', newMemory)
      }
    } catch (err) {
      if (canQueueForSync(newMemory.userId)) {
        await addToSyncQueue('create', newMemory)
      }
    }

    // Background AI classification (non-blocking)
    // Only run if category/lifeArea are still defaults
    if (
      (newMemory.category === 'uncategorized' || newMemory.lifeArea === 'uncategorized') &&
      newMemory.text.trim().length >= 10
    ) {
      aiyaService.classifyMemory(newMemory.text, i18n.language).then(async (result) => {
        if (!result) return
        try {
          const updates: Partial<Memory> = {}
          if (newMemory.category === 'uncategorized' && result.category) {
            updates.category = result.category
          }
          if (newMemory.lifeArea === 'uncategorized' && result.lifeArea) {
            updates.lifeArea = result.lifeArea
          }
          if (Object.keys(updates).length === 0) return

          // Update local DB
          await db.memories.update(newMemory.id, { ...updates, updatedAt: new Date().toISOString() })

          // Update cloud if possible
          if (hasSupabaseConfig() && !isLocalUserId(newMemory.userId) && navigator.onLine) {
            const hasSession = await hasAuthSessionCached()
            if (hasSession) {
              const supabaseUpdates = memoryUpdatesToSupabase(updates)
              await supabase.from('memories').update(supabaseUpdates).eq('id', newMemory.id)
            }
          }
        } catch (err) {
          // Silent fail - classification is best-effort
          if (import.meta.env.DEV) {
            console.warn('AI classification update failed:', err)
          }
        }
      }).catch(() => {
        // Silent fail
      })
    }

    return newMemory
  },

  // Update memory
  async update(id: string, updates: Partial<Memory>): Promise<void> {
    const memory = await db.memories.get(id)
    if (!memory) return

    const updated: Memory = {
      ...memory,
      ...updates,
      updatedAt: new Date().toISOString(),
      synced: false,
    }

    // If photos include local refs, upload first and replace with URLs.
    if (updates.photos && updates.photos.length > 0 && hasSupabaseConfig() && !isLocalUserId(memory.userId) && navigator.onLine) {
      try {
        const remotePhotos = await photoStorageService.ensureRemotePhotoUrls({
          userId: memory.userId,
          memoryId: id,
          photos: updates.photos,
        })
        updates.photos = remotePhotos
        updated.photos = remotePhotos
      } catch {
        // fall through; queue will retry later
      }
    }

    await db.memories.update(id, updated as Partial<Memory>)

    if (!hasSupabaseConfig() || isLocalUserId(updated.userId)) return

    if (!navigator.onLine) {
      if (canQueueForSync(updated.userId)) {
        await addToSyncQueue('update', { id, updates }, updated.userId)
      }
      return
    }

    const hasSession = await hasAuthSessionCached()
    if (!hasSession) {
      if (canQueueForSync(updated.userId)) {
        await addToSyncQueue('update', { id, updates }, updated.userId)
      }
      return
    }

    try {
      const supabaseUpdates = memoryUpdatesToSupabase(updates)
      
      const result = await withTimeout(
        Promise.resolve(supabase.from('memories').update(supabaseUpdates).eq('id', id)),
        15000 // 15 seconds timeout
      )
      const { error } = result as { error: unknown }
      if (!error) {
        await db.memories.update(id, { synced: true, ...updates })
      } else if (canQueueForSync(updated.userId)) {
        await addToSyncQueue('update', { id, updates }, updated.userId)
      }
    } catch (err) {
      if (canQueueForSync(updated.userId)) {
        await addToSyncQueue('update', { id, updates }, updated.userId)
      }
    }
  },

  // Delete memory
  async delete(id: string): Promise<void> {
    const memory = await db.memories.get(id)
    await db.memories.delete(id)

    if (!memory) return
    if (!hasSupabaseConfig() || isLocalUserId(memory.userId)) return

    if (!navigator.onLine) {
      if (canQueueForSync(memory.userId)) {
        await addToSyncQueue('delete', { id }, memory.userId)
      }
      return
    }

    const hasSession = await hasAuthSessionCached()
    if (!hasSession) {
      if (canQueueForSync(memory.userId)) {
        await addToSyncQueue('delete', { id }, memory.userId)
      }
      return
    }

    try {
      const result = await withTimeout(
        Promise.resolve(supabase.from('memories').delete().eq('id', id)),
        15000 // 15 seconds timeout
      )
      const { error: deleteError } = result as { error: unknown }
      if (deleteError && canQueueForSync(memory.userId)) {
        await addToSyncQueue('delete', { id }, memory.userId)
      }
    } catch (err) {
      if (canQueueForSync(memory.userId)) {
        await addToSyncQueue('delete', { id }, memory.userId)
      }
    }
  },

  /**
   * Syncs all pending changes from the sync queue and pulls latest from cloud
   * @param userId - User ID to sync memories for
   */
  async syncAll(userId: string): Promise<void> {
    if (!navigator.onLine) return
    if (!hasSupabaseConfig()) return
    if (isLocalUserId(userId)) return
    const hasSession = await hasAuthSessionCached()
    if (!hasSession) return

    // v2 queue (preferred)
    const now = Date.now()
    const v2Queue = await db.syncQueueV2
      .where('userId')
      .equals(userId)
      .filter((i) => (i.status === 'pending' || i.status === 'failed') && i.nextAttemptAt <= now)
      .toArray()

    v2Queue.sort((a, b) => {
      const pa = opPriority(a.op)
      const pb = opPriority(b.op)
      if (pa !== pb) return pa - pb
      return (a.timestamp || 0) - (b.timestamp || 0)
    })

    for (const item of v2Queue) {
      await db.syncQueueV2.update(item.id, { status: 'in_progress' })
      const res = await syncV2Item(item)
      if (res.ok) {
        await db.syncQueueV2.delete(item.id)
      } else {
        const nextAttempt = now + backoffMs(item.attemptCount + 1)
        await db.syncQueueV2.update(item.id, {
          status: 'failed',
          attemptCount: item.attemptCount + 1,
          nextAttemptAt: nextAttempt,
          lastError: res.error || 'sync failed',
        })
      }
    }

    // Legacy queue: best-effort drain for older installs.
    const legacyQueue = await db.syncQueue.toArray()
    for (const item of legacyQueue) {
      switch (item.type) {
        case 'create':
          await syncCreateLegacy(item as any)
          break
        case 'update':
          await syncUpdateLegacy(item as any)
          break
        case 'delete':
          await syncDeleteLegacy(item as any)
          break
      }
    }

    // Pull latest memories from cloud
    await pullFromCloud(userId)
  },
}

