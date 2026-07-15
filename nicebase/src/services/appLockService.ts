/**
 * App-lock service.
 *
 * Persists a salted PBKDF2 hash of the user's app-lock PIN in localStorage and
 * exposes helpers to set / verify / clear it. The PIN itself is never stored.
 */

import { generateSalt, hashPin, constantTimeEqual } from '../utils/appLockCrypto'
import { errorLoggingService } from './errorLoggingService'

const STORAGE_KEY = 'nicebase_applock_v1'

interface AppLockRecord {
  salt: string
  hash: string
}

function logUnexpected(context: string, error: unknown) {
  errorLoggingService.logError(
    error instanceof Error ? error : new Error(`${context}: ${String(error)}`),
    'error'
  )
}

/**
 * Read + validate the stored record. Returns null when no PIN is set or the
 * stored value is missing/corrupt. Unexpected errors are logged (never swallowed).
 */
function readRecord(): AppLockRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AppLockRecord> | null
    if (parsed && typeof parsed.salt === 'string' && typeof parsed.hash === 'string') {
      return { salt: parsed.salt, hash: parsed.hash }
    }
    return null
  } catch (error) {
    logUnexpected('appLockService.readRecord failed', error)
    return null
  }
}

export const appLockService = {
  /**
   * Synchronously reports whether an app-lock PIN is currently configured.
   * Returns false on any storage/parse error.
   */
  isEnabled(): boolean {
    return readRecord() !== null
  },

  /**
   * Hash and persist a new PIN, replacing any existing one.
   */
  async setPin(pin: string): Promise<void> {
    const salt = generateSalt()
    const hash = await hashPin(pin, salt)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ salt, hash } satisfies AppLockRecord))
    } catch (error) {
      logUnexpected('appLockService.setPin failed to persist', error)
      throw error instanceof Error ? error : new Error('Failed to save app-lock PIN')
    }
  },

  /**
   * Verify a candidate PIN against the stored record using a constant-time
   * comparison. Returns false when no PIN is set or on any error.
   */
  async verifyPin(pin: string): Promise<boolean> {
    const record = readRecord()
    if (!record) return false
    try {
      const candidate = await hashPin(pin, record.salt)
      return constantTimeEqual(candidate, record.hash)
    } catch (error) {
      logUnexpected('appLockService.verifyPin failed', error)
      return false
    }
  },

  /**
   * Remove the stored PIN (disables the app lock).
   */
  async clearPin(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      logUnexpected('appLockService.clearPin failed', error)
    }
  },
}
