import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { hapticFeedback } from '../utils/haptic'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onFocus?: () => void
  onBlur?: () => void
  className?: string
  autoFocus?: boolean
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Ara...',
  onFocus,
  onBlur,
  className = '',
  autoFocus = false,
}: SearchBarProps) {
  const { t } = useTranslation()
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleClear = () => {
    onChange('')
    hapticFeedback('light')
    inputRef.current?.focus()
  }

  const handleFocus = () => {
    setIsFocused(true)
    onFocus?.()
  }

  const handleBlur = () => {
    setIsFocused(false)
    onBlur?.()
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className={`
          relative flex items-center
          border-2 rounded-xl
          bg-white dark:bg-gray-800
          transition-all duration-200
          ${isFocused || value
            ? 'border-primary shadow-lg shadow-primary/10'
            : 'border-gray-200 dark:border-gray-600'
          }
        `}
      >
        {/* Search Icon */}
        <div className="absolute left-4 pointer-events-none">
          <motion.div
            animate={{
              scale: isFocused ? 1.1 : 1,
              rotate: isFocused ? [0, -10, 10, 0] : 0,
            }}
            transition={{ duration: 0.3 }}
          >
            <Search
              size={20}
              className={`
                transition-colors
                ${isFocused || value
                  ? 'text-primary'
                  : 'text-gray-400'
                }
              `}
            />
          </motion.div>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="
            w-full pl-12 pr-12 py-3.5 sm:py-4
            bg-transparent
            border-none outline-none
            text-base sm:text-lg
            text-gray-900 dark:text-gray-100
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            touch-manipulation
          "
          autoComplete="off"
          aria-label={placeholder}
        />

        {/* Clear Button */}
        <AnimatePresence>
          {value && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleClear}
              className="
                absolute right-4
                p-1.5
                text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-700
                rounded-full
                transition-colors
                touch-manipulation
              "
              aria-label={t('clear')}
            >
              <X size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Focus indicator ring */}
      {isFocused && (
        <motion.div
          className="absolute inset-0 rounded-xl ring-2 ring-primary/20 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </div>
  )
}










