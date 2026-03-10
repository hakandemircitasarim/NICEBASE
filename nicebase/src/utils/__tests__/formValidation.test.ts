import { describe, it, expect, vi } from 'vitest'

// Mock i18n before importing the module under test
vi.mock('../../i18n', () => ({
  default: { t: (key: string) => key, language: 'tr' },
}))

import {
  isValidEmail,
  validateEmail,
  calculatePasswordStrength,
  validateMemoryText,
  validateDate,
  validateIntensity,
  validateConnections,
  validatePhotoCount,
} from '../formValidation'

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co')).toBe(true)
    expect(isValidEmail('user+tag@gmail.com')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('notanemail')).toBe(false)
    expect(isValidEmail('@domain.com')).toBe(false)
    expect(isValidEmail('user@')).toBe(false)
    expect(isValidEmail('user@.com')).toBe(false)
  })

  it('handles null/undefined-like inputs', () => {
    expect(isValidEmail(null as unknown as string)).toBe(false)
    expect(isValidEmail(undefined as unknown as string)).toBe(false)
  })

  it('trims whitespace', () => {
    expect(isValidEmail('  test@example.com  ')).toBe(true)
  })

  it('rejects whitespace-only', () => {
    expect(isValidEmail('   ')).toBe(false)
  })
})

describe('validateEmail', () => {
  it('returns error for empty email', () => {
    const result = validateEmail('')
    expect(result.isValid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns valid for correct email', () => {
    expect(validateEmail('test@example.com').isValid).toBe(true)
  })
})

describe('calculatePasswordStrength', () => {
  it('returns 0 for short passwords without special traits', () => {
    expect(calculatePasswordStrength('abc')).toBe(0)
    expect(calculatePasswordStrength('abcdefg')).toBe(0) // 7 chars, lowercase only
  })

  it('gives credit for digits even in short passwords', () => {
    // '1234567' is < 8 chars but /\d/ matches → strength 1
    expect(calculatePasswordStrength('1234567')).toBe(1)
  })

  it('returns 1 for 8+ char simple password', () => {
    expect(calculatePasswordStrength('abcdefgh')).toBe(1)
  })

  it('returns 2 for 12+ char simple password', () => {
    expect(calculatePasswordStrength('abcdefghijkl')).toBe(2)
  })

  it('increases for mixed case + digits', () => {
    expect(calculatePasswordStrength('Abcdefgh1')).toBe(3) // 8+ chars + mixed case + digit
  })

  it('caps at 4 for strong passwords', () => {
    expect(calculatePasswordStrength('Abcdefghijk1!')).toBe(4) // 12+ chars, mixed case, digit, special
  })

  it('never exceeds 4', () => {
    expect(calculatePasswordStrength('AbCdEfGhIjKlMnOp1234!@#$')).toBeLessThanOrEqual(4)
  })
})

describe('validateMemoryText', () => {
  it('rejects empty text', () => {
    const result = validateMemoryText('')
    expect(result.isValid).toBe(false)
  })

  it('rejects whitespace-only text', () => {
    expect(validateMemoryText('   ').isValid).toBe(false)
  })

  it('rejects text shorter than minimum', () => {
    expect(validateMemoryText('kısa').isValid).toBe(false) // < 10 chars
  })

  it('accepts text at exactly minimum length', () => {
    expect(validateMemoryText('1234567890').isValid).toBe(true) // exactly 10 chars
  })

  it('accepts text longer than minimum', () => {
    expect(validateMemoryText('Bu bir test metnidir ve yeterince uzun').isValid).toBe(true)
  })

  it('respects custom minimum length', () => {
    expect(validateMemoryText('abc', 3).isValid).toBe(true)
    expect(validateMemoryText('ab', 3).isValid).toBe(false)
  })
})

describe('validateDate', () => {
  it('accepts today', () => {
    expect(validateDate(new Date()).isValid).toBe(true)
  })

  it('accepts past dates', () => {
    expect(validateDate('2020-01-01').isValid).toBe(true)
  })

  it('rejects future dates', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 2) // 2 days ahead to be safe
    expect(validateDate(tomorrow).isValid).toBe(false)
  })

  it('rejects invalid date strings', () => {
    expect(validateDate('not-a-date').isValid).toBe(false)
    expect(validateDate('').isValid).toBe(false)
  })

  it('accepts ISO string dates', () => {
    expect(validateDate('2024-06-15T12:00:00.000Z').isValid).toBe(true)
  })
})

describe('validateIntensity', () => {
  it('accepts values 1-10', () => {
    for (let i = 1; i <= 10; i++) {
      expect(validateIntensity(i).isValid).toBe(true)
    }
  })

  it('rejects 0', () => {
    expect(validateIntensity(0).isValid).toBe(false)
  })

  it('rejects 11', () => {
    expect(validateIntensity(11).isValid).toBe(false)
  })

  it('rejects negative values', () => {
    expect(validateIntensity(-1).isValid).toBe(false)
  })
})

describe('validateConnections', () => {
  it('accepts empty string', () => {
    const result = validateConnections('')
    expect(result.isValid).toBe(true)
    expect(result.parsed).toEqual([])
  })

  it('parses comma-separated connections', () => {
    const result = validateConnections('Ali, Veli, Ceyda')
    expect(result.isValid).toBe(true)
    expect(result.parsed).toEqual(['Ali', 'Veli', 'Ceyda'])
  })

  it('detects duplicates (case-insensitive)', () => {
    const result = validateConnections('Ceyda, ceyda')
    expect(result.isValid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('dedupes in parsed output even when flagging error', () => {
    const result = validateConnections('Ceyda, ceyda')
    expect(result.parsed).toEqual(['Ceyda']) // deduped
  })
})

describe('validatePhotoCount', () => {
  it('accepts up to max', () => {
    expect(validatePhotoCount(0).isValid).toBe(true)
    expect(validatePhotoCount(5).isValid).toBe(true)
  })

  it('rejects over max', () => {
    expect(validatePhotoCount(6).isValid).toBe(false)
  })

  it('respects custom max', () => {
    expect(validatePhotoCount(3, 3).isValid).toBe(true)
    expect(validatePhotoCount(4, 3).isValid).toBe(false)
  })
})
