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
export function cleanConnectionName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
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




