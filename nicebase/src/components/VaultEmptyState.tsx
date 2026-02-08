import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Archive, Plus } from 'lucide-react'

interface VaultEmptyStateProps {
  hasFilters: boolean
  onClearFilters: () => void
  onAddMemory: () => void
}

export default function VaultEmptyState({
  hasFilters,
  onClearFilters,
  onAddMemory,
}: VaultEmptyStateProps) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 sm:py-20 px-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring' }}
        className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-primary/20 to-primary-dark/20 rounded-full flex items-center justify-center mb-6"
      >
        <Archive className="w-12 h-12 sm:w-16 sm:h-16 text-primary" />
      </motion.div>
      <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
        {hasFilters ? t('noMemoriesFound') : t('noMemories')}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-md leading-relaxed">
        {hasFilters ? t('noMemoriesFoundDescription') : t('addFirstMemoryDescription')}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        {hasFilters && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClearFilters}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl font-semibold hover:shadow-lg transition-all touch-manipulation min-h-[48px]"
          >
            {t('clearFilters')}
          </motion.button>
        )}
        {!hasFilters && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAddMemory}
            className="gradient-primary text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all touch-manipulation min-h-[48px] flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            {t('addMemory')}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}







