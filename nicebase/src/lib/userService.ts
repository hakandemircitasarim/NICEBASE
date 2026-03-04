import { supabase } from './supabase'
import { mapUserFromSupabase } from './userMapper'
import { User } from '../types'
import { errorLoggingService } from '../services/errorLoggingService'
import { SupabaseError } from '../types/supabase'

/**
 * Fetches user data from Supabase by user ID
 * @param userId - The user ID to fetch
 * @returns User object or null if not found
 */
export async function fetchUserData(userId: string): Promise<User | null> {
  try {
    // Select only the columns we actually use — avoids transferring avatar_url
    // (which may contain a large base64 string) and any future unused columns.
    // This drastically reduces PostgREST egress.
    const { data, error } = await supabase
      .from('users')
      .select('id, email, display_name, bio, avatar_url, birthday, location, is_premium, aiya_messages_used, aiya_messages_limit, weekly_summary_day, daily_reminder_time, language, theme, created_at')
      .eq('id', userId)
      // `.single()` throws a 406 when 0 rows are returned. In auth flows, the
      // `public.users` row may not exist yet (race/trigger/app-created row).
      // `maybeSingle()` treats 0 rows as `null` without an error.
      .maybeSingle()

    if (error) {
      errorLoggingService.logError(
        new Error(`Failed to fetch user data: ${error.message}`),
        'warning',
        userId
      )
      return null
    }

    if (data) {
      return mapUserFromSupabase(data)
    }

    return null
  } catch (error) {
    errorLoggingService.logError(
      error instanceof Error ? error : new Error('Unknown error fetching user data'),
      'error',
      userId
    )
    return null
  }
}

/**
 * Fetches user data from the current session
 * @returns User object or null if not authenticated
 */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return null
    }

    return await fetchUserData(session.user.id)
  } catch (error) {
    errorLoggingService.logError(
      error instanceof Error ? error : new Error('Unknown error fetching current user'),
      'error'
    )
    return null
  }
}

/**
 * Ensures a user exists in the database, creating one if necessary.
 * Implements retry logic to handle race conditions and database replication delays.
 *
 * @param userId - The user's unique identifier
 * @param email - The user's email address
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @param metadata - Optional metadata from OAuth provider (displayName, avatarUrl)
 * @returns Promise resolving to the user object, or null if creation failed after all retries
 */
export async function ensureUserExists(
  userId: string,
  email: string | undefined,
  maxRetries = 2,
  metadata?: { displayName?: string | null; avatarUrl?: string | null }
): Promise<User | null> {
  // First, try to fetch existing user
  let userData = await fetchUserData(userId)
  if (userData) {
    // If user exists but missing display_name and we have metadata, update it
    if (!userData.displayName && metadata?.displayName) {
      try {
        await supabase.from('users').update({
          display_name: metadata.displayName,
          ...(metadata.avatarUrl && !userData.avatarUrl ? { avatar_url: metadata.avatarUrl } : {}),
        }).eq('id', userId)
        // Re-fetch to get updated data
        const updated = await fetchUserData(userId)
        if (updated) return updated
      } catch {
        // Non-critical, return existing user
      }
    }
    return userData
  }

  // User doesn't exist, try to create with retries
  let userCreated = false
  let retries = maxRetries

  while (retries > 0 && !userCreated) {
    // Use upsert to avoid 409 conflicts when the row exists but isn't readable yet
    const { error: dbError } = await supabase.from('users').upsert(
      {
        id: userId,
        email: email,
        display_name: metadata?.displayName || null,
        avatar_url: metadata?.avatarUrl || null,
        is_premium: false,
        aiya_messages_used: 0,
        aiya_messages_limit: 50,
        weekly_summary_day: null,
        daily_reminder_time: null,
        language: 'tr',
        theme: 'light',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    if (!dbError) {
      userCreated = true
      // Wait a moment for the insert to be available
      await new Promise(resolve => setTimeout(resolve, 300))
      // Try to fetch the newly created user
      userData = await fetchUserData(userId)
      if (userData) {
        return userData
      }
    } else {
      // If upsert still fails for transient reasons, retry
      const error = dbError as SupabaseError
      if (
        error?.code === '23505' ||
        String(error?.message || '').toLowerCase().includes('duplicate') ||
        error?.status === 409
      ) {
        await new Promise(resolve => setTimeout(resolve, 300))
        userData = await fetchUserData(userId)
        if (userData) return userData
      }

      if (import.meta.env.DEV) {
        errorLoggingService.logError(
          `Insert attempt ${maxRetries - retries + 1} failed: ${dbError.message}`,
          'warning',
          userId
        )
      }
      retries--
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // If we still can't get the user after all retries, return null
  return null
}
