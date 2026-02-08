import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { getLocalUserId } from '../utils/localUserId'

/**
 * Hook to get the current user ID
 * Returns the logged-in user's ID, or a local user ID for offline usage
 * @returns User ID string
 */
export function useUserId(): string {
  const { user } = useStore()
  
  return useMemo(() => {
    return user?.id || getLocalUserId()
  }, [user?.id])
}







