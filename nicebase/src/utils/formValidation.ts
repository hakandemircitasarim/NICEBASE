/**
 * Validates email format
 */
import { dedupeConnections, normalizeConnectionKey, parseConnectionTokens } from './connections'
import i18n from '../i18n'

/** Safe i18n.t wrapper — returns fallback if i18n is not ready */
function t(key: string, opts?: Record<string, unknown>): string {
  try {
    if (i18n && typeof i18n.t === 'function') {
      const val = String(i18n.t(key, opts as any))
      if (val && val !== key) return val
    }
  } catch { /* i18n not ready */ }
  return ''
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validates password strength
 * Returns a score from 0-4 (0 = weak, 4 = very strong)
 */
export function calculatePasswordStrength(password: string): number {
  let strength = 0

  if (password.length >= 8) strength++
  if (password.length >= 12) strength++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
  if (/\d/.test(password)) strength++
  if (/[^a-zA-Z\d]/.test(password)) strength++

  return Math.min(strength, 4)
}

/**
 * Gets password strength label
 */
export function getPasswordStrengthLabel(strength: number): string {
  const keys = [
    'passwordStrength.veryWeak',
    'passwordStrength.weak',
    'passwordStrength.fair',
    'passwordStrength.good',
    'passwordStrength.strong',
  ]
  const fallbacks = ['Çok Zayıf', 'Zayıf', 'Orta', 'Güçlü', 'Çok Güçlü']
  return t(keys[strength]) || fallbacks[strength] || fallbacks[0]
}

/**
 * Validates memory text
 */
export function validateMemoryText(text: string, minLength: number = 10): {
  isValid: boolean
  error?: string
} {
  if (!text.trim()) {
    return { isValid: false, error: t('pleaseEnterText') || 'Lütfen bir metin girin' }
  }
  if (text.trim().length < minLength) {
    return {
      isValid: false,
      error: t('textMinLength', { count: minLength }) || `Metin en az ${minLength} karakter olmalıdır`,
    }
  }
  return { isValid: true }
}

/**
 * Validates date (cannot be in the future)
 */
export function validateDate(date: string | Date): {
  isValid: boolean
  error?: string
} {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  if (dateObj > today) {
    return { isValid: false, error: t('dateCannotBeFuture') || 'Tarih gelecekte olamaz' }
  }

  return { isValid: true }
}

/**
 * Validates intensity value (1-10)
 */
export function validateIntensity(intensity: number): {
  isValid: boolean
  error?: string
} {
  if (intensity < 1 || intensity > 10) {
    return { isValid: false, error: t('intensityRange') || 'Yoğunluk 1-10 arasında olmalıdır' }
  }
  return { isValid: true }
}

/**
 * Validates connections string (comma-separated)
 */
export function validateConnections(connections: string): {
  isValid: boolean
  error?: string
  parsed: string[]
} {
  const cleaned = parseConnectionTokens(connections)
  const parsed = dedupeConnections(cleaned)

  if (parsed.length === 0) {
    return { isValid: true, parsed: [] }
  }

  // Check for duplicates
  const seen = new Set<string>()
  let hasDuplicate = false
  for (const c of cleaned) {
    const key = normalizeConnectionKey(c)
    if (seen.has(key)) {
      hasDuplicate = true
      break
    }
    seen.add(key)
  }

  if (hasDuplicate) {
    return {
      isValid: false,
      error: t('duplicateConnection') || 'Aynı bağlantı birden fazla kez eklenemez',
      parsed,
    }
  }

  return { isValid: true, parsed }
}

/**
 * Validates photo count
 */
export function validatePhotoCount(
  currentCount: number,
  maxCount: number = 5
): {
  isValid: boolean
  error?: string
} {
  if (currentCount > maxCount) {
    return {
      isValid: false,
      error: t('maxPhotos', { max: maxCount }) || `En fazla ${maxCount} fotoğraf eklenebilir`,
    }
  }
  return { isValid: true }
}







