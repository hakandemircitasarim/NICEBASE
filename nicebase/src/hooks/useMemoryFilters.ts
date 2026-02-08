import { useMemo, useState } from 'react'
import { Memory, MemoryCategory, LifeArea } from '../types'
import { useDebounce } from './useDebounce'
import { normalizeConnectionKey } from '../utils/connections'

interface FilterOptions {
  searchQuery?: string
  selectedCategory?: MemoryCategory | 'all'
  selectedLifeArea?: LifeArea | 'all'
  sortBy?: 'date' | 'intensity'
  dateRange?: { start: string; end: string }
  searchConnections?: string[]
}

interface UseMemoryFiltersReturn {
  filteredMemories: Memory[]
  searchQuery: string
  selectedCategory: MemoryCategory | 'all'
  selectedLifeArea: LifeArea | 'all'
  sortBy: 'date' | 'intensity'
  dateRange: { start: string; end: string }
  searchConnections: string[]
  setSearchQuery: (query: string) => void
  setSelectedCategory: (category: MemoryCategory | 'all') => void
  setSelectedLifeArea: (lifeArea: LifeArea | 'all') => void
  setSortBy: (sortBy: 'date' | 'intensity') => void
  setDateRange: (range: { start: string; end: string }) => void
  setSearchConnections: (connections: string[]) => void
  clearFilters: () => void
}

/**
 * Hook for filtering and sorting memories
 * Provides optimized filtering with memoization and debounced search
 */
export function useMemoryFilters(
  memories: Memory[],
  initialOptions: FilterOptions = {}
): UseMemoryFiltersReturn {
  const [searchQuery, setSearchQuery] = useState(initialOptions.searchQuery || '')
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory | 'all'>(
    initialOptions.selectedCategory || 'all'
  )
  const [selectedLifeArea, setSelectedLifeArea] = useState<LifeArea | 'all'>(
    initialOptions.selectedLifeArea || 'all'
  )
  const [sortBy, setSortBy] = useState<'date' | 'intensity'>(
    initialOptions.sortBy || 'date'
  )
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(
    initialOptions.dateRange || { start: '', end: '' }
  )
  const [searchConnections, setSearchConnections] = useState<string[]>(
    initialOptions.searchConnections || []
  )

  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const filteredMemories = useMemo(() => {
    let filtered = [...memories]

    // Advanced Search - Text search (using debounced value)
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter(
        m =>
          m.text.toLowerCase().includes(query) ||
          m.connections.some(c => c.toLowerCase().includes(query))
      )
    }

    // Date range filter
    if (dateRange.start) {
      const startDate = new Date(dateRange.start)
      startDate.setHours(0, 0, 0, 0)
      filtered = filtered.filter(m => {
        const memoryDate = new Date(m.date)
        memoryDate.setHours(0, 0, 0, 0)
        return memoryDate >= startDate
      })
    }

    if (dateRange.end) {
      const endDate = new Date(dateRange.end)
      endDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(m => {
        const memoryDate = new Date(m.date)
        memoryDate.setHours(0, 0, 0, 0)
        return memoryDate <= endDate
      })
    }

    // Connection filter
    if (searchConnections.length > 0) {
      const selectedKeys = new Set(searchConnections.map(normalizeConnectionKey))
      filtered = filtered.filter(m => m.connections.some(c => selectedKeys.has(normalizeConnectionKey(c))))
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(m => m.category === selectedCategory)
    }

    // Life area filter
    if (selectedLifeArea !== 'all') {
      filtered = filtered.filter(m => m.lifeArea === selectedLifeArea)
    }

    // Sort
    if (sortBy === 'date') {
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } else {
      filtered.sort((a, b) => b.intensity - a.intensity)
    }

    return filtered
  }, [
    memories,
    debouncedSearchQuery,
    selectedCategory,
    selectedLifeArea,
    sortBy,
    dateRange,
    searchConnections,
  ])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedLifeArea('all')
    setSortBy('date')
    setDateRange({ start: '', end: '' })
    setSearchConnections([])
  }

  return {
    filteredMemories,
    searchQuery,
    selectedCategory,
    selectedLifeArea,
    sortBy,
    dateRange,
    searchConnections,
    setSearchQuery,
    setSelectedCategory,
    setSelectedLifeArea,
    setSortBy,
    setDateRange,
    setSearchConnections,
    clearFilters,
  }
}







