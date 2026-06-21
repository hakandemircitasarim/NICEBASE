import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Memory } from '../types'
import { memoryService } from '../services/memoryService'

interface UseMemoriesOptions {
  autoLoad?: boolean
  onLoadComplete?: (memories: Memory[]) => void
}

interface UseMemoriesReturn {
  memories: Memory[]
  loading: boolean
  error: Error | null
  loadMemories: () => Promise<void>
  refreshMemories: () => Promise<void>
}

/**
 * Hook for managing memories
 * Centralizes memory loading, error handling, and state management
 */
export function useMemories(
  userId: string,
  options: UseMemoriesOptions = {}
): UseMemoriesReturn {
  const { autoLoad = true, onLoadComplete } = options
  const { t } = useTranslation()
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // Store onLoadComplete in a ref to prevent infinite re-renders
  const onLoadCompleteRef = useRef(onLoadComplete)
  useEffect(() => {
    onLoadCompleteRef.current = onLoadComplete
  }, [onLoadComplete])

  // Keep `t` in a ref too, so loadMemories doesn't depend on it. Otherwise every
  // language toggle changes loadMemories' identity and re-runs the autoLoad
  // effect, refetching the whole table from Dexie for nothing.
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  const loadMemories = useCallback(async () => {
    if (!userId) return

    try {
      setLoading(true)
      setError(null)
      const allMemories: Memory[] = await memoryService.getAll(userId)
      setMemories(allMemories)
      onLoadCompleteRef.current?.(allMemories)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load memories')
      setError(error)
      toast.error(tRef.current('memoriesLoadError'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  const refreshMemories = useCallback(async () => {
    await loadMemories()
  }, [loadMemories])

  useEffect(() => {
    if (autoLoad) {
      loadMemories()
    }
  }, [autoLoad, loadMemories])

  return {
    memories,
    loading,
    error,
    loadMemories,
    refreshMemories,
  }
}








