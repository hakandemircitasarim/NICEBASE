import { Memory } from '../types'
import { dedupeConnections } from './connections'

/**
 * Gets unique connections from memories
 */
export function getUniqueConnections(memories: Memory[]): string[] {
  return dedupeConnections(memories.flatMap(m => m.connections))
}



