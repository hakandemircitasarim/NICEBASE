import Dexie, { Table } from 'dexie'
import { Memory, Connection } from '../types'

export type SyncQueueOp = 'create' | 'update' | 'delete' | 'photoUpload'
export type SyncQueueStatus = 'pending' | 'in_progress' | 'failed' | 'done'

export type SyncQueueItemV2 = {
  id: string
  userId: string
  entityId: string
  op: SyncQueueOp
  payload: any
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
  syncQueue!: Table<{ id: string; type: 'create' | 'update' | 'delete'; data: any; timestamp: number }, string>
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
          data: any
          timestamp: number
        }>

        const v2Table = tx.table('syncQueueV2')
        for (const item of legacy) {
          const entityId =
            item.type === 'create' ? item.data?.id :
            item.type === 'update' ? item.data?.id :
            item.type === 'delete' ? item.data?.id :
            item.id

          const userId =
            item.type === 'create' ? item.data?.userId :
            item.type === 'update' ? item.data?.updates?.userId :
            undefined

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











