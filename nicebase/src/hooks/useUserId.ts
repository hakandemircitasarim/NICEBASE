import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { getLocalUserId } from '../utils/localUserId'

/**
 * Hook to get the current user ID
 * Returns the logged-in user's ID, or a local user ID for offline usage
 * @returns User ID string
 */
export function useUserId(): string {
  const user = useStore((s) => s.user)

  return useMemo(() => {
    return user?.id || getLocalUserId()
  }, [user?.id])
}

/**
 * Whether the current user id is a throwaway local/guest account (no Supabase
 * session). Data written under this id lives only on this device and can be
 * permanently deleted by the post-login migration prompt — so callers should
 * surface a "sign in to back up" affordance when this is true.
 *
 * Kept separate from useUserId so existing `useUserId(): string` call sites are
 * unaffected.
 */
export function useIsLocalUser(): boolean {
  const user = useStore((s) => s.user)
  return !user?.id
}







