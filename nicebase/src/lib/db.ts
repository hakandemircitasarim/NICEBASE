import Dexie, { Table } from 'dexie'
import { Memory, Connection } from '../types'

export type SyncQueueOp = 'create' | 'update' | 'delete' | 'photoUpload'
export type SyncQueueStatus = 'pending' | 'in_progress' | 'failed' | 'done'

/**
 * Sync queue item data types
 */
export type SyncQueueData =
  | Memory // for 'create'
  | { id: string; updates: Partial<Memory> } // for 'update'
  | { id: string } // for 'delete'
  | { memoryId: string; photos: string[] } // for 'photoUpload'

export type SyncQueueItemV2 = {
  id: string
  userId: string
  entityId: string
  op: SyncQueueOp
  payload: SyncQueueData
  status: SyncQueueStatus
  attemptCount: number
  nextAttemptAt: number
  timestamp: number
  dedupeKey: string
  dependsOn?: string | null
  lastError?: string | null
}

export class NicebaseDB extends Dexie {
  memories!: Table<Memory, string>
  connections!: Table<Connection, string>
  // v1 queue (legacy) - kept for migration
  syncQueue!: Table<{ id: string; type: 'create' | 'update' | 'delete'; data: SyncQueueData; timestamp: number }, string>
  // v2 queue (premium, retry/backoff/dedupe)
  syncQueueV2!: Table<SyncQueueItemV2, string>

  constructor() {
    super('NicebaseDB')
    this.version(1).stores({
      memories: 'id, userId, date, category, lifeArea, isCore, synced',
      connections: 'id, userId, name, type',
      syncQueue: 'id, type, timestamp',
    })

    this.version(2)
      .stores({
        memories: 'id, userId, date, category, lifeArea, isCore, synced',
        connections: 'id, userId, name, type',
        syncQueue: 'id, type, timestamp', // keep legacy for upgrade path
        syncQueueV2: 'id, userId, entityId, op, status, nextAttemptAt, timestamp, dedupeKey',
      })
      .upgrade(async (tx) => {
        // Migrate legacy syncQueue items into v2 (best-effort).
        const legacy = await tx.table('syncQueue').toArray() as Array<{
          id: string
          type: 'create' | 'update' | 'delete'
          data: SyncQueueData
          timestamp: number
        }>

        const v2Table = tx.table('syncQueueV2')
        for (const item of legacy) {
          let entityId: string | undefined
          if (item.type === 'create' && 'id' in item.data) {
            entityId = item.data.id
          } else if (item.type === 'update' && 'id' in item.data) {
            entityId = item.data.id
          } else if (item.type === 'delete' && 'id' in item.data) {
            entityId = item.data.id
          } else {
            entityId = item.id
          }

          let userId: string | undefined
          if (item.type === 'create' && 'userId' in item.data) {
            userId = item.data.userId
          } else if (item.type === 'update' && 'updates' in item.data && item.data.updates && 'userId' in item.data.updates) {
            userId = item.data.updates.userId
          }

          // Skip if we cannot determine userId/entityId; user can still manually sync later.
          if (!entityId || !userId) continue

          const dedupeKey = `${userId}:${entityId}:${item.type}`
          await v2Table.add({
            id: item.id,
            userId,
            entityId,
            op: item.type,
            payload: item.data,
            status: 'pending',
            attemptCount: 0,
            nextAttemptAt: Date.now(),
            timestamp: item.timestamp || Date.now(),
            dedupeKey,
            dependsOn: null,
            lastError: null,
          })
        }
      })

    // v3: No schema changes needed; existing memories with old category/lifeArea values
    // will naturally coexist with 'uncategorized'. This version bump just marks the migration point.
    this.version(3)
      .stores({
        memories: 'id, userId, date, category, lifeArea, isCore, synced',
        connections: 'id, userId, name, type',
        syncQueue: 'id, type, timestamp',
        syncQueueV2: 'id, userId, entityId, op, status, nextAttemptAt, timestamp, dedupeKey',
      })
  }
}

export const db = new NicebaseDB()











