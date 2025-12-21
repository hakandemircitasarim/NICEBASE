/**
 * Local user ID utility for offline usage
 * Creates and stores a local user ID in localStorage for users who haven't logged in
 */

const LOCAL_USER_ID_KEY = 'nicebase_local_user_id'

/**
 * Gets or creates a local user ID for offline usage
 * @returns Local user ID string
 */
export function getLocalUserId(): string {
  if (typeof window === 'undefined') {
    return 'local-user-' + Date.now()
  }

  try {
    let localUserId = localStorage.getItem(LOCAL_USER_ID_KEY)
    
    if (!localUserId) {
      // Create a new local user ID
      localUserId = 'local-' + crypto.randomUUID()
      localStorage.setItem(LOCAL_USER_ID_KEY, localUserId)
    }
    
    return localUserId
  } catch (error) {
    // Fallback if localStorage is not available
    return 'local-user-' + Date.now()
  }
}

/**
 * Clears the local user ID (e.g., when user logs in)
 */
export function clearLocalUserId(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_USER_ID_KEY)
    } catch (error) {
      // Failed to clear local user ID - non-critical
      if (import.meta.env.DEV) {
        console.warn('Failed to clear local user ID:', error)
      }
    }
  }
}








