import { useEffect } from 'react'

/**
 * Calls `handler` when the Escape key is pressed while `active` is true.
 * Used to give hand-rolled modals/sheets keyboard dismissal.
 */
export function useEscapeKey(handler: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handler, active])
}
