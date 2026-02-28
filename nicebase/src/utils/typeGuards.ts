import { Memory } from '../types'
import { SupabaseError } from '../types/supabase'

/**
 * Type guards for runtime type checking
 */

export function isMemory(value: unknown): value is Memory {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.userId === 'string' &&
    typeof obj.text === 'string' &&
    typeof obj.date === 'string'
  )
}

export function isSupabaseError(value: unknown): value is SupabaseError {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    (typeof obj.message === 'string' || obj.message === undefined) &&
    (typeof obj.code === 'string' || obj.code === undefined) &&
    (typeof obj.status === 'number' || obj.status === undefined)
  )
}

export function isErrorResponse<T>(
  value: unknown
): value is { data: T | null; error: SupabaseError | null } {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return 'data' in obj && 'error' in obj
}

export function hasError(value: unknown): value is { error: unknown } {
  if (!value || typeof value !== 'object') return false
  return 'error' in value
}

export function isUpdatePayload(
  value: unknown
): value is { id: string; updates: Partial<Memory> } {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return typeof obj.id === 'string' && typeof obj.updates === 'object' && obj.updates !== null
}

export function isDeletePayload(value: unknown): value is { id: string } {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return typeof obj.id === 'string'
}

export function isPhotoUploadPayload(
  value: unknown
): value is { memoryId: string; photos: string[] } {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.memoryId === 'string' &&
    Array.isArray(obj.photos) &&
    obj.photos.every((p: unknown) => typeof p === 'string')
  )
}
