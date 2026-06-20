import { describe, it, expect } from 'vitest'
import { toLocalISODate, parseLocalDate, formatMemoryDate } from '../dateFormat'

describe('dateFormat', () => {
  describe('toLocalISODate', () => {
    it('formats a given date as local YYYY-MM-DD', () => {
      // Local date parts (month is 0-based) — independent of timezone.
      const d = new Date(2026, 5, 20, 23, 30) // 2026-06-20 local
      expect(toLocalISODate(d)).toBe('2026-06-20')
    })

    it('does not shift the day for an early-morning local time', () => {
      // 00:30 local must still be the same calendar day (the UTC-based
      // toISOString() bug would roll this back a day in positive-UTC zones).
      const d = new Date(2026, 0, 1, 0, 30) // 2026-01-01 00:30 local
      expect(toLocalISODate(d)).toBe('2026-01-01')
    })

    it('zero-pads month and day', () => {
      const d = new Date(2026, 2, 5) // 2026-03-05
      expect(toLocalISODate(d)).toBe('2026-03-05')
    })
  })

  describe('parseLocalDate', () => {
    it('parses a date-only string at LOCAL midnight (no UTC shift)', () => {
      const d = parseLocalDate('2026-06-20')
      expect(d.getFullYear()).toBe(2026)
      expect(d.getMonth()).toBe(5)
      expect(d.getDate()).toBe(20)
      expect(d.getHours()).toBe(0)
    })

    it('ignores any time component', () => {
      const d = parseLocalDate('2026-06-20T18:45:00.000Z')
      expect(d.getFullYear()).toBe(2026)
      expect(d.getMonth()).toBe(5)
      expect(d.getDate()).toBe(20)
    })

    it('round-trips with toLocalISODate', () => {
      expect(toLocalISODate(parseLocalDate('2026-12-31'))).toBe('2026-12-31')
    })
  })

  describe('formatMemoryDate', () => {
    it('formats a stored date using the given locale without shifting the day', () => {
      const out = formatMemoryDate('2026-06-20', 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
      expect(out).toBe('06/20/2026')
    })
  })
})
