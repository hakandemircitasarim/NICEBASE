/**
 * Input sanitization utilities
 */

/**
 * Sanitizes text input by removing potentially dangerous content
 * @param text - Text to sanitize
 * @param maxLength - Maximum allowed length (default: 10000)
 * @returns Sanitized text
 */
export function sanitizeText(text: string, maxLength: number = 10000): string {
  if (typeof text !== 'string') {
    return ''
  }

  // Trim whitespace
  let sanitized = text.trim()

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength)
  }

  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

  return sanitized
}

/**
 * Sanitizes connection names
 * @param name - Connection name to sanitize
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns Sanitized name
 */
export function sanitizeConnectionName(name: string, maxLength: number = 100): string {
  if (typeof name !== 'string') {
    return ''
  }

  let sanitized = name.trim()

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength)
  }

  // Remove special characters that could be problematic
  sanitized = sanitized.replace(/[<>{}[\]\\|`~!@#$%^&*()+=\s]/g, '')

  return sanitized
}

/**
 * Validates and sanitizes memory text
 * @param text - Memory text to validate and sanitize
 * @returns Validation result with sanitized text
 */
export function validateAndSanitizeMemoryText(
  text: string,
  minLength: number = 10,
  maxLength: number = 10000
): {
  isValid: boolean
  sanitized: string
  error?: string
} {
  const sanitized = sanitizeText(text, maxLength)

  if (sanitized.length === 0) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Metin boş olamaz',
    }
  }

  if (sanitized.length < minLength) {
    return {
      isValid: false,
      sanitized,
      error: `Metin en az ${minLength} karakter olmalıdır`,
    }
  }

  return {
    isValid: true,
    sanitized,
  }
}
