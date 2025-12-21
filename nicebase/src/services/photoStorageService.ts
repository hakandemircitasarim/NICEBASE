import { supabase } from '../lib/supabase'
import { errorLoggingService } from './errorLoggingService'

const bucket = (import.meta as any).env?.VITE_SUPABASE_PHOTO_BUCKET || 'memory-photos'

export function isLocalPhotoRef(value: string) {
  return value.startsWith('local:')
}

function stripLocalPrefix(value: string) {
  return value.replace(/^local:/, '')
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

    const out: string[] = []
    for (const p of photos) {
      if (!isLocalPhotoRef(p)) {
        out.push(p)
        continue
      }

      const dataUrl = stripLocalPrefix(p)
      const { blob, mime } = await dataUrlToBlob(dataUrl)
      const ext = guessExt(mime)
      const fileName = `${crypto.randomUUID()}.${ext}`
      const path = `${userId}/${memoryId}/${fileName}`

      const uploadRes = await supabase.storage.from(bucket).upload(path, blob, {
        contentType: mime,
        upsert: true,
      })

      if (uploadRes.error) {
        errorLoggingService.logError(
          new Error(`Photo upload failed: ${uploadRes.error.message}`),
          'warning',
          userId
        )
        throw uploadRes.error
      }

      const publicUrlRes = supabase.storage.from(bucket).getPublicUrl(path)
      const url = publicUrlRes.data?.publicUrl
      if (!url) {
        throw new Error('Could not get public URL for uploaded photo')
      }
      out.push(url)
    }

    return out
  },
}


