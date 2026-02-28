/**
 * Simple in-memory rate limiter
 * Prevents excessive API calls or operations
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: number | null = null

  constructor() {
    // Cleanup old entries every 5 minutes
    if (typeof window !== 'undefined') {
      this.cleanupInterval = window.setInterval(() => {
        this.cleanup()
      }, 5 * 60 * 1000)
    }
  }

  /**
   * Check if an operation is allowed
   * @param key - Unique key for the rate limit (e.g., 'api:userId', 'photo:upload')
   * @param maxRequests - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now()
    const entry = this.limits.get(key)

    if (!entry || now > entry.resetAt) {
      // Create new entry or reset expired one
      this.limits.set(key, {
        count: 1,
        resetAt: now + windowMs,
      })
      return true
    }

    if (entry.count >= maxRequests) {
      return false
    }

    entry.count++
    return true
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string, maxRequests: number): number {
    const entry = this.limits.get(key)
    if (!entry || Date.now() > entry.resetAt) {
      return maxRequests
    }
    return Math.max(0, maxRequests - entry.count)
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.limits.delete(key)
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetAt) {
        this.limits.delete(key)
      }
    }
  }

  /**
   * Destroy rate limiter and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval !== null && typeof window !== 'undefined') {
      window.clearInterval(this.cleanupInterval)
    }
    this.limits.clear()
  }
}

export const rateLimiter = new RateLimiter()

/**
 * Rate limit configuration
 */
export const RATE_LIMITS = {
  API_CALL: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 requests per minute
  PHOTO_UPLOAD: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 uploads per minute
  MEMORY_CREATE: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 memories per minute
  SYNC: { maxRequests: 5, windowMs: 30 * 1000 }, // 5 syncs per 30 seconds
} as const
