import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { Memory } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import { useSwipe } from '../hooks/useSwipe'
import ImageModal from '../components/ImageModal'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import { useNotifications } from '../hooks/useNotifications'
import { useLocation } from 'react-router-dom'
import { buildConnectionDisplayMap, normalizeConnectionKey } from '../utils/connections'

type ConnectionOption = { key: string; label: string }

export default function RelationshipSaver() {
  const { t } = useTranslation()
  const userId = useUserId()
  const location = useLocation()
  const { memories, loading } = useMemories(userId)
  const { hapticFeedback } = useNotifications()
  const [connections, setConnections] = useState<ConnectionOption[]>([])
  const [selectedConnectionKey, setSelectedConnectionKey] = useState<string>('')
  const [filteredMemories, setFilteredMemories] = useState<Memory[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showImageModal, setShowImageModal] = useState(false)
  const [requestedConnectionKey, setRequestedConnectionKey] = useState<string>('')

  useEffect(() => {
    // Extract unique connections from memories
    const map = buildConnectionDisplayMap(memories.flatMap(m => m.connections))
    const options = Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    setConnections(options)
  }, [memories])

  useEffect(() => {
    if (selectedConnectionKey) {
      const filtered = memories.filter(m => m.connections.some(c => normalizeConnectionKey(c) === selectedConnectionKey))
      setFilteredMemories(filtered)
      setCurrentIndex(0)
    } else {
      setFilteredMemories([])
      setCurrentIndex(0)
    }
  }, [selectedConnectionKey, memories])

  // Read connection from query string: /relationship-saver?connection=Ceyda
  useEffect(() => {
    const conn = new URLSearchParams(location.search).get('connection')
    setRequestedConnectionKey(conn ? normalizeConnectionKey(conn) : '')
  }, [location.search])

  // Apply requested connection once options are ready
  useEffect(() => {
    if (!requestedConnectionKey) return
    const exists = connections.some(c => c.key === requestedConnectionKey)
    if (exists) setSelectedConnectionKey(requestedConnectionKey)
  }, [connections, requestedConnectionKey])


  // Helper functions - must be defined before useSwipe
  const nextMemory = () => {
    if (currentIndex < filteredMemories.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const prevMemory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  // Always call useSwipe at component level to maintain hooks order
  // Use current values from state, not computed values
  const swipeHandlers = useSwipe({
    onSwipeLeft: filteredMemories.length > 0 && currentIndex < filteredMemories.length - 1 ? () => {
      hapticFeedback('light')
      nextMemory()
    } : filteredMemories.length > 0 ? () => {
      hapticFeedback('warning')
      toast(t('lastMemory'), { duration: 1500, icon: 'ℹ️' })
    } : undefined,
    onSwipeRight: filteredMemories.length > 0 && currentIndex > 0 ? () => {
      hapticFeedback('light')
      prevMemory()
    } : filteredMemories.length > 0 ? () => {
      hapticFeedback('warning')
      toast(t('firstMemory'), { duration: 1500, icon: 'ℹ️' })
    } : undefined,
  })

  // currentMemory is computed here for use in render
  const currentMemory = filteredMemories[currentIndex]

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div 
      className="max-w-4xl mx-auto px-4 py-8"
    >
      <h1 className="text-3xl font-bold mb-6">{t('relationshipSaver')}</h1>

      {connections.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 px-4"
        >
          <Heart className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={64} />
          <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
            {t('noConnections')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-base mb-6">
            {t('noConnectionsDescription')}
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              hapticFeedback('light')
              window.location.href = '/vault?action=add'
            }}
            className="px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg transition-all touch-manipulation"
          >
            {t('addMemory')}
          </motion.button>
        </motion.div>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">{t('selectConnection')}</label>
            <select
              value={selectedConnectionKey}
              onChange={(e) => setSelectedConnectionKey(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">{t('selectConnectionPlaceholder')}</option>
              {connections.map(conn => (
                <option key={conn.key} value={conn.key}>{conn.label}</option>
              ))}
            </select>
          </div>

          {selectedConnectionKey && filteredMemories.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16 px-4"
            >
              <Heart className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={64} />
              <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                {t('noMemoriesForConnection')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-base">
                {t('noMemoriesForConnectionDescription')}
              </p>
            </motion.div>
          )}

          {selectedConnectionKey && (
            <AnimatePresence mode="wait">
              {currentMemory && (
            <motion.div 
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 sm:p-8 min-h-[400px] flex flex-col touch-manipulation"
              {...swipeHandlers}
            >
              <div className="flex-1">
                {currentMemory.photos.length > 0 && (
                  <div className="mb-6">
                    <motion.img
                      src={currentMemory.photos[0]}
                      alt={t('memory')}
                      loading="lazy"
                      className="w-full h-64 object-cover rounded-xl cursor-pointer touch-manipulation bg-gray-100 dark:bg-gray-700"
                      whileTap={{ scale: 0.98 }}
                      onError={(e) => {
                        const target = e.currentTarget
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="12"%3EGörsel yüklenemedi%3C/text%3E%3C/svg%3E'
                        target.className = target.className + ' opacity-50'
                      }}
                      onClick={() => {
                        hapticFeedback('light')
                        setShowImageModal(true)
                      }}
                    />
                  </div>
                )}
                
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                  {currentMemory.text}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {t(`categories.${currentMemory.category}`)}
                  </span>
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {currentMemory.intensity}/10
                  </span>
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {new Date(currentMemory.date).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <motion.button
                  onClick={() => {
                    hapticFeedback('light')
                    prevMemory()
                  }}
                  disabled={currentIndex === 0}
                  whileHover={currentIndex > 0 ? { scale: 1.05 } : {}}
                  whileTap={currentIndex > 0 ? { scale: 0.95 } : {}}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50 touch-manipulation"
                  aria-label={t('previous')}
                >
                  <ChevronLeft size={20} />
                  <span className="hidden sm:inline">{t('previous')}</span>
                </motion.button>

                <span className="text-sm text-gray-500" aria-label={`${currentIndex + 1} / ${filteredMemories.length}`}>
                  {currentIndex + 1} / {filteredMemories.length}
                </span>

                <motion.button
                  onClick={() => {
                    hapticFeedback('light')
                    nextMemory()
                  }}
                  disabled={currentIndex === filteredMemories.length - 1}
                  whileHover={currentIndex < filteredMemories.length - 1 ? { scale: 1.05 } : {}}
                  whileTap={currentIndex < filteredMemories.length - 1 ? { scale: 0.95 } : {}}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50 touch-manipulation"
                  aria-label={t('next')}
                >
                  <span className="hidden sm:inline">{t('next')}</span>
                  <ChevronRight size={20} />
                </motion.button>
              </div>
            </motion.div>
            )}
            </AnimatePresence>
          )}
        </>
      )}

      {showImageModal && currentMemory && currentMemory.photos.length > 0 && (
        <ImageModal
          images={currentMemory.photos}
          currentIndex={0}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </div>
  )
}

