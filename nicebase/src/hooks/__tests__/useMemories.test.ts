import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { Memory } from '../../types'

const getAll = vi.fn<(userId: string) => Promise<Memory[]>>()

vi.mock('../../services/memoryService', () => ({
  memoryService: { getAll: (userId: string) => getAll(userId) },
}))
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

import { useMemories } from '../useMemories'
import { useStore } from '../../store/useStore'

describe('useMemories hasLoaded', () => {
  beforeEach(() => {
    getAll.mockReset()
  })

  it('starts false before the first load finishes', () => {
    getAll.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useMemories('user-1'))
    expect(result.current.hasLoaded).toBe(false)
  })

  it('becomes true after an instant empty load (the stuck-spinner case)', async () => {
    getAll.mockResolvedValue([])
    const { result } = renderHook(() => useMemories('user-1'))
    await waitFor(() => expect(result.current.hasLoaded).toBe(true))
    expect(result.current.loading).toBe(false)
    expect(result.current.memories).toEqual([])
  })

  it('becomes true when the load fails', async () => {
    getAll.mockRejectedValue(new Error('IndexedDB unavailable'))
    const { result } = renderHook(() => useMemories('user-1'))
    await waitFor(() => expect(result.current.hasLoaded).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('re-queries when the memories refresh signal is bumped', async () => {
    getAll.mockResolvedValue([])
    const { result } = renderHook(() => useMemories('user-1'))
    await waitFor(() => expect(result.current.hasLoaded).toBe(true))

    const pulled = { id: 'm1', userId: 'user-1', text: 'from cloud' } as Memory
    getAll.mockResolvedValue([pulled])
    act(() => useStore.getState().bumpMemoriesRefresh())

    await waitFor(() => expect(result.current.memories).toEqual([pulled]))
  })
})
