import { motion, AnimatePresence } from 'framer-motion'
import { useState, memo, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Edit, Trash2, X, Sparkles, Smile, Heart, Lightbulb, TrendingUp, Mountain,
  HelpCircle, Zap, Clock,
} from 'lucide-react'
import { Memory } from '../types'
import { hapticFeedback } from '../utils/haptic'
import { useLongPress } from '../hooks/useLongPress'
import ProgressiveImage from './ProgressiveImage'

// Category icon/color mapping
const CATEGORY_META: Record<string, { icon: typeof Sparkles; color: string }> = {
  success: { icon: Sparkles, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300' },
  peace: { icon: Smile, color: 'text-sky-600 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300' },
  fun: { icon: Smile, color: 'text-pink-600 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-300' },
  love: { icon: Heart, color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300' },
  gratitude: { icon: Heart, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300' },
  inspiration: { icon: Lightbulb, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300' },
  growth: { icon: TrendingUp, color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300' },
  adventure: { icon: Mountain, color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300' },
  uncategorized: { icon: Sparkles, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300' },
}

function getRelativeTime(dateStr: string, locale: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  // Extract just the date part (YYYY-MM-DD) to avoid timezone issues
  const dateOnly = dateStr.split('T')[0]
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  
  // Parse dates as local dates (not UTC) to avoid timezone issues
  const [year, month, day] = dateOnly.split('-').map(Number)
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number)
  
  const date = new Date(year, month - 1, day)
  const today = new Date(todayYear, todayMonth - 1, todayDay)
  
  const diffTime = today.getTime() - date.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return t('today', { defaultValue: 'Bugün' })
  if (diffDays === 1) return t('yesterday', { defaultValue: 'Dün' })
  if (diffDays < 7) return t('daysAgo', { count: diffDays, defaultValue: `${diffDays} gün önce` })

  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface MemoryCardProps {
  memory: Memory
  index: number
  bulkMode: boolean
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onImageClick: (images: string[], index: number) => void
}

function MemoryCard({
  memory,
  index,
  bulkMode,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onImageClick,
}: MemoryCardProps) {
  const { t, i18n } = useTranslation()
  const locale = (i18n?.language || 'tr').startsWith('tr') ? 'tr-TR' : 'en-US'
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [isLongPressing, setIsLongPressing] = useState(false)

  const isLocalUser = memory.userId?.startsWith('local-')

  const catMeta = CATEGORY_META[memory.category] || CATEGORY_META.uncategorized
  const CatIcon = catMeta.icon

  // Only show sync badge if memory has been unsynced for more than 5 minutes
  const isSyncStale = useMemo(() => {
    if (memory.synced) return false
    const createdAt = new Date(memory.createdAt).getTime()
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    return createdAt < fiveMinutesAgo
  }, [memory.synced, memory.createdAt])

  const relativeDate = useMemo(
    () => getRelativeTime(memory.date, locale, t),
    [memory.date, locale, t]
  )

  const longPressHandlers = useLongPress({
    onLongPress: (e) => {
      if (bulkMode) return
      setIsLongPressing(true)
      hapticFeedback('medium')

      if ('touches' in e && e.touches.length > 0) {
        setContextMenuPosition({ x: e.touches[0].clientX, y: e.touches[0].clientY })
      } else {
        setContextMenuPosition({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY })
      }

      setShowContextMenu(true)
      setTimeout(() => setIsLongPressing(false), 200)
    },
    onClick: () => {},
    delay: 500,
  })

  const handleContextAction = (action: () => void) => {
    setShowContextMenu(false)
    action()
  }

  return (
    <div className="container-responsive">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: isLongPressing ? 0.98 : 1,
        }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ delay: Math.min(index * 0.04, 0.4) }}
        className={`bg-white dark:bg-gray-800 border-2 rounded-2xl p-5 sm:p-6 hover:shadow-xl transition-all duration-300 touch-manipulation memory-card-responsive relative ${
          bulkMode
            ? isSelected
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 dark:border-gray-700'
            : 'border-gray-200 dark:border-gray-700 hover:border-primary/30'
        }`}
        onClick={() => bulkMode && onSelect()}
        onTouchStart={(e) => { longPressHandlers.onTouchStart(e) }}
        onTouchMove={(e) => { longPressHandlers.onTouchMove(e) }}
        onTouchEnd={(e) => { longPressHandlers.onTouchEnd(e) }}
        onMouseDown={longPressHandlers.onMouseDown}
        onMouseUp={longPressHandlers.onMouseUp}
        onMouseLeave={longPressHandlers.onMouseLeave}
      >
        {/* Long press ripple */}
        {isLongPressing && (
          <motion.div
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-primary/20 rounded-2xl pointer-events-none"
          />
        )}

        {/* Bulk select */}
        {bulkMode && (
          <div className="flex items-center mb-4">
            {isSelected ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-primary">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </motion.div>
            ) : (
              <div className="w-6 h-6 border-2 border-gray-400 rounded" />
            )}
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {isSelected ? t('selected') : t('clickToSelect')}
            </span>
          </div>
        )}

        {/* Status badges row - sync badge only shows after 5 min */}
        {(isSyncStale || memory.conflict || memory.isCore) && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {memory.isCore && (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-gradient-to-r from-primary to-primary-dark text-white px-2.5 py-1 rounded-full shadow-sm">
                ⭐ {t('coreMemory')}
              </span>
            )}
            {isSyncStale && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 px-2.5 py-1 rounded-full">
                <Clock size={11} /> {t('syncPending', { defaultValue: 'Senkron bekliyor' })}
              </span>
            )}
            {memory.conflict && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 px-2.5 py-1 rounded-full">
                ⚠ {t('conflict', { defaultValue: 'Çakışma' })}
              </span>
            )}
          </div>
        )}

        {/* Memory text */}
        <p className="text-gray-800 dark:text-gray-200 mb-4 leading-relaxed text-[15px]">{memory.text}</p>

        {/* Photos grid */}
        {memory.photos.length > 0 && (
          <div className={`grid gap-2 mb-4 rounded-xl overflow-hidden ${
            memory.photos.length === 1 ? 'grid-cols-1' : memory.photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
          }`}>
            {memory.photos.map((photo, idx) => (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`rounded-lg cursor-pointer touch-manipulation overflow-hidden bg-gray-100 dark:bg-gray-700 ${
                  memory.photos.length === 1 ? 'h-48' : 'h-28'
                }`}
                onClick={() => {
                  hapticFeedback('light')
                  onImageClick(memory.photos, idx)
                }}
              >
                <ProgressiveImage
                  src={photo}
                  alt={t('photo') + ` ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full"
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Tags row - category, lifeArea, intensity, connections */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {/* Category badge with icon */}
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${catMeta.color} ${
            memory.category === 'uncategorized' && !isSyncStale && !isLocalUser ? 'animate-pulse' : ''
          }`}>
            <CatIcon size={12} />
            {memory.category === 'uncategorized'
              ? (isLocalUser
                ? t('aiyaLoginToClassify', { defaultValue: 'Giriş yapın, Aiya sınıflandırsın' })
                : (!isSyncStale
                  ? t('aiyaClassifying', { defaultValue: 'Aiya kategorize ediyor...' })
                  : t(`categories.${memory.category}`)))
              : t(`categories.${memory.category}`)}
          </span>

          {/* Life area (only show if not uncategorized) */}
          {memory.lifeArea !== 'uncategorized' && (
            <span className="inline-flex items-center text-[11px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
              {t(`lifeAreas.${memory.lifeArea}`)}
            </span>
          )}

          {/* Intensity */}
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-primary/8 text-primary px-2.5 py-1 rounded-full">
            <Zap size={11} />
            {memory.intensity}/10
          </span>

          {/* Connections */}
          {memory.connections.map((conn, idx) => (
            <span key={idx} className="inline-flex items-center text-[11px] font-semibold bg-primary/8 text-primary px-2.5 py-1 rounded-full">
              {conn}
            </span>
          ))}
        </div>

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium min-w-0 truncate">
            {relativeDate}
          </span>
          <div className="flex items-center gap-0.5">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleContextAction(onEdit)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors touch-manipulation"
              aria-label={t('edit')}
              title={t('edit')}
            >
              <Edit size={16} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleContextAction(onDelete)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-manipulation"
              aria-label={t('delete')}
              title={t('delete')}
            >
              <Trash2 size={16} />
            </motion.button>
          </div>
        </div>

        {/* Context Menu */}
        <AnimatePresence>
          {showContextMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40"
                onClick={() => setShowContextMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 5 }}
                className="fixed z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1.5 min-w-[170px] overflow-hidden"
                style={{
                  left: `${Math.min(contextMenuPosition.x, window.innerWidth - 200)}px`,
                  top: `${Math.min(contextMenuPosition.y, window.innerHeight - 200)}px`,
                  transform: 'translate(-50%, -10px)',
                }}
              >
                <button
                  onClick={() => handleContextAction(onEdit)}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors text-sm font-medium"
                >
                  <Edit size={16} className="text-primary" />
                  <span>{t('edit')}</span>
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700 mx-2" />
                <button
                  onClick={() => handleContextAction(onDelete)}
                  className="w-full px-4 py-2.5 text-left hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors text-sm font-medium text-red-500"
                >
                  <Trash2 size={16} />
                  <span>{t('delete')}</span>
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700 mx-2" />
                <button
                  onClick={() => setShowContextMenu(false)}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors text-sm"
                >
                  <X size={16} className="text-gray-500" />
                  <span>{t('cancel')}</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

export default memo(MemoryCard, (prevProps, nextProps) => {
  if (prevProps.memory !== nextProps.memory) {
    const memoryChanged =
      prevProps.memory.id !== nextProps.memory.id ||
      prevProps.memory.text !== nextProps.memory.text ||
      prevProps.memory.date !== nextProps.memory.date ||
      prevProps.memory.intensity !== nextProps.memory.intensity ||
      prevProps.memory.category !== nextProps.memory.category ||
      prevProps.memory.lifeArea !== nextProps.memory.lifeArea ||
      prevProps.memory.isCore !== nextProps.memory.isCore ||
      prevProps.memory.synced !== nextProps.memory.synced ||
      prevProps.memory.conflict !== nextProps.memory.conflict ||
      prevProps.memory.photos.length !== nextProps.memory.photos.length ||
      prevProps.memory.connections.length !== nextProps.memory.connections.length ||
      prevProps.memory.photos.some((photo, idx) => photo !== nextProps.memory.photos[idx]) ||
      prevProps.memory.connections.some((conn, idx) => conn !== nextProps.memory.connections[idx])

    if (memoryChanged) return false
  }

  if (
    prevProps.index !== nextProps.index ||
    prevProps.bulkMode !== nextProps.bulkMode ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.onSelect !== nextProps.onSelect ||
    prevProps.onEdit !== nextProps.onEdit ||
    prevProps.onDelete !== nextProps.onDelete ||
    prevProps.onImageClick !== nextProps.onImageClick
  ) {
    return false
  }

  return true
})
