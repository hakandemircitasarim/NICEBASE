/**
 * Connection utilities
 *
 * In NICEBASE, "connections" are user-defined entities associated with a memory.
 * They are stored on the Memory as `connections: string[]`.
 *
 * These helpers provide consistent parsing + normalization so that:
 * - "Ceyda", " ceyda " and "CEYDA" are treated as the same connection for filtering/counting
 * - display keeps the user's casing as much as possible
 */
import { Memory } from '../types'
import { parseLocalDate } from './dateFormat'

export function cleanConnectionName(name: string): string {
  // Cap at 100 chars so a separator-less paste can't produce an arbitrarily
  // long connection name that gets saved to memory.connections[], synced, and
  // injected raw into Aiya's prompt. Applied here (the shared entry point) so
  // ALL save/sync paths — parseConnectionTokens, dedupe, stats — stay bounded.
  return name.trim().replace(/\s+/g, ' ').slice(0, 100)
}

export function normalizeConnectionKey(name: string): string {
  return cleanConnectionName(name).toLocaleLowerCase()
}

export function parseConnectionTokens(input: string): string[] {
  // Split by comma/semicolon/newline. Allow users to paste lists easily.
  return input
    .split(/[,;\n]+/g)
    .map(cleanConnectionName)
    .filter(Boolean)
}

/**
 * Dedupe connections by normalized key while preserving order.
 */
export function dedupeConnections(connections: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of connections) {
    const cleaned = cleanConnectionName(raw)
    if (!cleaned) continue
    const key = normalizeConnectionKey(cleaned)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cleaned)
  }
  return result
}

/**
 * Creates a normalized map from key -> displayName (first seen).
 */
export function buildConnectionDisplayMap(connections: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const raw of connections) {
    const cleaned = cleanConnectionName(raw)
    if (!cleaned) continue
    const key = normalizeConnectionKey(cleaned)
    if (!map.has(key)) map.set(key, cleaned)
  }
  return map
}

export type ConnectionStat = {
  key: string
  name: string
  count: number
  lastUsed: string | null
}

/**
 * Aggregates per-connection stats from a set of memories: one entry per unique
 * (normalized) connection with its display name (first occurrence), the number
 * of memories referencing it, and the most-recent memory date (`lastUsed`).
 *
 * Sorted by count desc, then name asc (locale-aware). Centralizes what
 * Connections.tsx computes inline so multiple screens agree on the numbers.
 */
export function buildConnectionStats(
  memories: Pick<Memory, 'connections' | 'date'>[],
  locale?: string
): ConnectionStat[] {
  const displayMap = buildConnectionDisplayMap(memories.flatMap(m => m.connections))
  const map = new Map<string, ConnectionStat>()

  for (const [key, name] of displayMap.entries()) {
    map.set(key, { key, name, count: 0, lastUsed: null })
  }

  for (const memory of memories) {
    for (const raw of memory.connections) {
      const k = normalizeConnectionKey(raw)
      const entry = map.get(k) ?? { key: k, name: cleanConnectionName(raw), count: 0, lastUsed: null }
      entry.count += 1
      if (!entry.lastUsed || parseLocalDate(memory.date) > parseLocalDate(entry.lastUsed)) {
        entry.lastUsed = memory.date
      }
      map.set(k, entry)
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.name.localeCompare(b.name, locale, { sensitivity: 'base' })
  })
}






