import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

interface SuccessAnimationProps {
  message?: string
  onComplete?: () => void
}

export default function SuccessAnimation({ message, onComplete }: SuccessAnimationProps) {
  // Avoid relying on Framer's onAnimationComplete; it can fire early and
  // keyframe/spring combinations can throw runtime errors.
  useEffect(() => {
    if (!onComplete) return
    const id = window.setTimeout(() => onComplete(), 1100)
    return () => window.clearTimeout(id)
  }, [onComplete])

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 15,
      }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{
          type: 'tween',
          duration: 0.45,
          ease: 'easeOut',
          times: [0, 0.6, 1],
          delay: 0.1,
        }}
        className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col items-center gap-4"
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 15,
            delay: 0.2,
          }}
        >
          <CheckCircle2 className="text-green-500" size={64} />
        </motion.div>
        {message && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {message}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  )
}











