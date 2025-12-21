import { motion, AnimatePresence } from 'framer-motion'
import { useState, memo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit, Trash2, X } from 'lucide-react'
import { Memory } from '../types'
import { hapticFeedback } from '../utils/haptic'
import { useLongPress } from '../hooks/useLongPress'
import ProgressiveImage from './ProgressiveImage'

interface MemoryCardProps {
  memory: Memory
  index: number
  bulkMode: boolean
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onImageClick: (images: string[], index: number) => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
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
  onSwipeLeft,
  onSwipeRight,
}: MemoryCardProps) {
  const { t, i18n } = useTranslation()
  const locale = (i18n?.language || 'tr').startsWith('tr') ? 'tr-TR' : 'en-US'
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isLongPressing, setIsLongPressing] = useState(false)

  // Manual swipe handlers with intent locking (prevents accidental swipe during vertical scroll)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const touchEndRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const lockedAxisRef = useRef<'x' | 'y' | null>(null)
  const INTENT_LOCK_THRESHOLD = 12
  const SWIPE_TRIGGER_DISTANCE = 60

  const handleTouchStart = (e: React.TouchEvent) => {
    if (bulkMode) return
    touchEndRef.current = null
    lockedAxisRef.current = null
    touchStartRef.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now(),
    }
    setSwipeOffset(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (bulkMode || !touchStartRef.current) return
    const currentX = e.targetTouches[0].clientX
    const currentY = e.targetTouches[0].clientY
    const deltaX = currentX - touchStartRef.current.x
    const deltaY = currentY - touchStartRef.current.y
    
    // Determine intent once the gesture has moved enough.
    if (lockedAxisRef.current === null) {
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)
      if (absX > INTENT_LOCK_THRESHOLD && absX > absY * 1.2) {
        lockedAxisRef.current = 'x'
      } else if (absY > INTENT_LOCK_THRESHOLD && absY > absX * 1.2) {
        lockedAxisRef.current = 'y'
      }
    }

    // Only track horizontal swipes once we've locked to x.
    if (lockedAxisRef.current === 'x') {
      setSwipeOffset(deltaX)
    } else if (lockedAxisRef.current === 'y') {
      // User is scrolling; ensure the card doesn't drift.
      if (swipeOffset !== 0) setSwipeOffset(0)
    }
    
    touchEndRef.current = {
      x: currentX,
      y: currentY,
      time: Date.now(),
    }
  }

  const handleTouchEnd = () => {
    if (bulkMode || !touchStartRef.current || !touchEndRef.current) {
      setSwipeOffset(0)
      return
    }

    // Only treat as swipe when user intent was horizontal.
    if (lockedAxisRef.current !== 'x') {
      touchStartRef.current = null
      touchEndRef.current = null
      lockedAxisRef.current = null
      setSwipeOffset(0)
      return
    }

    const distanceX = touchStartRef.current.x - touchEndRef.current.x

    if (Math.abs(distanceX) > SWIPE_TRIGGER_DISTANCE) {
      if (distanceX > 0 && onSwipeLeft) {
        // Swipe left
        hapticFeedback('light')
        onSwipeLeft()
      } else if (distanceX < 0 && onSwipeRight) {
        // Swipe right
        hapticFeedback('warning')
        onSwipeRight()
      }
    }
    touchStartRef.current = null
    touchEndRef.current = null
    lockedAxisRef.current = null
    setSwipeOffset(0)
  }

  const longPressHandlers = useLongPress({
    onLongPress: (e) => {
      if (bulkMode) return
      setIsLongPressing(true)
      hapticFeedback('medium')
      
      // Get touch position for context menu
      if ('touches' in e && e.touches.length > 0) {
        setContextMenuPosition({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        })
      } else {
        setContextMenuPosition({
          x: (e as React.MouseEvent).clientX,
          y: (e as React.MouseEvent).clientY,
        })
      }
      
      setShowContextMenu(true)
      setTimeout(() => setIsLongPressing(false), 200)
    },
    onClick: () => {
      if (!bulkMode && !showContextMenu) {
        // Normal click - could be used for expanding card or other action
      }
    },
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
          x: swipeOffset,
          scale: isLongPressing ? 0.98 : 1
        }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ delay: index * 0.05 }}
        className={`bg-white dark:bg-gray-800 border-2 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 touch-manipulation memory-card-responsive relative ${
          bulkMode
            ? isSelected
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 dark:border-gray-700'
            : 'border-gray-200 dark:border-gray-700 hover:border-primary/30'
        } ${swipeOffset > 20 ? 'border-blue-500/50' : swipeOffset < -20 ? 'border-red-500/50' : ''}`}
        onClick={() => bulkMode && onSelect()}
        onTouchStart={(e) => {
          handleTouchStart(e)
          longPressHandlers.onTouchStart(e)
        }}
        onTouchMove={(e) => {
          handleTouchMove(e)
          longPressHandlers.onTouchMove(e)
        }}
        onTouchEnd={(e) => {
          handleTouchEnd()
          longPressHandlers.onTouchEnd(e)
        }}
        onMouseDown={longPressHandlers.onMouseDown}
        onMouseUp={longPressHandlers.onMouseUp}
        onMouseLeave={longPressHandlers.onMouseLeave}
      >
        {/* Swipe visual indicator */}
        {swipeOffset > 20 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: Math.min(Math.abs(swipeOffset) / 100, 0.8) }}
            className="absolute left-0 top-0 bottom-0 w-20 bg-blue-500/20 flex items-center justify-center rounded-l-2xl"
          >
            <Edit className="text-blue-500" size={24} />
          </motion.div>
        )}
        {swipeOffset < -20 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: Math.min(Math.abs(swipeOffset) / 100, 0.8) }}
            className="absolute right-0 top-0 bottom-0 w-20 bg-red-500/20 flex items-center justify-center rounded-r-2xl"
          >
            <Trash2 className="text-red-500" size={24} />
          </motion.div>
        )}
        
        {/* Long press ripple effect */}
        {isLongPressing && (
          <motion.div
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-primary/20 rounded-2xl pointer-events-none"
          />
        )}
        {bulkMode && (
          <div className="flex items-center mb-4">
            {isSelected ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-primary"
              >
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

        {(!memory.synced || memory.conflict) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {!memory.synced && (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-3 py-1.5 rounded-full">
                ⏳ {t('syncPending', { defaultValue: 'Senkron bekliyor' })}
              </span>
            )}
            {memory.conflict && (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-3 py-1.5 rounded-full">
                ⚠ {t('conflict', { defaultValue: 'Çakışma' })}
              </span>
            )}
          </div>
        )}

        {memory.isCore && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1 text-xs font-bold bg-gradient-to-r from-primary to-primary-dark text-white px-3 py-1.5 rounded-full">
              ⭐ {t('coreMemory')}
            </span>
          </div>
        )}

        <p className="text-gray-700 dark:text-gray-300 mb-5 sm:mb-6 leading-relaxed">{memory.text}</p>

        {memory.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-5 rounded-xl overflow-hidden">
            {memory.photos.map((photo, idx) => (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full h-28 rounded-lg cursor-pointer touch-manipulation overflow-hidden bg-gray-100 dark:bg-gray-700"
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

        <div className="flex flex-wrap gap-2 mb-5">
          <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full">
            {t(`categories.${memory.category}`)}
          </span>
          <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full">
            {t(`lifeAreas.${memory.lifeArea}`)}
          </span>
          <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full">
            {memory.intensity}/10 ⚡
          </span>
          {memory.connections.map((conn, idx) => (
            <span key={idx} className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full">
              {conn}
            </span>
          ))}
        </div>

        <div className="row-between text-sm pt-4 border-t border-gray-100 dark:border-gray-700">
          <span className="text-gray-500 min-w-0 truncate">
            {new Date(memory.date).toLocaleDateString(locale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          <div className="row-right">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleContextAction(onEdit)}
              className="icon-btn text-primary hover:bg-primary/10 touch-manipulation"
              aria-label={t('edit')}
              title={t('edit')}
            >
              <Edit size={20} className="sm:w-[18px] sm:h-[18px]" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleContextAction(onDelete)}
              className="icon-btn text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 touch-manipulation"
              aria-label={t('delete')}
              title={t('delete')}
            >
              <Trash2 size={20} className="sm:w-[18px] sm:h-[18px]" />
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
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 min-w-[180px]"
                style={{
                  left: `${Math.min(contextMenuPosition.x, window.innerWidth - 200)}px`,
                  top: `${Math.min(contextMenuPosition.y, window.innerHeight - 200)}px`,
                  transform: 'translate(-50%, -10px)',
                }}
              >
                <button
                  onClick={() => handleContextAction(onEdit)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                >
                  <Edit size={18} className="text-primary" />
                  <span>{t('edit')}</span>
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <button
                  onClick={() => handleContextAction(onDelete)}
                  className="w-full px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors text-red-500"
                >
                  <Trash2 size={18} />
                  <span>{t('delete')}</span>
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <button
                  onClick={() => setShowContextMenu(false)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                >
                  <X size={18} className="text-gray-500" />
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

// Memoize component to prevent unnecessary re-renders
// Only re-render if props actually change
// Comparator returns true if props are equal (skip render), false if different (should render)
export default memo(MemoryCard, (prevProps, nextProps) => {
  // Check if memory object reference changed (shallow comparison)
  if (prevProps.memory !== nextProps.memory) {
    // Deep check memory properties
    const memoryChanged =
      prevProps.memory.id !== nextProps.memory.id ||
      prevProps.memory.text !== nextProps.memory.text ||
      prevProps.memory.date !== nextProps.memory.date ||
      prevProps.memory.intensity !== nextProps.memory.intensity ||
      prevProps.memory.category !== nextProps.memory.category ||
      prevProps.memory.lifeArea !== nextProps.memory.lifeArea ||
      prevProps.memory.isCore !== nextProps.memory.isCore ||
      prevProps.memory.photos.length !== nextProps.memory.photos.length ||
      prevProps.memory.connections.length !== nextProps.memory.connections.length ||
      prevProps.memory.photos.some((photo, idx) => photo !== nextProps.memory.photos[idx]) ||
      prevProps.memory.connections.some((conn, idx) => conn !== nextProps.memory.connections[idx])
    
    if (memoryChanged) return false // Props changed, should render
  }
  
  // Check other props
  if (
    prevProps.index !== nextProps.index ||
    prevProps.bulkMode !== nextProps.bulkMode ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.onSelect !== nextProps.onSelect ||
    prevProps.onEdit !== nextProps.onEdit ||
    prevProps.onDelete !== nextProps.onDelete ||
    prevProps.onImageClick !== nextProps.onImageClick ||
    prevProps.onSwipeLeft !== nextProps.onSwipeLeft ||
    prevProps.onSwipeRight !== nextProps.onSwipeRight
  ) {
    return false // Props changed, should render
  }
  
  return true // Props are equal, skip render
})
