import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

/**
 * Registers an overlay/modal as "open" in the global store while `isOpen` is true.
 * This allows Layout (bottom nav) to respond deterministically without DOM scanning.
 */
export function useModalPresence(isOpen: boolean) {
  const increment = useStore((s) => s.incrementModalCount)
  const decrement = useStore((s) => s.decrementModalCount)
  const activeRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return
    if (activeRef.current) return
    activeRef.current = true
    increment()

    return () => {
      if (!activeRef.current) return
      activeRef.current = false
      decrement()
    }
  }, [isOpen, increment, decrement])
}


