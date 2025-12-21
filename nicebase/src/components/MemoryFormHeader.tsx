import type React from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import { hapticFeedback } from '../utils/haptic'

interface MemoryFormHeaderProps {
  isEditMode: boolean
  simpleMode: boolean
  onToggleMode: (simple: boolean) => void
  onClose: () => void
  showModeToggle?: boolean
  layoutId?: string
  titleId?: string
  swipeHandlers?: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: (e: React.TouchEvent) => void
  }
}

export default function MemoryFormHeader({
  isEditMode,
  simpleMode,
  onToggleMode,
  onClose,
  showModeToggle = true,
  layoutId,
  titleId,
  swipeHandlers,
}: MemoryFormHeaderProps) {
  const { t } = useTranslation()

  return (
    <motion.div
      layoutId={layoutId}
      className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sm:p-6 z-10 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95 flex-shrink-0 row-between"
      {...(swipeHandlers || {})}
    >
      <div className="row-left">
        <Sparkles className="text-primary" size={24} />
        <h2 id={titleId} className="font-bold">{isEditMode ? t('edit') : t('addMemory')}</h2>
      </div>
      <div className="row-right">
        {!isEditMode && showModeToggle && (
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                hapticFeedback('light')
                onToggleMode(true)
              }}
              className={`touch-target px-3 text-xs font-medium rounded-lg transition-all touch-manipulation ${
                simpleMode
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {t('simple')}
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback('light')
                onToggleMode(false)
              }}
              className={`touch-target px-3 text-xs font-medium rounded-lg transition-all touch-manipulation ${
                !simpleMode
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {t('advanced')}
            </button>
          </div>
        )}
        <button
          onClick={onClose}
          className="icon-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label={t('close')}
        >
          <X size={24} />
        </button>
      </div>
    </motion.div>
  )
}






