import { db, SyncQueueItemV2, SyncQueueOp } from '../lib/db'
import { Memory } from '../types'

/**
 * Sync queue item data types
 */
type SyncQueueData =
  | Memory // for 'create'
  | { id: string; updates: Partial<Memory> } // for 'update'
  | { id: string } // for 'delete'
  | { id: string; localRefs: string[] } // for 'photoUpload' (future use)

function now() {
  return Date.now()
}

function buildDedupeKey(userId: string, entityId: string, op: SyncQueueOp) {
  return `${userId}:${entityId}:${op}`
}

function mergePayload(existing: any, incoming: any, op: SyncQueueOp) {
  if (op === 'update') {
    // Merge updates; latest wins per field.
    const prev = existing as { id: string; updates: Partial<Memory> }
    const next = incoming as { id: string; updates: Partial<Memory> }
    return { id: prev.id, updates: { ...prev.updates, ...next.updates } }
  }
  // For create/delete/photoUpload we keep the latest payload (or union if needed later).
  return incoming
}

/**
 * Adds an item to the sync queue for later synchronization.
 * This is used when sync operations fail or when the device is offline.
 * 
 * @param type - The type of sync operation ('create', 'update', or 'delete')
 * @param data - The data to be synced. Format depends on type:
 *   - 'create': Full Memory object
 *   - 'update': Object with { id: string, updates: Partial<Memory> }
 *   - 'delete': Object with { id: string }
 * @returns Promise that resolves when the item is added to the queue
 * 
 * @example
 * ```typescript
 * // Add a new memory to sync queue
 * await addToSyncQueue('create', newMemory)
 * 
 * // Add an update to sync queue
 * await addToSyncQueue('update', { id: 'memory-id', updates: { text: 'Updated text' } })
 * 
 * // Add a delete to sync queue
 * await addToSyncQueue('delete', { id: 'memory-id' })
 * ```
 */
export async function addToSyncQueue(
  type: SyncQueueOp,
  data: SyncQueueData,
  userIdOverride?: string
): Promise<void> {
  // v2 queue (preferred)
  const entityId =
    type === 'create' ? (data as Memory).id :
    type === 'update' ? (data as { id: string }).id :
    type === 'delete' ? (data as { id: string }).id :
    (data as { id: string }).id

  const userId =
    userIdOverride ||
    (type === 'create' ? (data as Memory).userId : '') ||
    ''

  if (!entityId || !userId) {
    // Fallback to legacy queue if we can't deduce identifiers.
    await db.syncQueue.add({
      id: crypto.randomUUID(),
      type: type as any,
      data,
      timestamp: now(),
    })
    return
  }

  const dedupeKey = buildDedupeKey(userId, entityId, type)

  // Premium coalescing rules:
  // - If a create is pending for this entity, merge subsequent updates into the create payload.
  // - If a create is pending and we get a delete, drop the create (never reaches cloud) and skip delete.
  const createKey = buildDedupeKey(userId, entityId, 'create')
  const pendingCreate = await db.syncQueueV2.where('dedupeKey').equals(createKey).first()
  if (pendingCreate && pendingCreate.status !== 'done') {
    if (type === 'update') {
      const updatePayload = data as { id: string; updates: Partial<Memory> }
      const createPayload = pendingCreate.payload as Memory
      const mergedCreate: Memory = {
        ...createPayload,
        ...updatePayload.updates,
        id: createPayload.id,
        userId: createPayload.userId,
      }
      await db.syncQueueV2.update(pendingCreate.id, {
        payload: mergedCreate,
        status: 'pending',
        nextAttemptAt: now(),
        timestamp: now(),
      } satisfies Partial<SyncQueueItemV2>)
      return
    }

    if (type === 'delete') {
      await db.syncQueueV2.delete(pendingCreate.id)
      return
    }
  }

  const existing = await db.syncQueueV2.where('dedupeKey').equals(dedupeKey).first()

  if (existing && existing.status !== 'done') {
    const merged = mergePayload(existing.payload, data, type)
    await db.syncQueueV2.update(existing.id, {
      payload: merged,
      status: 'pending',
      nextAttemptAt: now(),
      timestamp: now(),
    } satisfies Partial<SyncQueueItemV2>)
    return
  }

  await db.syncQueueV2.add({
    id: crypto.randomUUID(),
    userId,
    entityId,
    op: type,
    payload: data,
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: now(),
    timestamp: now(),
    dedupeKey,
    dependsOn: null,
    lastError: null,
  })
}





