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

  const loadMemories = useCallback(async () => {
    if (!userId) return

    try {
      setLoading(true)
      setError(null)
      const allMemories = await memoryService.getAll(userId)
      setMemories(allMemories)
      onLoadCompleteRef.current?.(allMemories)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load memories')
      setError(error)
      toast.error(t('memoriesLoadError'))
    } finally {
      setLoading(false)
    }
  }, [userId, t])

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





