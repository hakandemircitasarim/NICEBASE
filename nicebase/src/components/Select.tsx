import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { hapticFeedback } from '../utils/haptic'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useDebounce } from '../hooks/useDebounce'
import { useModalPresence } from '../hooks/useModalPresence'

interface SelectOption {
  value: string | number
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}

interface SelectProps {
  value: string | number | 'all'
  options: SelectOption[]
  onChange: (value: string | number) => void
  placeholder?: string
  searchable?: boolean
  disabled?: boolean
  className?: string
}

export default function Select({
  value,
  options,
  onChange,
  placeholder,
  searchable = false,
  disabled = false,
  className = '',
}: SelectProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const selectRef = useRef<HTMLDivElement>(null)
  const resolvedPlaceholder = placeholder ?? t('selectPlaceholder')
  
  // Lock body scroll when modal is open
  useBodyScrollLock(isOpen)
  useModalPresence(isOpen)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
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

  // Filter options based on search (using debounced value)
  const filteredOptions = searchable && debouncedSearchQuery
    ? options.filter(option =>
        option.label.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      )
    : options

  const selectedOption = options.find(opt => opt.value === value)

  const handleSelect = (optionValue: string | number) => {
    if (disabled) return
    onChange(optionValue)
    setIsOpen(false)
    setSearchQuery('')
    hapticFeedback('light')
  }

  const handleToggle = () => {
    if (disabled) return
    setIsOpen(!isOpen)
    hapticFeedback('light')
  }

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full px-4 py-3.5 sm:py-2.5 border-2 rounded-xl 
          bg-white dark:bg-gray-800 
          focus:border-primary focus:ring-2 focus:ring-primary/20 
          transition-all outline-none touch-manipulation
          flex items-center justify-between gap-3
          ${disabled 
            ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-600' 
            : 'border-gray-200 dark:border-gray-600 hover:border-primary/50'
          }
        `}
        aria-label={resolvedPlaceholder}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedOption?.icon && (
            <span className="flex-shrink-0 text-gray-400">
              {selectedOption.icon}
            </span>
          )}
          <span className={`text-sm sm:text-base truncate ${selectedOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
            {selectedOption?.label || resolvedPlaceholder}
          </span>
        </div>
        <ChevronDown 
          size={18} 
          className={`flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsOpen(false)
                setSearchQuery('')
              }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />

            {/* Options List
                IMPORTANT: Keep centering transforms out of the motion element.
                Framer Motion writes `transform` for animations and may override translate. */}
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl 
                           border border-gray-200 dark:border-gray-700 
                           max-w-xs w-[calc(100vw-3rem)] max-h-[70dvh] 
                           overflow-hidden flex flex-col"
              >
              {/* Header with Search */}
              {searchable && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                {searchable && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('selectSearchPlaceholder')}
                      className="w-full pl-10 pr-10 py-2.5 border-2 border-gray-200 dark:border-gray-600 
                                 rounded-xl bg-white dark:bg-gray-700 
                                 focus:border-primary focus:ring-2 focus:ring-primary/20 
                                 transition-all outline-none text-sm"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 
                                   hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full 
                                   transition-colors"
                      >
                        <X size={16} className="text-gray-400" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Options List */}
              <div className={`overflow-y-auto flex-1 ${searchable ? 'p-2' : 'p-3'}`}>
                {filteredOptions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                    {t('noResultsFound')}
                  </div>
                ) : (
                  filteredOptions.map((option, index) => {
                    const isSelected = option.value === value
                    const isDisabled = option.disabled || false

                    return (
                      <motion.button
                        key={option.value}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        onClick={() => !isDisabled && handleSelect(option.value)}
                        disabled={isDisabled}
                        className={`
                          w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                          transition-all touch-manipulation
                          text-left
                          ${isSelected
                            ? 'bg-primary/10 text-primary font-semibold'
                            : isDisabled
                            ? 'opacity-50 cursor-not-allowed text-gray-400'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                          }
                        `}
                      >
                        {option.icon && (
                          <span className="flex-shrink-0">
                            {option.icon}
                          </span>
                        )}
                        <span className="flex-1 text-sm sm:text-base">{option.label}</span>
                        {isSelected && (
                          <Check size={20} className="flex-shrink-0 text-primary" />
                        )}
                      </motion.button>
                    )
                  })
                )}
              </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}



