import { supabase } from '../lib/supabase'
import i18n from '../i18n'
import { errorLoggingService } from './errorLoggingService'
import { generateUUID } from '../utils/uuid'
import { retry, isNetworkError, isTransientError } from '../utils/retry'
import { withTimeout } from '../utils/timeout'
import { rateLimiter, RATE_LIMITS } from '../utils/rateLimiter'

const bucket = import.meta.env.VITE_SUPABASE_PHOTO_BUCKET || 'memory-photos'

/**
 * Hard, NON-retryable upload failure (e.g. a photo over the size limit).
 * Marked so the retry wrapper never burns attempts on it and the sync layer
 * can tell it apart from a transient network/server hiccup.
 */
export class NonRetryablePhotoError extends Error {
  readonly nonRetryable = true
  constructor(message: string) {
    super(message)
    this.name = 'NonRetryablePhotoError'
  }
}

function isNonRetryablePhotoError(error: unknown): boolean {
  return (
    error instanceof NonRetryablePhotoError ||
    (typeof error === 'object' && error !== null && (error as { nonRetryable?: boolean }).nonRetryable === true)
  )
}

/**
 * Checks whether the photo value is a local ref that needs uploading.
 * Detects both the explicit `local:` prefix AND raw base64 data-URLs
 * (which is what compressImage() produces).
 */
export function isLocalPhotoRef(value: string) {
  return value.startsWith('local:') || value.startsWith('data:')
}

function stripLocalPrefix(value: string) {
  if (value.startsWith('local:')) return value.replace(/^local:/, '')
  // Raw data-URL — return as-is (already a valid data URL for upload)
  return value
}

function guessExt(mime: string) {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

async function dataUrlToBlob(dataUrl: string): Promise<{ blob: Blob; mime: string }> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return { blob, mime: blob.type || 'image/jpeg' }
}

export const photoStorageService = {
  /**
   * Upload local photo refs (local:data-url) to Supabase Storage and return URL list.
   * Keeps already-remote URLs intact.
   */
  async ensureRemotePhotoUrls(params: {
    userId: string
    memoryId: string
    photos: string[]
  }): Promise<string[]> {
    const { userId, memoryId, photos } = params
    if (!photos || photos.length === 0) return []

    // Rate limiting
    const rateLimitKey = `photo:upload:${userId}`
    if (!rateLimiter.isAllowed(rateLimitKey, RATE_LIMITS.PHOTO_UPLOAD.maxRequests, RATE_LIMITS.PHOTO_UPLOAD.windowMs)) {
      throw new Error(i18n.t('photoUploadRateLimited'))
    }

    const out: string[] = []
    for (const p of photos) {
      if (!isLocalPhotoRef(p)) {
        out.push(p)
        continue
      }

      const dataUrl = stripLocalPrefix(p)
      const { blob, mime } = await dataUrlToBlob(dataUrl)
      
      // Validate blob size (max 10MB). A hard size failure is NON-retryable —
      // retrying the same oversized blob can never succeed, so it must not burn
      // the upload/sync retry budget.
      const MAX_SIZE = 10 * 1024 * 1024 // 10MB
      if (blob.size > MAX_SIZE) {
        const error = new NonRetryablePhotoError(
          i18n.t('photoTooLarge', { size: (blob.size / 1024 / 1024).toFixed(2) })
        )
        errorLoggingService.logError(error, 'warning', userId)
        throw error
      }

      const ext = guessExt(mime)
      const fileName = `${generateUUID()}.${ext}`
      const path = `${userId}/${memoryId}/${fileName}`

      const url = await retry(
        async () => {
          // Supabase storage resolves with { data, error } instead of throwing,
          // so the retry wrapper's retryable() never sees transient failures.
          // Re-throw the error here so retry() can classify it: a transient /
          // network error retries, anything else propagates immediately.
          const uploadRes = await withTimeout(
            Promise.resolve(
              supabase.storage.from(bucket).upload(path, blob, {
                contentType: mime,
                upsert: true,
              })
            ),
            30000 // 30 seconds for large photos
          )

          if (uploadRes.error) {
            // Preserve the original StorageError (carries status/statusCode) so
            // isTransientError()/isNetworkError() can classify it correctly.
            throw uploadRes.error
          }

          const publicUrlRes = supabase.storage.from(bucket).getPublicUrl(path)
          const publicUrl = publicUrlRes.data?.publicUrl
          if (!publicUrl) {
            // No URL despite a successful upload — treat as a hard failure, not a
            // transient one (retrying the same upload won't conjure a URL).
            throw new NonRetryablePhotoError(i18n.t('photoUploadError'))
          }
          return publicUrl
        },
        {
          maxAttempts: 3,
          initialDelayMs: 2000,
          retryable: (error) =>
            !isNonRetryablePhotoError(error) &&
            (isNetworkError(error) || isTransientError(error)),
        }
      ).catch((error: unknown) => {
        const wrapped =
          error instanceof Error ? error : new Error(`Photo upload failed: ${String(error)}`)
        errorLoggingService.logError(
          wrapped,
          isNonRetryablePhotoError(error) ? 'warning' : 'error',
          userId
        )
        throw wrapped
      })

      out.push(url)
    }

    return out
  },
}




