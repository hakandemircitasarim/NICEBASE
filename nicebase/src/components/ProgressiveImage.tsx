import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface ProgressiveImageProps {
  src: string
  alt: string
  className?: string
  onClick?: () => void
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  loading?: 'lazy' | 'eager'
  placeholder?: string
}

/**
 * Progressive image component with blur-up effect
 * Shows a low-quality placeholder while the full image loads
 */
export default function ProgressiveImage({
  src,
  alt,
  className = '',
  onClick,
  onError,
  loading = 'lazy',
  placeholder,
}: ProgressiveImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    // Reset state when src changes
    setIsLoaded(false)
    setHasError(false)
    
    if (!src) {
      setHasError(true)
      return
    }

    // Use provided placeholder or generate a simple gray one
    const defaultPlaceholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23e5e7eb"/%3E%3C/svg%3E'
    setImageSrc(placeholder || defaultPlaceholder)

    // Load the full image
    const fullImg = new Image()
    fullImg.onload = () => {
      setImageSrc(src)
      setIsLoaded(true)
    }
    fullImg.onerror = () => {
      setHasError(true)
      if (onError) {
        // Create a synthetic event for the error
        const errorEvent = new Event('error')
        const syntheticEvent = {
          nativeEvent: errorEvent,
          currentTarget: fullImg,
          target: fullImg,
          bubbles: false,
          cancelable: false,
          defaultPrevented: false,
          eventPhase: 0,
          isTrusted: false,
          timeStamp: Date.now(),
          type: 'error',
          preventDefault: () => {},
          stopPropagation: () => {},
          isDefaultPrevented: () => false,
          isPropagationStopped: () => false,
          persist: () => {},
        } as unknown as React.SyntheticEvent<HTMLImageElement, Event>
        onError(syntheticEvent)
      }
    }
    fullImg.src = src
  }, [src, placeholder, onError])

  if (hasError) {
    return (
      <div
        className={`${className} bg-gray-100 dark:bg-gray-700 flex items-center justify-center`}
        style={{ minHeight: '100px' }}
      >
        <div className="text-center">
          <div className="text-gray-400 text-xs mb-1">📷</div>
          <span className="text-gray-400 text-xs">Görsel yüklenemedi</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blur-up placeholder */}
      {imageSrc && !isLoaded && (
        <motion.img
          src={imageSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-110"
          aria-hidden="true"
          initial={{ opacity: 1 }}
          animate={{ opacity: isLoaded ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Full quality image */}
      {imageSrc && (
        <motion.img
          src={imageSrc}
          alt={alt}
          loading={loading}
          className={`w-full h-full object-cover ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClick}
          onError={(e) => {
            setHasError(true)
            if (onError) {
              onError(e)
            }
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </div>
  )
}










