/**
 * UUID generation utility with Android WebView compatibility
 * Falls back to a custom UUID implementation when crypto.randomUUID is not available
 */

/**
 * Generates a UUID v4 compatible string
 * Uses crypto.randomUUID if available, otherwise falls back to a custom implementation
 */
export function generateUUID(): string {
  // Try native crypto.randomUUID first (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID()
    } catch (e) {
      // Fall through to custom implementation
    }
  }

  // Fallback: Custom UUID v4 implementation for Android WebView
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
