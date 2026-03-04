import { db } from '../lib/db'
import { Memory } from '../types'
import { supabase, hasSupabaseConfig } from '../lib/supabase'
import { generateUUID } from '../utils/uuid'
import { addToSyncQueue } from './syncQueueHelper'
import { SyncQueueItemV2 } from '../lib/db'

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
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    category: row.category as Memory['category'],
    categories: (row.categories || [row.category]) as Memory['categories'],
    intensity: row.intensity,
    date: new Date(row.date).toISOString(),
    connections: row.connections || [],
    lifeArea: (row.life_area || 'uncategorized') as Memory['lifeArea'],
    isCore: row.is_core,
    photos: row.photos || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: true,
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
        console.warn('[memoryService] Auto-categorize failed:', err)
      })
    }

    return memory
  },

  async update(id: string, updates: Partial<Omit<Memory, 'id' | 'userId' | 'createdAt'>>): Promise<Memory> {
    const existing = await db.memories.get(id)
    if (!existing) {
      throw new Error(`Memory with id ${id} not found`)
    }

    const updated: Memory = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      synced: false,
    }

    // Update local DB
    await db.memories.put(updated)

    // Add to sync queue
    if (hasSupabaseConfig) {
      await addToSyncQueue('update', { id, updates }, existing.userId)
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
      console.warn('[memoryService] Auto-categorize failed:', err)
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

    // Get pending sync items for this user
    const pendingItems = await db.syncQueueV2
      .where('userId')
      .equals(userId)
      .and((item) => item.status === 'pending' || item.status === 'failed')
      .filter((item) => item.nextAttemptAt <= Date.now())
      .toArray()

    if (pendingItems.length === 0 && !navigator.onLine) return

    for (const item of pendingItems) {
      // Give up after 10 attempts — mark as done to stop retrying forever
      if (item.attemptCount >= 10) {
        console.warn(`[sync] Giving up on item ${item.id} after ${item.attemptCount} attempts: ${item.lastError}`)
        await db.syncQueueV2.update(item.id, { status: 'done', lastError: `Gave up after ${item.attemptCount} attempts` })
        continue
      }

      try {
        // Mark as in progress
        await db.syncQueueV2.update(item.id, { status: 'in_progress' })

        if (item.op === 'create') {
          const memory = item.payload as Memory
          const supabaseData = mapMemoryToSupabase(memory)
          // Use upsert instead of insert — idempotent, handles retries gracefully
          const { error } = await supabase.from('memories').upsert(supabaseData, { onConflict: 'id' })
          if (error) throw error

          // Mark memory as synced
          await db.memories.update(memory.id, { synced: true })
        } else if (item.op === 'update') {
          const extracted = extractUpdatesFromPayload(item.payload)
          if (!extracted) {
            // Corrupt payload — can't recover, skip it
            console.warn('[sync] Corrupt update payload, skipping:', item.payload)
            await db.syncQueueV2.update(item.id, { status: 'done', lastError: 'Corrupt payload — skipped' })
            continue
          }

          const { id, updates } = extracted
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

          const { error } = await supabase
            .from('memories')
            .update(supabaseUpdates)
            .eq('id', id)
          if (error) throw error

          // Mark memory as synced
          await db.memories.update(id, { synced: true })
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
        console.warn(`[sync] Item ${item.id} (${item.op}) failed attempt ${attemptCount}:`, errorMsg)
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
        .select('id, user_id, text, category, categories, intensity, date, connections, life_area, is_core, photos, created_at, updated_at')
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
      }

      // Update last sync timestamp
      try {
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
      } catch { /* ignore */ }

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
              if (local.synced && !remoteIds.has(local.id)) {
                // Check there's no pending sync for this memory
                const pendingSync = await db.syncQueueV2
                  .where('entityId')
                  .equals(local.id)
                  .and((item) => item.status !== 'done')
                  .first()
                if (!pendingSync) {
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
      console.warn('[memoryService] Failed to pull from Supabase:', error)
    }
  },

  async getSyncStatus(userId: string): Promise<{ pending: number; failed: number; total: number }> {
    const items = await db.syncQueueV2
      .where('userId')
      .equals(userId)
      .and((item) => item.status !== 'done')
      .toArray()

    const pending = items.filter((item) => item.status === 'pending' || item.status === 'in_progress').length
    const failed = items.filter((item) => item.status === 'failed').length

    return {
      pending,
      failed,
      total: items.length,
    }
  },
}
