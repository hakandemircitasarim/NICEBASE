import { supabase } from './supabase'
import { mapUserFromSupabase } from './userMapper'
import { User } from '../types'
import { errorLoggingService } from '../services/errorLoggingService'

/**
 * Fetches user data from Supabase by user ID
 * @param userId - The user ID to fetch
 * @returns User object or null if not found
 */
export async function fetchUserData(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
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
 * @returns Promise resolving to the user object, or null if creation failed after all retries
 */
export async function ensureUserExists(
  userId: string,
  email: string | undefined,
  maxRetries = 5
): Promise<User | null> {
  // First, try to fetch existing user
  let userData = await fetchUserData(userId)
  if (userData) {
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
      if (
        (dbError as any)?.code === '23505' ||
        String((dbError as any)?.message || '').toLowerCase().includes('duplicate') ||
        (dbError as any)?.status === 409
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
