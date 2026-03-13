import { describe, it, expect } from 'vitest'
import {
  cleanConnectionName,
  normalizeConnectionKey,
  parseConnectionTokens,
  dedupeConnections,
  buildConnectionDisplayMap,
} from '../connections'

describe('cleanConnectionName', () => {
  it('trims whitespace', () => {
    expect(cleanConnectionName('  Ceyda  ')).toBe('Ceyda')
  })

  it('collapses multiple spaces', () => {
    expect(cleanConnectionName('Ali   Veli')).toBe('Ali Veli')
  })

  it('returns empty string for whitespace-only', () => {
    expect(cleanConnectionName('   ')).toBe('')
  })
})

describe('normalizeConnectionKey', () => {
  it('lowercases and trims', () => {
    expect(normalizeConnectionKey('  Ceyda  ')).toBe('ceyda')
  })

  it('treats different cases as same key', () => {
    expect(normalizeConnectionKey('CEYDA')).toBe(normalizeConnectionKey('ceyda'))
    expect(normalizeConnectionKey('Ceyda')).toBe(normalizeConnectionKey('ceyda'))
  })
})

describe('parseConnectionTokens', () => {
  it('splits by comma', () => {
    expect(parseConnectionTokens('Ali, Veli, Ceyda')).toEqual(['Ali', 'Veli', 'Ceyda'])
  })

  it('splits by semicolon', () => {
    expect(parseConnectionTokens('Ali; Veli; Ceyda')).toEqual(['Ali', 'Veli', 'Ceyda'])
  })

  it('splits by newline', () => {
    expect(parseConnectionTokens('Ali\nVeli\nCeyda')).toEqual(['Ali', 'Veli', 'Ceyda'])
  })

  it('handles mixed delimiters', () => {
    expect(parseConnectionTokens('Ali, Veli; Ceyda\nAyşe')).toEqual(['Ali', 'Veli', 'Ceyda', 'Ayşe'])
  })

  it('filters empty tokens', () => {
    expect(parseConnectionTokens('Ali,,Veli,,,')).toEqual(['Ali', 'Veli'])
  })

  it('returns empty array for empty input', () => {
    expect(parseConnectionTokens('')).toEqual([])
  })

  it('trims each token', () => {
    expect(parseConnectionTokens('  Ali  ,  Veli  ')).toEqual(['Ali', 'Veli'])
  })
})

describe('dedupeConnections', () => {
  it('removes case-insensitive duplicates', () => {
    expect(dedupeConnections(['Ceyda', 'ceyda', 'CEYDA'])).toEqual(['Ceyda'])
  })

  it('preserves first occurrence', () => {
    const result = dedupeConnections(['ceyda', 'Ceyda', 'CEYDA'])
    expect(result).toEqual(['ceyda'])
  })

  it('preserves order of unique items', () => {
    expect(dedupeConnections(['Zeynep', 'Ali', 'Veli'])).toEqual(['Zeynep', 'Ali', 'Veli'])
  })

  it('filters empty strings', () => {
    expect(dedupeConnections(['Ali', '', '  ', 'Veli'])).toEqual(['Ali', 'Veli'])
  })

  it('handles empty array', () => {
    expect(dedupeConnections([])).toEqual([])
  })
})

describe('buildConnectionDisplayMap', () => {
  it('maps normalized key to first-seen display name', () => {
    const map = buildConnectionDisplayMap(['Ceyda', 'ceyda', 'CEYDA'])
    expect(map.get('ceyda')).toBe('Ceyda')
    expect(map.size).toBe(1)
  })

  it('handles multiple connections', () => {
    const map = buildConnectionDisplayMap(['Ali', 'Veli', 'ali'])
    expect(map.get('ali')).toBe('Ali')
    expect(map.get('veli')).toBe('Veli')
    expect(map.size).toBe(2)
  })

  it('skips empty names', () => {
    const map = buildConnectionDisplayMap(['', '  ', 'Ali'])
    expect(map.size).toBe(1)
  })
})
