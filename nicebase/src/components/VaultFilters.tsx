import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Filter,
  Calendar,
  TrendingUp,
  Sparkles,
  Heart,
  Smile,
  Briefcase,
  Users,
  Home,
  Plane,
  Activity,
} from 'lucide-react'
import { Memory, MemoryCategory, LifeArea } from '../types'
import SearchBar from './SearchBar'
import DateRangePicker from './DateRangePicker'
import Select from './Select'
import { getUniqueConnections } from '../utils/memoryUtils'

interface VaultFiltersProps {
  memories: Memory[]
  searchQuery: string
  selectedCategory: MemoryCategory | 'all'
  selectedLifeArea: LifeArea | 'all'
  sortBy: 'date' | 'intensity'
  dateRange: { start: string; end: string }
  searchConnections: string[]
  onSearchChange: (query: string) => void
  onCategoryChange: (category: MemoryCategory | 'all') => void
  onLifeAreaChange: (lifeArea: LifeArea | 'all') => void
  onSortChange: (sortBy: 'date' | 'intensity') => void
  onDateRangeChange: (start: string, end: string) => void
  onConnectionsChange: (connections: string[]) => void
}

export default function VaultFilters({
  memories,
  searchQuery,
  selectedCategory,
  selectedLifeArea,
  sortBy,
  dateRange,
  searchConnections,
  onSearchChange,
  onCategoryChange,
  onLifeAreaChange,
  onSortChange,
  onDateRangeChange,
  onConnectionsChange,
}: VaultFiltersProps) {
  const { t } = useTranslation()
  const uniqueConnections = getUniqueConnections(memories)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-5 sm:space-y-6 mb-8 sm:mb-10"
    >
      <SearchBar
        value={searchQuery}
        onChange={onSearchChange}
        placeholder={t('searchPlaceholder') || 'Ara...'}
      />

      {/* Advanced Search - Date Range */}
      <div>
        <label className="block text-sm sm:text-xs font-semibold mb-2 sm:mb-1 text-gray-700 dark:text-gray-300">
          {t('dateRange')}
        </label>
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onChange={onDateRangeChange}
        />
      </div>

      {/* Connection Filter */}
      {uniqueConnections.length > 0 && (
        <div>
          <label className="block text-sm sm:text-xs font-semibold mb-2 sm:mb-1 text-gray-700 dark:text-gray-300">
            {t('connections')}
          </label>
          <div className="flex flex-wrap gap-2 sm:gap-2">
            {uniqueConnections.map(conn => (
              <button
                key={conn}
                onClick={() => {
                  const newConnections = searchConnections.includes(conn)
                    ? searchConnections.filter(c => c !== conn)
                    : [...searchConnections, conn]
                  onConnectionsChange(newConnections)
                }}
                className={`px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-full text-sm sm:text-xs font-medium transition-all touch-manipulation ${
                  searchConnections.includes(conn)
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-primary/10'
                }`}
              >
                {conn}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-3">
        <Select
          value={selectedCategory}
          onChange={(val) => onCategoryChange(val as MemoryCategory | 'all')}
          placeholder={t('allCategories')}
          options={[
            { value: 'all', label: t('allCategories'), icon: <Filter size={18} /> },
            { value: 'success', label: t('categories.success'), icon: <Sparkles size={18} /> },
            { value: 'peace', label: t('categories.peace'), icon: <Smile size={18} /> },
            { value: 'fun', label: t('categories.fun'), icon: <Heart size={18} /> },
            { value: 'love', label: t('categories.love'), icon: <Heart size={18} /> },
          ]}
          className="w-full sm:w-auto"
        />

        <Select
          value={selectedLifeArea}
          onChange={(val) => onLifeAreaChange(val as LifeArea | 'all')}
          placeholder={t('allLifeAreas')}
          options={[
            { value: 'all', label: t('allLifeAreas'), icon: <Filter size={18} /> },
            { value: 'personal', label: t('lifeAreas.personal'), icon: <Users size={18} /> },
            { value: 'work', label: t('lifeAreas.work'), icon: <Briefcase size={18} /> },
            { value: 'relationship', label: t('lifeAreas.relationship'), icon: <Heart size={18} /> },
            { value: 'family', label: t('lifeAreas.family'), icon: <Home size={18} /> },
            { value: 'friends', label: t('lifeAreas.friends'), icon: <Users size={18} /> },
            { value: 'hobby', label: t('lifeAreas.hobby'), icon: <Sparkles size={18} /> },
            { value: 'travel', label: t('lifeAreas.travel'), icon: <Plane size={18} /> },
            { value: 'health', label: t('lifeAreas.health'), icon: <Activity size={18} /> },
          ]}
          searchable
          className="w-full sm:w-auto"
        />

        <Select
          value={sortBy}
          onChange={(val) => onSortChange(val as 'date' | 'intensity')}
          placeholder={t('sortByDate')}
          options={[
            { value: 'date', label: t('sortByDate'), icon: <Calendar size={18} /> },
            { value: 'intensity', label: t('intensity'), icon: <TrendingUp size={18} /> },
          ]}
          className="w-full sm:w-auto"
        />
      </div>
    </motion.div>
  )
}






