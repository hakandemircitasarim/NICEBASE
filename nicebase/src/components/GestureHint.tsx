import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Move, Hand, ArrowDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useReducedMotion } from 'framer-motion'

interface GestureHintProps {
  type: 'swipe' | 'longPress' | 'pullToRefresh'
  onDismiss?: () => void
}

export default function GestureHint({ type, onDismiss }: GestureHintProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onDismiss?.()
    }, 4000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  const hints = {
    swipe: {
      icon: Move,
      text: t('swipeHint'),
      animation: {
        x: [0, 20, 0, -20, 0],
      },
    },
    longPress: {
      icon: Hand,
      text: t('longPressHint'),
      animation: {
        scale: [1, 1.1, 1],
      },
    },
    pullToRefresh: {
      icon: ArrowDown,
      text: t('pullToRefreshHint'),
      animation: {
        y: [0, -10, 0],
      },
    },
  }

  const hint = hints[type]
  const Icon = hint.icon

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          onClick={() => {
            setIsVisible(false)
            onDismiss?.()
          }}
          role="button"
          tabIndex={0}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-xl border border-gray-200 dark:border-gray-700 flex items-center gap-3 max-w-xs cursor-pointer touch-manipulation"
        >
          <motion.div
            animate={prefersReducedMotion ? undefined : hint.animation}
            transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Icon className="text-primary" size={20} />
          </motion.div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">
            {hint.text}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

