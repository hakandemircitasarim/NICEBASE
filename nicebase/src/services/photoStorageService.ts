import { supabase } from '../lib/supabase'
import { errorLoggingService } from './errorLoggingService'
import { generateUUID } from '../utils/uuid'
import { retry, isNetworkError, isTransientError } from '../utils/retry'
import { withTimeout } from '../utils/timeout'
import { rateLimiter, RATE_LIMITS } from '../utils/rateLimiter'

const bucket = import.meta.env.VITE_SUPABASE_PHOTO_BUCKET || 'memory-photos'

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
      throw new Error('Çok fazla fotoğraf yükleme isteği. Lütfen bir süre bekleyin.')
    }

    const out: string[] = []
    for (const p of photos) {
      if (!isLocalPhotoRef(p)) {
        out.push(p)
        continue
      }

      const dataUrl = stripLocalPrefix(p)
      const { blob, mime } = await dataUrlToBlob(dataUrl)
      
      // Validate blob size (max 10MB)
      const MAX_SIZE = 10 * 1024 * 1024 // 10MB
      if (blob.size > MAX_SIZE) {
        throw new Error(`Photo size exceeds maximum limit of 10MB (current: ${(blob.size / 1024 / 1024).toFixed(2)}MB)`)
      }
      
      const ext = guessExt(mime)
      const fileName = `${generateUUID()}.${ext}`
      const path = `${userId}/${memoryId}/${fileName}`

      const uploadRes = await retry(
        () => withTimeout(
          Promise.resolve(
            supabase.storage.from(bucket).upload(path, blob, {
              contentType: mime,
              upsert: true,
            })
          ),
          30000 // 30 seconds for large photos
        ),
        {
          maxAttempts: 3,
          initialDelayMs: 2000,
          retryable: (error) => isNetworkError(error) || isTransientError(error),
        }
      )

      if (uploadRes.error) {
        const error = new Error(`Photo upload failed: ${uploadRes.error.message}`)
        errorLoggingService.logError(error, 'warning', userId)
        throw error
      }

      const publicUrlRes = supabase.storage.from(bucket).getPublicUrl(path)
      const url = publicUrlRes.data?.publicUrl
      if (!url) {
        const error = new Error('Could not get public URL for uploaded photo')
        errorLoggingService.logError(error, 'error', userId)
        throw error
      }
      out.push(url)
    }

    return out
  },
}




