import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Heart, Maximize2, Minimize2, Share2, Download, X } from 'lucide-react'
import { Memory } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import { useSwipe } from '../hooks/useSwipe'
import ImageModal from '../components/ImageModal'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import { useNotifications } from '../hooks/useNotifications'
import { useLocation, useNavigate } from 'react-router-dom'
import { buildConnectionDisplayMap, normalizeConnectionKey } from '../utils/connections'

type ConnectionOption = { key: string; label: string }

export default function RelationshipSaver() {
  const { t } = useTranslation()
  const userId = useUserId()
  const location = useLocation()
  const navigate = useNavigate()
  const { memories, loading } = useMemories(userId)
  const { hapticFeedback } = useNotifications()
  const [connections, setConnections] = useState<ConnectionOption[]>([])
  const [selectedConnectionKey, setSelectedConnectionKey] = useState<string>('')
  const [filteredMemories, setFilteredMemories] = useState<Memory[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showImageModal, setShowImageModal] = useState(false)
  const [requestedConnectionKey, setRequestedConnectionKey] = useState<string>('')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const autoPlayIntervalRef = useRef<NodeJS.Timeout | null>(null)

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
    setCurrentIndex(prev => prev < filteredMemories.length - 1 ? prev + 1 : prev)
  }

  const prevMemory = () => {
    setCurrentIndex(prev => prev > 0 ? prev - 1 : prev)
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

  // Auto-play functionality
  useEffect(() => {
    if (autoPlay && filteredMemories.length > 0 && currentIndex < filteredMemories.length - 1) {
      autoPlayIntervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev < filteredMemories.length - 1) {
            return prev + 1
          }
          // Reached the end, stop autoplay
          setAutoPlay(false)
          return prev
        })
      }, 5000) // 5 seconds per memory
    } else {
      if (autoPlayIntervalRef.current) {
        clearInterval(autoPlayIntervalRef.current)
        autoPlayIntervalRef.current = null
      }
    }
    return () => {
      if (autoPlayIntervalRef.current) {
        clearInterval(autoPlayIntervalRef.current)
      }
    }
  }, [autoPlay, filteredMemories.length, currentIndex])

  // Full-screen mode
  useEffect(() => {
    if (isFullScreen) {
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [isFullScreen])

  // Share functionality
  const handleShare = async () => {
    if (!currentMemory) return
    
    const connectionName = connections.find(c => c.key === selectedConnectionKey)?.label || 'Connection'
    const shareText = `${t('shareMemoryCount', { connection: connectionName, count: filteredMemories.length })}\n\n"${currentMemory.text.substring(0, 100)}${currentMemory.text.length > 100 ? '...' : ''}"\n\n${t('shareTagline')}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: t('shareTitle', { connection: connectionName }),
          text: shareText,
          url: window.location.href,
        })
        toast.success(t('shared', { defaultValue: 'Paylaşıldı!' }), { duration: 2000 })
      } catch (error) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText + '\n' + window.location.href)
        toast.success(t('copiedToClipboard', { defaultValue: 'Panoya kopyalandı!' }), { duration: 2000 })
      } catch (error) {
        toast.error(t('shareError', { defaultValue: 'Paylaşım hatası' }))
      }
    }
  }

  // Export as text
  const handleExport = () => {
    if (filteredMemories.length === 0) return
    
    const connectionName = connections.find(c => c.key === selectedConnectionKey)?.label || 'Connection'
    let exportText = `${t('shareTitle', { connection: connectionName })}\n`
    exportText += `${'='.repeat(40)}\n\n`

    filteredMemories.forEach((memory, index) => {
      exportText += `${t('exportMemoryLabel')} ${index + 1}/${filteredMemories.length}\n`
      exportText += `${t('exportDateLabel')}: ${new Date(memory.date).toLocaleDateString()}\n`
      exportText += `${t('exportIntensityLabel')}: ${memory.intensity}/10\n`
      exportText += `${t('exportCategoryLabel')}: ${t(`categories.${memory.category}`)}\n`
      exportText += `\n${memory.text}\n\n`
      exportText += `${'-'.repeat(40)}\n\n`
    })
    
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${connectionName}_anilari_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(t('exported', { defaultValue: 'Dışa aktarıldı!' }), { duration: 2000 })
  }

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
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent mb-2">
          {t('relationshipSaver')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
          {t('relationshipSaverDescription')}
        </p>
      </motion.div>

      {connections.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20 px-4"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="mb-6"
          >
            <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-orange-500/20 flex items-center justify-center">
              <Heart className="text-primary dark:text-orange-400" size={48} />
            </div>
          </motion.div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {t('noConnections')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-base mb-8 max-w-md mx-auto leading-relaxed">
            {t('noConnectionsDescription')}
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              hapticFeedback('light')
              navigate('/vault?action=add')
            }}
            className="px-8 py-4 gradient-primary text-white rounded-2xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all touch-manipulation"
          >
            {t('addMemory')}
          </motion.button>
        </motion.div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <label className="block text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">
              {t('selectConnection')}
            </label>
            <div className="flex flex-wrap gap-2">
              {connections.map(conn => {
                const isActive = conn.key === selectedConnectionKey
                return (
                  <motion.button
                    key={conn.key}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedConnectionKey(isActive ? '' : conn.key)
                      hapticFeedback('light')
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all touch-manipulation border-2 ${
                      isActive
                        ? 'gradient-primary text-white border-transparent shadow-lg shadow-primary/25'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary/30'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Heart size={14} className={isActive ? 'text-white' : 'text-primary'} />
                      {conn.label}
                    </span>
                  </motion.button>
                )
              })}
            </div>
            {connections.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {t('noConnections', { defaultValue: 'Henüz bağlantı yok' })}
              </p>
            )}
          </motion.div>

          {selectedConnectionKey && filteredMemories.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20 px-4"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="mb-6"
              >
                <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-orange-500/20 flex items-center justify-center">
                  <Heart className="text-primary dark:text-orange-400" size={40} />
                </div>
              </motion.div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                {t('noMemoriesForConnection')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-base max-w-md mx-auto leading-relaxed">
                {t('noMemoriesForConnectionDescription')}
              </p>
            </motion.div>
          )}

          {selectedConnectionKey && (
            <>
              {/* Controls */}
              <div className="flex items-center justify-between mb-6 gap-3">
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      hapticFeedback('light')
                      setIsFullScreen(!isFullScreen)
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all touch-manipulation flex items-center gap-2 shadow-sm"
                    aria-label={isFullScreen ? t('exitFullScreen', { defaultValue: 'Tam ekrandan çık' }) : t('enterFullScreen', { defaultValue: 'Tam ekran' })}
                  >
                    {isFullScreen ? <Minimize2 size={18} className="text-gray-600 dark:text-gray-300" /> : <Maximize2 size={18} className="text-gray-600 dark:text-gray-300" />}
                    <span className="text-sm font-semibold hidden sm:inline text-gray-700 dark:text-gray-300">
                      {isFullScreen ? t('exitFullScreen', { defaultValue: 'Çık' }) : t('enterFullScreen', { defaultValue: 'Tam Ekran' })}
                    </span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      hapticFeedback('light')
                      setAutoPlay(!autoPlay)
                    }}
                    className={`px-4 py-2.5 rounded-xl transition-all touch-manipulation flex items-center gap-2 shadow-sm ${
                      autoPlay
                        ? 'bg-gradient-to-r from-primary to-orange-500 text-white border-2 border-transparent'
                        : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 text-gray-700 dark:text-gray-300'
                    }`}
                    aria-label={autoPlay ? t('stopAutoPlay', { defaultValue: 'Otomatik oynatmayı durdur' }) : t('startAutoPlay', { defaultValue: 'Otomatik oynat' })}
                  >
                    <span className="text-base font-bold">{autoPlay ? '⏸' : '▶'}</span>
                    <span className="text-sm font-semibold hidden sm:inline">
                      {autoPlay ? t('pause', { defaultValue: 'Duraklat' }) : t('play', { defaultValue: 'Oynat' })}
                    </span>
                  </motion.button>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleShare}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all touch-manipulation flex items-center gap-2 shadow-sm"
                    aria-label={t('share')}
                  >
                    <Share2 size={18} className="text-gray-600 dark:text-gray-300" />
                    <span className="text-sm font-semibold hidden sm:inline text-gray-700 dark:text-gray-300">{t('share')}</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleExport}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all touch-manipulation flex items-center gap-2 shadow-sm"
                    aria-label={t('export')}
                  >
                    <Download size={18} className="text-gray-600 dark:text-gray-300" />
                    <span className="text-sm font-semibold hidden sm:inline text-gray-700 dark:text-gray-300">{t('export')}</span>
                  </motion.button>
                </div>
              </div>

              {/* Full-screen overlay */}
              {isFullScreen && (
                <div
                  className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4"
                  onClick={() => setIsFullScreen(false)}
                >
                  <button
                    onClick={() => setIsFullScreen(false)}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors flex items-center justify-center z-10"
                    aria-label={t('close')}
                  >
                    <X size={20} />
                  </button>
                  <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
                    {currentMemory && (
                      <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white dark:bg-gray-800 rounded-3xl p-8 min-h-[60vh] flex flex-col"
                        {...swipeHandlers}
                      >
                        {currentMemory.photos.length > 0 && (
                          <div className="mb-6">
                            <img
                              src={currentMemory.photos[0]}
                              alt={t('memory')}
                              className="w-full h-96 object-cover rounded-2xl"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <p className="text-2xl text-gray-800 dark:text-gray-200 mb-6 flex-1">
                          {currentMemory.text}
                        </p>
                        <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              hapticFeedback('light')
                              prevMemory()
                            }}
                            disabled={currentIndex === 0}
                            className="px-6 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl disabled:opacity-50 touch-manipulation"
                          >
                            <ChevronLeft size={24} />
                          </button>
                          <span className="text-lg text-white/80">
                            {currentIndex + 1} / {filteredMemories.length}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              hapticFeedback('light')
                              nextMemory()
                            }}
                            disabled={currentIndex === filteredMemories.length - 1}
                            className="px-6 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl disabled:opacity-50 touch-manipulation"
                          >
                            <ChevronRight size={24} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* Regular view */}
              <AnimatePresence mode="wait">
                {currentMemory && !isFullScreen && (
            <motion.div 
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative bg-gradient-to-br from-white via-white to-primary/5 dark:from-gray-800 dark:via-gray-800 dark:to-primary/10 border-2 border-gray-200 dark:border-gray-700 rounded-3xl p-6 sm:p-8 min-h-[400px] flex flex-col touch-manipulation shadow-xl hover:shadow-2xl transition-all overflow-hidden"
              {...swipeHandlers}
            >
              {/* Decorative gradient overlay */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-orange-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
              <div className="flex-1 relative z-10">
                {currentMemory.photos.length > 0 && (
                  <div className="mb-6">
                    <motion.img
                      src={currentMemory.photos[0]}
                      alt={t('memory')}
                      loading="lazy"
                      className="w-full h-64 object-cover rounded-2xl cursor-pointer touch-manipulation bg-gray-100 dark:bg-gray-700 shadow-lg"
                      whileTap={{ scale: 0.98 }}
                      onError={(e) => {
                        const target = e.currentTarget
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="20"%3E%F0%9F%93%B7%3C/text%3E%3C/svg%3E'
                        target.className = target.className + ' opacity-50'
                        target.alt = t('imageLoadError')
                      }}
                      onClick={() => {
                        hapticFeedback('light')
                        setShowImageModal(true)
                      }}
                    />
                  </div>
                )}
                
                <p className="text-lg sm:text-xl text-gray-800 dark:text-gray-100 mb-6 leading-relaxed font-medium">
                  {currentMemory.text}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs font-semibold bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 text-primary dark:text-primary-light px-3 py-1.5 rounded-full border border-primary/20">
                    {t(`categories.${currentMemory.category}`)}
                  </span>
                  <span className="text-xs font-semibold bg-gradient-to-r from-orange-500/10 to-orange-500/5 dark:from-orange-500/20 dark:to-orange-500/10 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-full border border-orange-500/20">
                    {currentMemory.intensity}/10
                  </span>
                  <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full">
                    {new Date(currentMemory.date).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 relative z-10">
                <motion.button
                  onClick={() => {
                    hapticFeedback('light')
                    prevMemory()
                  }}
                  disabled={currentIndex === 0}
                  whileHover={currentIndex > 0 ? { scale: 1.05 } : {}}
                  whileTap={currentIndex > 0 ? { scale: 0.95 } : {}}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl disabled:opacity-50 touch-manipulation font-medium text-gray-700 dark:text-gray-300 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm"
                  aria-label={t('previous')}
                >
                  <ChevronLeft size={20} />
                  <span className="hidden sm:inline">{t('previous')}</span>
                </motion.button>

                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full" aria-label={`${currentIndex + 1} / ${filteredMemories.length}`}>
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
                  className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl disabled:opacity-50 touch-manipulation font-medium text-gray-700 dark:text-gray-300 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm"
                  aria-label={t('next')}
                >
                  <span className="hidden sm:inline">{t('next')}</span>
                  <ChevronRight size={20} />
                </motion.button>
              </div>
            </motion.div>
            )}
            </AnimatePresence>
            </>
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

