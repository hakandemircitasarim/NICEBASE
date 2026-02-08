import { motion } from 'framer-motion'
import { Archive, CheckSquare, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface VaultHeaderProps {
  bulkMode: boolean
  selectedCount: number
  onToggleBulkMode: () => void
  onSelectAll: () => void
  onBulkDelete: () => void
  onCancelBulk: () => void
  onAddMemory: () => void
}

export default function VaultHeader({
  bulkMode,
  selectedCount,
  onToggleBulkMode,
  onSelectAll,
  onBulkDelete,
  onCancelBulk,
  onAddMemory,
}: VaultHeaderProps) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-8 sm:mb-10"
    >
      <div className="row-left">
        <Archive className="text-primary" size={32} />
        <h1 className="font-bold">{t('vault')}</h1>
      </div>
      <div className="row-right flex-wrap justify-end">
        {bulkMode && (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSelectAll}
              className="px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            >
              {t('selectAll', { defaultValue: 'Tümünü Seç' })}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBulkDelete}
              disabled={selectedCount === 0}
              className="px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('deleteSelected', { defaultValue: 'Seçilenleri Sil' })} ({selectedCount})
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCancelBulk}
              className="px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            >
              {t('cancel')}
            </motion.button>
          </>
        )}
        {!bulkMode && (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleBulkMode}
              className="icon-btn border-2 border-gray-200 dark:border-gray-600 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all touch-manipulation"
              aria-label={t('bulkSelection')}
            >
              <CheckSquare size={20} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddMemory}
              className="gradient-primary text-white px-4 sm:px-6 py-3 rounded-xl flex items-center gap-2 font-semibold hover:shadow-xl transition-all touch-manipulation"
              aria-label={t('addMemoryAriaLabel')}
              title={t('addMemory')}
            >
              <Plus size={20} />
              <span className="hidden sm:inline">{t('addMemory')}</span>
              <span className="sm:hidden">{t('add')}</span>
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  )
}








