import { db } from '../lib/db'
import { Memory } from '../types'
import { supabase, hasSupabaseConfig } from '../lib/supabase'
import { generateUUID } from '../utils/uuid'
import { addToSyncQueue } from './syncQueueHelper'
import { SyncQueueItemV2 } from '../lib/db'

// Map Memory to Supabase format
function mapMemoryToSupabase(memory: Memory) {
  return {
    id: memory.id,
    user_id: memory.userId,
    text: memory.text,
    category: memory.category,
    categories: memory.categories || [memory.category],
    intensity: memory.intensity,
    date: memory.date.split('T')[0], // Extract date part
    connections: memory.connections,
    life_area: memory.lifeArea,
    is_core: memory.isCore,
    photos: memory.photos,
    created_at: memory.createdAt,
    updated_at: memory.updatedAt,
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
    lifeArea: row.life_area as Memory['lifeArea'],
    isCore: row.is_core,
    photos: row.photos || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: true,
  }
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

    // Get pending sync items for this user (skip in_progress to avoid double-processing)
    const pendingItems = await db.syncQueueV2
      .where('userId')
      .equals(userId)
      .and((item) => item.status === 'pending' || item.status === 'failed')
      .filter((item) => item.nextAttemptAt <= Date.now())
      .toArray()

    if (pendingItems.length === 0 && !navigator.onLine) return

    for (const item of pendingItems) {
      try {
        // Mark as in progress
        await db.syncQueueV2.update(item.id, { status: 'in_progress' })

        if (item.op === 'create') {
          const memory = item.payload as Memory
          const supabaseData = mapMemoryToSupabase(memory)
          const { error } = await supabase.from('memories').insert(supabaseData)
          if (error) throw error
          
          // Mark memory as synced
          await db.memories.update(memory.id, { synced: true })
        } else if (item.op === 'update') {
          const { id, updates } = item.payload as { id: string; updates: Partial<Memory> }
          const supabaseUpdates: Record<string, unknown> = {}
          
          if (updates.text !== undefined) supabaseUpdates.text = updates.text
          if (updates.category !== undefined) supabaseUpdates.category = updates.category
          if (updates.categories !== undefined) supabaseUpdates.categories = updates.categories
          if (updates.intensity !== undefined) supabaseUpdates.intensity = updates.intensity
          if (updates.date !== undefined) supabaseUpdates.date = updates.date.split('T')[0]
          if (updates.connections !== undefined) supabaseUpdates.connections = updates.connections
          if (updates.lifeArea !== undefined) supabaseUpdates.life_area = updates.lifeArea
          if (updates.isCore !== undefined) supabaseUpdates.is_core = updates.isCore
          if (updates.photos !== undefined) supabaseUpdates.photos = updates.photos
          if (updates.updatedAt !== undefined) supabaseUpdates.updated_at = updates.updatedAt

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
        await db.syncQueueV2.update(item.id, {
          status: 'failed',
          attemptCount,
          nextAttemptAt: Date.now() + backoffMs,
          lastError: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Also pull from Supabase to sync any remote changes
    try {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) throw error

      if (data) {
        const remoteIds = new Set(data.map((row: { id: string }) => row.id))

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

        // Remove local memories that were deleted remotely
        // Only remove synced memories that have no pending sync operations
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
    } catch (error) {
      // Log but don't throw - local-first approach
      if (import.meta.env.DEV) {
        console.warn('[memoryService] Failed to pull from Supabase:', error)
      }
    }
  },

  async getSyncStatus(userId: string): Promise<{ pending: number; failed: number; total: number }> {
    const items = await db.syncQueueV2
      .where('userId')
      .equals(userId)
      .toArray()

    const pending = items.filter((item) => item.status === 'pending').length
    const failed = items.filter((item) => item.status === 'failed').length

    return {
      pending,
      failed,
      total: items.length,
    }
  },
}
