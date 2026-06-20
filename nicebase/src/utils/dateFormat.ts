/**
 * Local-calendar date helpers.
 *
 * A memory's `date` is a bare YYYY-MM-DD *calendar* date. Both
 * `new Date().toISOString()` (for "today") and `new Date('2026-06-20')` (for
 * parsing) operate in UTC, which shifts the day in non-UTC zones — e.g. a
 * memory added at 00:30 in UTC+3 would be dated the previous day, and a stored
 * date renders one day early in negative-UTC zones. These helpers keep date
 * handling in the user's LOCAL calendar so the day never drifts.
 */

/** The given date's LOCAL calendar date as YYYY-MM-DD (defaults to now). */
export function toLocalISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a date-only (YYYY-MM-DD or full ISO) string to LOCAL midnight. */
export function parseLocalDate(dateStr: string): Date {
  const datePart = String(dateStr).split('T')[0]
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return new Date(dateStr) // fallback for unexpected input
  return new Date(y, m - 1, d)
}

/** Format a stored memory date for display in the user's locale. */
export function formatMemoryDate(
  dateStr: string,
  locale?: string,
  opts?: Intl.DateTimeFormatOptions
): string {
  return parseLocalDate(dateStr).toLocaleDateString(locale, opts)
}
