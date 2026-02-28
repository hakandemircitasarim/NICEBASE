import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { hapticFeedback } from '../utils/haptic'
import { useSwipe } from '../hooks/useSwipe'
import { useModalPresence } from '../hooks/useModalPresence'

interface ImageModalProps {
  images: string[]
  currentIndex: number
  onClose: () => void
}

export default function ImageModal({ images, currentIndex: initialIndex, onClose }: ImageModalProps) {
  const { t } = useTranslation()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isZoomed, setIsZoomed] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastTouchDistanceRef = useRef<number | null>(null)
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null)
  const isPanningRef = useRef(false)
  useModalPresence(true)

  useEffect(() => {
    setCurrentIndex(initialIndex)
    // Reset zoom when image changes
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setIsZoomed(false)
  }, [initialIndex])

  const nextImage = () => {
    if (currentIndex < images.length - 1 && !isZoomed) {
      hapticFeedback('light')
      setCurrentIndex(currentIndex + 1)
    }
  }

  const prevImage = () => {
    if (currentIndex > 0 && !isZoomed) {
      hapticFeedback('light')
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && !isZoomed) prevImage()
    if (e.key === 'ArrowRight' && !isZoomed) nextImage()
    if (e.key === 'Escape') {
      if (isZoomed) {
        resetZoom()
      } else {
        onClose()
      }
    }
  }

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setIsZoomed(false)
    hapticFeedback('light')
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (scale === 1) {
      const rect = imageRef.current?.getBoundingClientRect()
      if (rect && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const clickX = e.clientX - containerRect.left - containerRect.width / 2
        const clickY = e.clientY - containerRect.top - containerRect.height / 2
        setScale(2)
        setPosition({ x: -clickX, y: -clickY })
        setIsZoomed(true)
        hapticFeedback('medium')
      }
    } else {
      resetZoom()
    }
  }

  const getDistance = (touch1: React.Touch | Touch, touch2: React.Touch | Touch) => {
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
  }

  const getCenter = (touch1: React.Touch | Touch, touch2: React.Touch | Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      isPanningRef.current = false
      const distance = getDistance(e.touches[0], e.touches[1])
      lastTouchDistanceRef.current = distance
      const center = getCenter(e.touches[0], e.touches[1])
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        lastTouchCenterRef.current = {
          x: center.x - rect.left - rect.width / 2,
          y: center.y - rect.top - rect.height / 2,
        }
      }
    } else if (e.touches.length === 1 && isZoomed) {
      // Pan gesture when zoomed
      isPanningRef.current = true
      lastTouchCenterRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
      // Pinch zoom
      e.preventDefault()
      const distance = getDistance(e.touches[0], e.touches[1])
      const scaleChange = distance / lastTouchDistanceRef.current
      const newScale = Math.min(Math.max(scale * scaleChange, 1), 4)
      setScale(newScale)
      setIsZoomed(newScale > 1)

      if (lastTouchCenterRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const center = getCenter(e.touches[0], e.touches[1])
        const centerX = center.x - rect.left - rect.width / 2
        const centerY = center.y - rect.top - rect.height / 2

        setPosition({
          x: centerX - (centerX - position.x) * (newScale / scale),
          y: centerY - (centerY - position.y) * (newScale / scale),
        })
      }

      lastTouchDistanceRef.current = distance
    } else if (e.touches.length === 1 && isZoomed && isPanningRef.current && lastTouchCenterRef.current) {
      // Pan when zoomed
      e.preventDefault()
      const deltaX = e.touches[0].clientX - lastTouchCenterRef.current.x
      const deltaY = e.touches[0].clientY - lastTouchCenterRef.current.y

      setPosition((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }))

      lastTouchCenterRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    }
  }

  const handleTouchEnd = () => {
    lastTouchDistanceRef.current = null
    lastTouchCenterRef.current = null
    isPanningRef.current = false
  }

  const swipeHandlers = useSwipe({
    onSwipeLeft: images.length > 1 && currentIndex < images.length - 1 && !isZoomed ? nextImage : undefined,
    onSwipeRight: images.length > 1 && currentIndex > 0 && !isZoomed ? prevImage : undefined,
  })

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="dialog"
        aria-label={images.length > 1 ? t('imageOf', { current: currentIndex + 1, total: images.length }) : t('imageViewer')}
        aria-modal="true"
      >
        <motion.div
          ref={containerRef}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => {
            if (!isZoomed) {
              e.stopPropagation()
            } else {
              resetZoom()
            }
          }}
          className="relative max-w-4xl w-full max-h-[90dvh] overflow-hidden touch-none"
          onTouchStart={(e) => {
            handleTouchStart(e)
            swipeHandlers.onTouchStart?.(e)
          }}
          onTouchMove={(e) => {
            handleTouchMove(e)
            swipeHandlers.onTouchMove?.(e)
          }}
          onTouchEnd={() => {
            handleTouchEnd()
            swipeHandlers.onTouchEnd?.()
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors touch-manipulation"
            aria-label={t('closeImageViewer')}
          >
            <X size={24} />
          </button>

          {isZoomed && (
            <button
              onClick={resetZoom}
              className="absolute top-4 left-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors touch-manipulation"
              aria-label={t('resetZoom')}
            >
              <ZoomOut size={24} />
            </button>
          )}

          {images.length > 1 && !isZoomed && (
            <>
              {currentIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    prevImage()
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors touch-manipulation"
                  aria-label={t('previousImage')}
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              {currentIndex < images.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    nextImage()
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors touch-manipulation"
                  aria-label={t('nextImage')}
                >
                  <ChevronRight size={24} />
                </button>
              )}
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 bg-black/80 backdrop-blur-sm text-white px-6 py-3.5 rounded-full text-lg font-bold safe-area-bottom shadow-2xl">
                {currentIndex + 1} / {images.length}
              </div>
            </>
          )}

          <div
            className="w-full h-full flex items-center justify-center cursor-zoom-in"
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
              transition: isPanningRef.current ? 'none' : 'transform 0.2s ease-out',
            }}
            onDoubleClick={handleDoubleClick}
          >
            <motion.img
              ref={imageRef}
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ 
                opacity: 1, 
                scale: scale,
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={images[currentIndex]}
              alt={t('image') + ` ${currentIndex + 1}`}
              className="max-w-full max-h-[90dvh] object-contain rounded-lg select-none"
              draggable={false}
              style={{
                transformOrigin: 'center center',
                touchAction: 'none',
              }}
            />
          </div>

          {!isZoomed && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 bg-black/30 text-white px-3 py-1.5 rounded-full text-xs opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
              {t('doubleTapToZoom')}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

