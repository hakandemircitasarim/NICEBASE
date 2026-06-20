import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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

const DEFAULT_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23e5e7eb"/%3E%3C/svg%3E'

/**
 * Progressive image with a blur-up placeholder.
 *
 * The real <img> is bound directly to `src` with native loading="lazy", so the
 * browser only fetches it when it scrolls near the viewport. (A previous version
 * preloaded every image with a detached `new Image()`, which fetched the whole
 * list up-front and made loading="lazy" a no-op.)
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
  const { t } = useTranslation()
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Reset load/error state whenever the source changes.
  useEffect(() => {
    setIsLoaded(false)
    setHasError(false)
  }, [src])

  if (hasError || !src) {
    return (
      <div
        className={`${className} bg-gray-100 dark:bg-gray-700 flex items-center justify-center`}
        style={{ minHeight: '100px' }}
      >
        <div className="text-center">
          <div className="text-gray-400 text-xs mb-1">📷</div>
          <span className="text-gray-400 text-xs">{t('imageLoadError')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blur-up placeholder, shown until the real image finishes loading */}
      {!isLoaded && (
        <img
          src={placeholder || DEFAULT_PLACEHOLDER}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-110"
        />
      )}

      {/* Real image — lazily fetched by the browser */}
      <motion.img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        className="w-full h-full object-cover"
        onClick={onClick}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          setHasError(true)
          if (onError) onError(e)
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
    </div>
  )
}
