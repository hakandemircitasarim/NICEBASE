import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { hapticFeedback } from '../utils/haptic'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useModalPresence } from '../hooks/useModalPresence'

interface TimePickerProps {
  value: string // HH:mm format
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function TimePicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = '',
}: TimePickerProps) {
  const { t } = useTranslation()
  const defaultPlaceholder = placeholder || t('selectTime')
  const [isOpen, setIsOpen] = useState(false)
  const [hours, setHours] = useState(9)
  const [minutes, setMinutes] = useState(0)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Lock body scroll when modal is open
  useBodyScrollLock(isOpen)
  useModalPresence(isOpen)

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':').map(Number)
      if (!isNaN(h) && !isNaN(m)) {
        setHours(h)
        setMinutes(m)
      }
    }
  }, [value])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchstart', handleClickOutside)
      }
    }
  }, [isOpen])

  const handleOpen = () => {
    if (disabled) return
    setIsOpen(true)
    hapticFeedback('light')
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  const handleApply = () => {
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    onChange(timeString)
    handleClose()
    hapticFeedback('success')
  }

  const handleClear = () => {
    onChange('')
    handleClose()
    hapticFeedback('light')
  }

  const incrementHours = () => {
    setHours((prev) => {
      const newValue = prev >= 23 ? 0 : prev + 1
      hapticFeedback('light')
      return newValue
    })
  }

  const decrementHours = () => {
    setHours((prev) => {
      const newValue = prev <= 0 ? 23 : prev - 1
      hapticFeedback('light')
      return newValue
    })
  }

  const incrementMinutes = () => {
    setMinutes((prev) => {
      const newValue = prev >= 55 ? 0 : prev + 5
      hapticFeedback('light')
      return newValue
    })
  }

  const decrementMinutes = () => {
    setMinutes((prev) => {
      const newValue = prev <= 0 ? 55 : prev - 5
      hapticFeedback('light')
      return newValue
    })
  }

  const displayValue = value ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : ''

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      {/* Trigger Row (avoid nested buttons) */}
      <div
        className={`
          w-full border-2 rounded-xl 
          bg-white dark:bg-gray-800 
          transition-all outline-none
          ${disabled 
            ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-600' 
            : 'border-gray-200 dark:border-gray-600 hover:border-primary/50'
          }
          focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20
        `}
      >
        <div className="row-between px-4 py-3.5 sm:py-2.5">
          <button
            type="button"
            onClick={handleOpen}
            disabled={disabled}
            className="row-left flex-1 bg-transparent text-left touch-manipulation"
            aria-label={defaultPlaceholder}
            aria-expanded={isOpen}
          >
            <Clock className="text-gray-400 flex-shrink-0" size={18} />
            <span
              className={`text-sm sm:text-base truncate ${
                displayValue ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
              }`}
            >
              {displayValue || defaultPlaceholder}
            </span>
          </button>
          {displayValue && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleClear()
              }}
              className="icon-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={t('clear')}
              disabled={disabled}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Time Picker Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Picker
                IMPORTANT: Keep centering transforms out of the motion element. */}
            <div
              className="fixed left-1/2 z-50 bottom-0 sm:bottom-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 safe-area-bottom w-full sm:w-[calc(100vw-2rem)] max-w-sm"
              style={{
                maxHeight: 'min(85vh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)))',
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl shadow-2xl 
                           border border-gray-200 dark:border-gray-700 
                           w-full max-h-[85vh] overflow-y-auto
                           overflow-hidden flex flex-col"
              >
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {t('selectTime')}
                  </h3>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                    aria-label={t('close')}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Time Display */}
                <div className="flex items-center justify-center gap-4">
                  {/* Hours */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={incrementHours}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                      aria-label={t('increaseHours')}
                    >
                      <ChevronUp size={24} className="text-gray-400" />
                    </button>
                    <div className="text-5xl font-bold text-gray-900 dark:text-gray-100 my-2 min-w-[60px] text-center">
                      {String(hours).padStart(2, '0')}
                    </div>
                    <button
                      onClick={decrementHours}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                      aria-label={t('decreaseHours')}
                    >
                      <ChevronDown size={24} className="text-gray-400" />
                    </button>
                  </div>

                  {/* Separator */}
                  <div className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    :
                  </div>

                  {/* Minutes */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={incrementMinutes}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                      aria-label={t('increaseMinutes')}
                    >
                      <ChevronUp size={24} className="text-gray-400" />
                    </button>
                    <div className="text-5xl font-bold text-gray-900 dark:text-gray-100 my-2 min-w-[60px] text-center">
                      {String(minutes).padStart(2, '0')}
                    </div>
                    <button
                      onClick={decrementMinutes}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                      aria-label={t('decreaseMinutes')}
                    >
                      <ChevronDown size={24} className="text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleClear}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                >
                  {t('clear')}
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors touch-manipulation"
                >
                  {t('apply')}
                </button>
              </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}









