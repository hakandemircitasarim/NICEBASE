import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Memory } from '../types'
import MemoryCard from './MemoryCard'
import LoadingSpinner from './LoadingSpinner'
import { SkeletonMemoryCard } from './Skeleton'

interface VaultMemoryListProps {
  loading: boolean
  memories: Memory[]
  displayCount: number
  isLoadingMore: boolean
  bulkMode: boolean
  selectedMemories: Set<string>
  onLoadMore: () => void
  onToggleSelection: (id: string) => void
  onEdit: (memory: Memory) => void
  onDelete: (id: string) => void
  onImageClick: (images: string[], index: number) => void
}

export default function VaultMemoryList({
  loading,
  memories,
  displayCount,
  isLoadingMore,
  bulkMode,
  selectedMemories,
  onLoadMore,
  onToggleSelection,
  onEdit,
  onDelete,
  onImageClick,
}: VaultMemoryListProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="space-y-5 sm:space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonMemoryCard key={i} />
        ))}
      </div>
    )
  }

  if (memories.length === 0) {
    return null // Empty state is handled by parent
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <AnimatePresence>
        {memories.slice(0, displayCount).map((memory, index) => (
          <MemoryCard
            key={memory.id}
            memory={memory}
            index={index}
            bulkMode={bulkMode}
            isSelected={selectedMemories.has(memory.id)}
            onSelect={() => onToggleSelection(memory.id)}
            onEdit={() => onEdit(memory)}
            onDelete={() => onDelete(memory.id)}
            onImageClick={(images, idx) => onImageClick(images, idx)}
          />
        ))}
      </AnimatePresence>

      {memories.length > displayCount && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="w-full py-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl font-semibold hover:border-primary hover:bg-primary/5 transition-all touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoadingMore ? (
            <>
              <LoadingSpinner size="sm" />
              <span>{t('loading')}</span>
            </>
          ) : (
            t('loadMore', { remaining: memories.length - displayCount })
          )}
        </motion.button>
      )}
    </div>
  )
}







