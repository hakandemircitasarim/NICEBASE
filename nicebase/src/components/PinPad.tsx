import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useAnimationControls } from 'framer-motion'
import { Delete } from 'lucide-react'
import { hapticFeedback } from '../utils/haptic'

interface PinPadProps {
  title: string
  subtitle?: string
  onComplete: (pin: string) => void
  onCancel?: () => void
  error?: string
  pinLength?: number
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

/**
 * A masked numeric keypad for entering a PIN.
 *
 * Fires `onComplete(pin)` once `pinLength` digits are entered, then clears its
 * own internal buffer so the same instance can be reused for a confirm step.
 * When the `error` prop changes to a non-empty value the dots shake and the
 * buffer is cleared.
 */
export default function PinPad({
  title,
  subtitle,
  onComplete,
  onCancel,
  error,
  pinLength = 4,
}: PinPadProps) {
  const { t } = useTranslation()
  const [entry, setEntry] = useState('')
  const shakeControls = useAnimationControls()

  // React to an error (e.g. wrong PIN): shake the dots, buzz, and reset entry.
  useEffect(() => {
    if (!error) return
    hapticFeedback('error')
    setEntry('')
    shakeControls.start({
      x: [0, -10, 10, -8, 8, -4, 4, 0],
      transition: { duration: 0.4 },
    })
  }, [error, shakeControls])

  const handleDigit = (digit: string) => {
    if (entry.length >= pinLength) return
    hapticFeedback('light')
    const next = entry + digit
    setEntry(next)
    if (next.length === pinLength) {
      // Let the final dot render before handing the PIN to the parent, then
      // clear the buffer so the pad is ready for a confirm/retry step.
      window.setTimeout(() => {
        onComplete(next)
        setEntry('')
      }, 150)
    }
  }

  const handleBackspace = () => {
    if (entry.length === 0) return
    hapticFeedback('light')
    setEntry(entry.slice(0, -1))
  }

  const keyClass =
    'flex items-center justify-center min-h-[56px] min-w-[56px] rounded-2xl ' +
    'bg-gray-100 dark:bg-gray-700 text-2xl font-semibold ' +
    'text-gray-900 dark:text-gray-100 ' +
    'hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 ' +
    'transition-all touch-manipulation select-none'

  const utilKeyClass =
    'flex items-center justify-center min-h-[56px] min-w-[56px] rounded-2xl ' +
    'bg-transparent text-base font-medium ' +
    'text-gray-500 dark:text-gray-400 ' +
    'hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 ' +
    'transition-all touch-manipulation select-none'

  return (
    <div className="w-full max-w-xs mx-auto flex flex-col items-center">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-center">
          {subtitle}
        </p>
      )}

      {/* Masked dot indicators */}
      <motion.div
        animate={shakeControls}
        className="flex gap-3 justify-center my-8"
        role="status"
        aria-live="polite"
        aria-label={`${entry.length} / ${pinLength}`}
      >
        {Array.from({ length: pinLength }).map((_, i) => (
          <div
            key={i}
            className={
              'w-4 h-4 rounded-full border-2 transition-colors ' +
              (i < entry.length
                ? 'bg-primary border-primary'
                : 'border-gray-300 dark:border-gray-600')
            }
          />
        ))}
      </motion.div>

      {error && (
        <p className="mb-4 text-sm font-medium text-red-500 dark:text-red-400 text-center">
          {error}
        </p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            aria-label={digit}
            onClick={() => handleDigit(digit)}
            className={keyClass}
          >
            {digit}
          </button>
        ))}

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className={utilKeyClass}
          >
            {t('cancel')}
          </button>
        ) : (
          <span aria-hidden="true" />
        )}

        <button
          type="button"
          aria-label="0"
          onClick={() => handleDigit('0')}
          className={keyClass}
        >
          0
        </button>

        <button
          type="button"
          aria-label={t('backspace', { defaultValue: 'Delete' })}
          onClick={handleBackspace}
          className={utilKeyClass}
        >
          <Delete size={24} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
