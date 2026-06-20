import { db } from '../lib/db'
import { Memory } from '../types'
import { supabase, hasSupabaseConfig } from '../lib/supabase'
import { generateUUID } from '../utils/uuid'
import { addToSyncQueue } from './syncQueueHelper'
import { SyncQueueItemV2 } from '../lib/db'
import { photoStorageService, isLocalPhotoRef } from './photoStorageService'
import { errorLoggingService } from './errorLoggingService'

// Explicit column list for memory pulls — keep in one place.
const MEMORY_COLUMNS = 'id, user_id, text, category, categories, intensity, date, connections, life_area, is_core, photos, created_at, updated_at'

// Single source of truth for the allowed enum values, used to validate cloud
// data so DB/union drift cannot push a value the UI can't render.
const ALLOWED_CATEGORIES: Memory['category'][] = ['uncategorized', 'success', 'peace', 'fun', 'love', 'gratitude', 'inspiration', 'growth', 'adventure']
const ALLOWED_LIFE_AREAS: Memory['lifeArea'][] = ['uncategorized', 'personal', 'work', 'relationship', 'family', 'friends', 'hobby', 'travel', 'health']

function toCategory(value: unknown): Memory['category'] {
  return ALLOWED_CATEGORIES.includes(value as Memory['category']) ? (value as Memory['category']) : 'uncategorized'
}
function toLifeArea(value: unknown): Memory['lifeArea'] {
  return ALLOWED_LIFE_AREAS.includes(value as Memory['lifeArea']) ? (value as Memory['lifeArea']) : 'uncategorized'
}

// Upload any local (base64 / local:) photo refs to Storage and return the URL
// list. SAFE FALLBACK: if the upload fails (e.g. the storage bucket is missing
// in this environment), we keep the original base64 refs so the memory still
// syncs with its photos intact (current behaviour) instead of blocking the
// whole memory or silently dropping photos. The error is logged, not swallowed.
async function uploadLocalPhotos(userId: string, memoryId: string, photos: string[] | undefined): Promise<string[]> {
  const list = photos || []
  if (!list.some(isLocalPhotoRef)) return list
  try {
    return await photoStorageService.ensureRemotePhotoUrls({ userId, memoryId, photos: list })
  } catch (err) {
    // Non-fatal: fall back to pushing the base64 refs (keeps prior behaviour).
    if (import.meta.env.DEV) console.warn('[sync] Photo upload failed, keeping inline photos:', err)
    errorLoggingService.logError(err instanceof Error ? err : new Error(String(err)), 'warning', userId)
    return list
  }
}

// True when two memories differ in user-visible content (ignores sync metadata).
function memoriesContentDiffer(a: Memory, b: Memory): boolean {
  const norm = (m: Memory) => JSON.stringify({
    text: m.text,
    category: m.category,
    categories: m.categories || [],
    intensity: m.intensity,
    date: String(m.date).split('T')[0],
    connections: m.connections || [],
    lifeArea: m.lifeArea,
    isCore: m.isCore,
    photos: m.photos || [],
  })
  return norm(a) !== norm(b)
}

// Map Memory to Supabase format (defensive — never send null/undefined for NOT NULL columns)
function mapMemoryToSupabase(memory: Memory) {
  return {
    id: memory.id,
    user_id: memory.userId,
    text: memory.text || '',
    category: memory.category || 'uncategorized',
    categories: memory.categories || [memory.category || 'uncategorized'],
    intensity: memory.intensity ?? 5,
    date: (memory.date || new Date().toISOString()).split('T')[0],
    connections: memory.connections || [],
    life_area: memory.lifeArea || 'uncategorized',
    is_core: memory.isCore ?? false,
    photos: memory.photos || [],
    created_at: memory.createdAt || new Date().toISOString(),
    updated_at: memory.updatedAt || new Date().toISOString(),
  }
}

// Map Supabase format to Memory
function mapSupabaseToMemory(row: {
  id: string
  user_id: string
  text: string
  category: string
  categories?: string[]
  intensity: number
  date: string
  connections: string[]
  life_area: string
  is_core: boolean
  photos: string[]
  created_at: string
  updated_at: string
}): Memory {
  const validCategories = (row.categories && row.categories.length ? row.categories : [row.category])
    .map(toCategory)
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    category: toCategory(row.category),
    categories: validCategories as Memory['categories'],
    intensity: row.intensity,
    // Keep the calendar date as a bare YYYY-MM-DD string. The previous
    // new Date(row.date).toISOString() round-trip parsed a date-only value as
    // UTC midnight and could shift the day in negative-UTC timezones.
    date: String(row.date).split('T')[0],
    connections: row.connections || [],
    lifeArea: toLifeArea(row.life_area),
    isCore: row.is_core,
    photos: row.photos || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: true,
    // This local copy now reflects the cloud row at this updated_at.
    baseUpdatedAt: row.updated_at,
  }
}

// Extract updates from a possibly malformed sync payload.
// Old code sent { id, ...fields } instead of { id, updates: { ...fields } }.
// This helper handles BOTH formats gracefully.
function extractUpdatesFromPayload(payload: unknown): { id: string; updates: Partial<Memory> } | null {
  const p = payload as Record<string, unknown>
  if (!p || typeof p !== 'object' || !p.id) return null

  // Correct format: { id, updates: { ... } }
  if (p.updates && typeof p.updates === 'object') {
    return { id: p.id as string, updates: p.updates as Partial<Memory> }
  }

  // Legacy/malformed format: { id, category, lifeArea, ... }
  // Extract everything except 'id' as updates
  const { id, ...rest } = p
  if (Object.keys(rest).length === 0) return null
  return { id: id as string, updates: rest as Partial<Memory> }
}

export const memoryService = {
  async getAll(userId: string): Promise<Memory[]> {
    const memories = await db.memories.where('userId').equals(userId).toArray()
    return memories
  },

  async create(data: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'synced'>): Promise<Memory> {
    const now = new Date().toISOString()
    const memory: Memory = {
      ...data,
      id: generateUUID(),
      lifeArea: data.lifeArea || 'uncategorized',
      createdAt: now,
      updatedAt: now,
      synced: false,
    }

    // Save to local DB
    await db.memories.add(memory)

    // Add to sync queue
    if (hasSupabaseConfig) {
      await addToSyncQueue('create', memory, data.userId)
    }

    // Auto-categorize via Aiya if category is uncategorized
    if (memory.category === 'uncategorized' && memory.text.trim()) {
      memoryService._autoCategorize(memory.id, memory.text, data.userId).catch((err) => {
        if (import.meta.env.DEV) console.warn('[memoryService] Auto-categorize failed:', err)
      })
    }

    return memory
  },

  async update(id: string, updates: Partial<Omit<Memory, 'id' | 'userId' | 'createdAt'>>): Promise<Memory> {
    const existing = await db.memories.get(id)
    if (!existing) {
      throw new Error(`Memory with id ${id} not found`)
    }

    const newUpdatedAt = new Date().toISOString()
    const updated: Memory = {
      ...existing,
      ...updates,
      updatedAt: newUpdatedAt,
      synced: false,
    }

    // Update local DB
    await db.memories.put(updated)

    // Add to sync queue. Include the new updatedAt so the cloud's updated_at
    // column is bumped on every edit — without this, edits never advance the
    // incremental-sync watermark (cross-device updates stay invisible) and
    // optimistic-concurrency conflict detection has no version to compare.
    if (hasSupabaseConfig) {
      await addToSyncQueue('update', { id, updates: { ...updates, updatedAt: newUpdatedAt } }, existing.userId)
    }

    return updated
  },

  async _autoCategorize(memoryId: string, text: string, userId: string): Promise<void> {
    try {
      const { aiyaService } = await import('./aiyaService')
      const lang = typeof localStorage !== 'undefined' ? localStorage.getItem('i18nextLng') || 'tr' : 'tr'
      const result = await aiyaService.suggestCategoryAndLifeArea(text, lang)
      if (result && result.category !== 'uncategorized') {
        const updates: Partial<Memory> = {
          category: result.category,
          categories: [result.category],
          updatedAt: new Date().toISOString(),
        }
        if (result.lifeArea && result.lifeArea !== 'uncategorized') {
          updates.lifeArea = result.lifeArea
        }
        await db.memories.update(memoryId, updates)
        // Update sync queue payload if pending
        if (hasSupabaseConfig) {
          await addToSyncQueue('update', { id: memoryId, updates }, userId)
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[memoryService] Auto-categorize failed:', err)
    }
  },

  async delete(id: string): Promise<void> {
    const existing = await db.memories.get(id)
    if (!existing) {
      throw new Error(`Memory with id ${id} not found`)
    }

    // Delete from local DB
    await db.memories.delete(id)

    // Add to sync queue
    if (hasSupabaseConfig) {
      await addToSyncQueue('delete', { id }, existing.userId)
    }
  },

  async syncAll(userId: string): Promise<void> {
    if (!hasSupabaseConfig) return

    // --- Retry auto-categorization for uncategorized memories ---
    // Only attempt if Aiya session is available (avoids "no active session" spam)
    try {
      const { aiyaService } = await import('./aiyaService')
      const canUse = await aiyaService.canUseAiya()
      if (canUse) {
        const uncategorized = await db.memories
          .where('userId')
          .equals(userId)
          .and((m) => m.category === 'uncategorized' && !!m.text?.trim())
          .toArray()

        for (const memory of uncategorized.slice(0, 2)) {
          // Don't retry if we already tried recently (check updatedAt within last 30 min)
          const updatedAgo = Date.now() - new Date(memory.updatedAt).getTime()
          if (updatedAgo < 30 * 60 * 1000) continue

          await memoryService._autoCategorize(memory.id, memory.text, userId)
        }
      }
    } catch {
      // Non-critical, continue with sync
    }

    // --- Cleanup pass: fix stuck in_progress items (crashed mid-sync) ---
    const stuckItems = await db.syncQueueV2
      .where('userId')
      .equals(userId)
      .and((item) => item.status === 'in_progress')
      .toArray()
    for (const stuck of stuckItems) {
      await db.syncQueueV2.update(stuck.id, {
        status: 'pending',
        nextAttemptAt: Date.now(),
      })
    }

    // Get pending sync items for this user.
    // Drain in timestamp order so an op never runs before the op it logically
    // depends on (e.g. a delete before its create) — the queue id is a random
    // UUID and gives no ordering on its own.
    const pendingItems = (await db.syncQueueV2
      .where('userId')
      .equals(userId)
      .and((item) => item.status === 'pending' || item.status === 'failed')
      .filter((item) => item.nextAttemptAt <= Date.now())
      .toArray())
      .sort((a, b) => a.timestamp - b.timestamp)

    if (pendingItems.length === 0 && !navigator.onLine) return

    for (const item of pendingItems) {
      // Give up after 10 attempts — mark 'abandoned' (NOT 'done') so the sync
      // status correctly reports it as never backed up.
      if (item.attemptCount >= 10) {
        if (import.meta.env.DEV) console.warn(`[sync] Giving up on item ${item.id} after ${item.attemptCount} attempts: ${item.lastError}`)
        await db.syncQueueV2.update(item.id, { status: 'abandoned', lastError: `Gave up after ${item.attemptCount} attempts` })
        continue
      }

      try {
        // Mark as in progress
        await db.syncQueueV2.update(item.id, { status: 'in_progress' })

        if (item.op === 'create') {
          const memory = item.payload as Memory
          // Upload inline (base64/local:) photos to Storage first; swap the
          // refs for URLs and persist them back so a re-sync doesn't re-upload.
          const remotePhotos = await uploadLocalPhotos(memory.userId, memory.id, memory.photos)
          if (memory.photos?.some(isLocalPhotoRef) && !remotePhotos.some(isLocalPhotoRef)) {
            await db.memories.update(memory.id, { photos: remotePhotos })
          }
          const supabaseData = mapMemoryToSupabase({ ...memory, photos: remotePhotos })
          // Use upsert instead of insert — idempotent, handles retries gracefully
          const { error } = await supabase.from('memories').upsert(supabaseData, { onConflict: 'id' })
          if (error) throw error

          // Cloud now matches local at this updated_at — record the base.
          await db.memories.update(memory.id, { synced: true, baseUpdatedAt: supabaseData.updated_at })
        } else if (item.op === 'update') {
          const extracted = extractUpdatesFromPayload(item.payload)
          if (!extracted) {
            // Corrupt payload — can't recover. Mark 'abandoned' (not 'done').
            if (import.meta.env.DEV) console.warn('[sync] Corrupt update payload, skipping:', item.payload)
            await db.syncQueueV2.update(item.id, { status: 'abandoned', lastError: 'Corrupt payload — skipped' })
            continue
          }

          const { id, updates } = extracted
          const existingLocal = await db.memories.get(id)

          // Upload inline photos referenced by this update before pushing.
          if (updates.photos?.some(isLocalPhotoRef)) {
            const remotePhotos = await uploadLocalPhotos(existingLocal?.userId || item.userId, id, updates.photos)
            if (!remotePhotos.some(isLocalPhotoRef)) {
              updates.photos = remotePhotos
              await db.memories.update(id, { photos: remotePhotos })
            }
          }

          const supabaseUpdates: Record<string, unknown> = {}

          if (updates.text !== undefined) supabaseUpdates.text = updates.text
          if (updates.category !== undefined) supabaseUpdates.category = updates.category
          if (updates.categories !== undefined) supabaseUpdates.categories = updates.categories
          if (updates.intensity !== undefined) supabaseUpdates.intensity = updates.intensity
          if (updates.date !== undefined) supabaseUpdates.date = String(updates.date).split('T')[0]
          if (updates.connections !== undefined) supabaseUpdates.connections = updates.connections
          if (updates.lifeArea !== undefined) supabaseUpdates.life_area = updates.lifeArea
          if (updates.isCore !== undefined) supabaseUpdates.is_core = updates.isCore
          if (updates.photos !== undefined) supabaseUpdates.photos = updates.photos
          if (updates.updatedAt !== undefined) supabaseUpdates.updated_at = updates.updatedAt

          // Skip if no actual updates to send
          if (Object.keys(supabaseUpdates).length === 0) {
            await db.syncQueueV2.update(item.id, { status: 'done', lastError: null })
            continue
          }

          const base = existingLocal?.baseUpdatedAt
          if (base) {
            // Optimistic concurrency: only overwrite the cloud row if it still
            // matches the version this edit was based on.
            const { data: updRows, error } = await supabase
              .from('memories')
              .update(supabaseUpdates)
              .eq('id', id)
              .eq('updated_at', base)
              .select('id, updated_at')
            if (error) throw error

            if (!updRows || updRows.length === 0) {
              // Our base no longer matches — the cloud changed under us, or the
              // row was deleted remotely. Do NOT overwrite.
              const { data: cloudRow, error: selErr } = await supabase
                .from('memories')
                .select(MEMORY_COLUMNS)
                .eq('id', id)
                .maybeSingle()
              if (selErr) throw selErr

              if (cloudRow) {
                const cloudMemory = mapSupabaseToMemory(cloudRow)
                if (existingLocal && !existingLocal.conflict && memoriesContentDiffer(existingLocal, cloudMemory)) {
                  // Real divergence — flag for the conflict-resolution UI.
                  await db.memories.update(id, {
                    conflict: true,
                    conflictCloud: cloudMemory,
                    conflictDetectedAt: new Date().toISOString(),
                  })
                  if (import.meta.env.DEV) console.warn(`[sync] Conflict detected for memory ${id}`)
                } else {
                  // Same content (or already flagged) — adopt the cloud base.
                  await db.memories.update(id, { synced: true, baseUpdatedAt: cloudRow.updated_at })
                }
              } else if (import.meta.env.DEV) {
                console.warn(`[sync] Update target ${id} missing in cloud (deleted remotely?)`)
              }
            } else {
              // Success — record the new base.
              const newBase = (supabaseUpdates.updated_at as string) ?? updRows[0].updated_at
              await db.memories.update(id, { synced: true, baseUpdatedAt: newBase })
            }
          } else {
            // Legacy row with no known base — plain update (prior behaviour),
            // then seed the base so future edits get conflict detection.
            const { data: updRows, error } = await supabase
              .from('memories')
              .update(supabaseUpdates)
              .eq('id', id)
              .select('updated_at')
            if (error) throw error
            const newBase = (supabaseUpdates.updated_at as string) ?? updRows?.[0]?.updated_at
            await db.memories.update(id, { synced: true, baseUpdatedAt: newBase })
          }
        } else if (item.op === 'delete') {
          const { id } = item.payload as { id: string }
          const { error } = await supabase
            .from('memories')
            .delete()
            .eq('id', id)
          if (error) throw error
        }

        // Mark as done
        await db.syncQueueV2.update(item.id, {
          status: 'done',
          lastError: null,
        })
      } catch (error) {
        // Mark as failed and schedule retry
        const attemptCount = item.attemptCount + 1
        const backoffMs = Math.min(1000 * Math.pow(2, attemptCount), 300000) // Max 5 minutes
        const errorMsg = error instanceof Error ? error.message : String(error)
        if (import.meta.env.DEV) console.warn(`[sync] Item ${item.id} (${item.op}) failed attempt ${attemptCount}:`, errorMsg)
        await db.syncQueueV2.update(item.id, {
          status: 'failed',
          attemptCount,
          nextAttemptAt: Date.now() + backoffMs,
          lastError: errorMsg,
        })
      }
    }

    // Also pull from Supabase to sync any remote changes
    // Use INCREMENTAL sync: only fetch memories updated since last pull
    // This avoids SELECT * on every poll, saving massive egress bandwidth
    try {
      const LAST_SYNC_KEY = `memory_last_sync_${userId}`
      let lastSyncedAt: string | null = null
      try {
        lastSyncedAt = localStorage.getItem(LAST_SYNC_KEY)
      } catch { /* ignore */ }

      // Build query — only fetch changed memories since last sync
      // Use explicit columns instead of SELECT * to minimize egress
      let query = supabase
        .from('memories')
        .select(MEMORY_COLUMNS)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (lastSyncedAt) {
        query = query.gt('updated_at', lastSyncedAt)
      }

      const { data, error } = await query

      if (error) throw error

      if (data && data.length > 0) {
        for (const row of data) {
          const memory = mapSupabaseToMemory(row)
          const existing = await db.memories.get(memory.id)

          if (!existing) {
            // New memory from cloud
            await db.memories.add(memory)
          } else {
            // Update if cloud version is newer
            const cloudTime = new Date(memory.updatedAt).getTime()
            const localTime = new Date(existing.updatedAt).getTime()
            if (cloudTime > localTime && existing.synced) {
              await db.memories.put(memory)
            }
          }
        }

        // Advance the watermark to the max updated_at in this batch (the query
        // is ordered desc, so data[0] is the newest). Using the server's own
        // value keeps it in the same clock-space as the values it is compared
        // against. When the batch is EMPTY we intentionally leave the watermark
        // unchanged — otherwise every no-change poll would force a full
        // re-pull.
        try {
          const newest = (data[0] as { updated_at?: string }).updated_at
          if (newest) localStorage.setItem(LAST_SYNC_KEY, newest)
        } catch { /* ignore */ }
      }

      // Full reconciliation (check for remote deletions) once per day max.
      // Uses localStorage with a timestamp so it persists across sessions
      // but still runs daily to catch remote deletions.
      const FULL_SYNC_KEY = `memory_full_sync_at_${userId}`
      let shouldRunFullSync = false
      try {
        const lastFullSync = localStorage.getItem(FULL_SYNC_KEY)
        if (!lastFullSync) {
          shouldRunFullSync = true
        } else {
          const elapsed = Date.now() - parseInt(lastFullSync, 10)
          shouldRunFullSync = elapsed > 24 * 60 * 60 * 1000 // 24 hours
        }
      } catch { shouldRunFullSync = true }

      if (shouldRunFullSync) {
        try {
          const { data: allRemote, error: fullErr } = await supabase
            .from('memories')
            .select('id')
            .eq('user_id', userId)

          if (!fullErr && allRemote) {
            const remoteIds = new Set(allRemote.map((row: { id: string }) => row.id))
            const localMemories = await db.memories.where('userId').equals(userId).toArray()
            for (const local of localMemories) {
              // Never auto-delete a memory that is unsynced or has an unresolved
              // conflict (it may hold local-only edits).
              if (local.synced && !local.conflict && !remoteIds.has(local.id)) {
                // Check there's no pending sync for this memory (abandoned items
                // count too — keep the local copy if its upload never landed).
                const pendingSync = await db.syncQueueV2
                  .where('entityId')
                  .equals(local.id)
                  .and((item) => item.status !== 'done')
                  .first()
                if (pendingSync) continue

                // Re-verify the row is REALLY gone before deleting. The bulk id
                // snapshot can miss a memory that was just created on another
                // device and not yet replicated into this query's view.
                const { data: stillThere } = await supabase
                  .from('memories')
                  .select('id')
                  .eq('id', local.id)
                  .maybeSingle()
                if (!stillThere) {
                  await db.memories.delete(local.id)
                }
              }
            }
          }
          try { localStorage.setItem(FULL_SYNC_KEY, String(Date.now())) } catch { /* ignore */ }
        } catch {
          // Non-critical — will retry next day
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[memoryService] Failed to pull from Supabase:', error)
    }
  },

  async getSyncStatus(userId: string): Promise<{ pending: number; failed: number; abandoned: number; total: number }> {
    const items = await db.syncQueueV2
      .where('userId')
      .equals(userId)
      .and((item) => item.status !== 'done')
      .toArray()

    const pending = items.filter((item) => item.status === 'pending' || item.status === 'in_progress').length
    const failed = items.filter((item) => item.status === 'failed').length
    // 'abandoned' = permanently given up; report it so the UI doesn't claim
    // these items are backed up.
    const abandoned = items.filter((item) => item.status === 'abandoned').length

    return {
      pending,
      failed,
      abandoned,
      total: items.length,
    }
  },
}
