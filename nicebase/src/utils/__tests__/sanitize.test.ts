import { describe, it, expect } from 'vitest'
import {
  sanitizeText,
  sanitizeConnectionName,
  validateAndSanitizeMemoryText,
} from '../sanitize'

describe('sanitizeText', () => {
  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello')
  })

  it('truncates at maxLength', () => {
    const long = 'a'.repeat(20000)
    expect(sanitizeText(long).length).toBe(10000)
  })

  it('respects custom maxLength', () => {
    expect(sanitizeText('abcdefghij', 5)).toBe('abcde')
  })

  it('removes null bytes and control chars', () => {
    expect(sanitizeText('hello\x00world')).toBe('helloworld')
    expect(sanitizeText('test\x01\x02\x03')).toBe('test')
  })

  it('preserves newlines and tabs', () => {
    expect(sanitizeText('hello\nworld\ttab')).toBe('hello\nworld\ttab')
  })

  it('returns empty string for non-string input', () => {
    expect(sanitizeText(null as unknown as string)).toBe('')
    expect(sanitizeText(123 as unknown as string)).toBe('')
  })
})

describe('sanitizeConnectionName', () => {
  it('trims whitespace', () => {
    expect(sanitizeConnectionName('  Ali  ')).toBe('Ali')
  })

  it('truncates at 100 chars by default', () => {
    const long = 'A'.repeat(200)
    expect(sanitizeConnectionName(long).length).toBe(100)
  })

  it('removes special characters', () => {
    expect(sanitizeConnectionName('<script>alert(1)</script>')).toBe('scriptalert1/script')
  })

  it('removes spaces (part of special char regex)', () => {
    // Note: the regex removes \s which includes spaces
    expect(sanitizeConnectionName('Ali Veli')).toBe('AliVeli')
  })

  it('returns empty string for non-string input', () => {
    expect(sanitizeConnectionName(null as unknown as string)).toBe('')
  })
})

describe('validateAndSanitizeMemoryText', () => {
  it('rejects empty text', () => {
    const result = validateAndSanitizeMemoryText('')
    expect(result.isValid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects text below minimum', () => {
    const result = validateAndSanitizeMemoryText('kısa')
    expect(result.isValid).toBe(false)
  })

  it('accepts valid text', () => {
    const result = validateAndSanitizeMemoryText('Bu yeterince uzun bir metin olmalı')
    expect(result.isValid).toBe(true)
    expect(result.sanitized).toBeTruthy()
  })

  it('sanitizes before validating', () => {
    const result = validateAndSanitizeMemoryText('\x00\x01\x02\x03short')
    expect(result.isValid).toBe(false) // "short" is < 10 chars
  })

  it('respects custom min and max', () => {
    const result = validateAndSanitizeMemoryText('abc', 3, 5)
    expect(result.isValid).toBe(true)
    expect(result.sanitized).toBe('abc')
  })
})
