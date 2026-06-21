import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'framer-motion'

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
 * Dependency-free loading skeleton with a subtle moving shimmer, driven by
 * Framer Motion (already a dependency). Reads as "loading" rather than a flat
 * gray rect / broken image. Falls back to a static skeleton tone when the user
 * prefers reduced motion.
 */
function ShimmerPlaceholder() {
  const prefersReducedMotion = useReducedMotion()
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 w-full h-full overflow-hidden bg-gray-200 dark:bg-gray-700"
    >
      {!prefersReducedMotion && (
        <motion.div
          className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent"
          initial={{ x: '-150%' }}
          animate={{ x: '250%' }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}

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
      {/* Placeholder shown until the real image finishes loading. A real LQIP
          (if provided) is blurred up; otherwise show a shimmer skeleton so it
          reads as loading rather than a flat/broken rect. */}
      {!isLoaded &&
        (placeholder ? (
          <img
            src={placeholder}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-110"
          />
        ) : (
          <ShimmerPlaceholder />
        ))}

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
