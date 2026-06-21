import { useState, useEffect, useRef, useId } from 'react'
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
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const selectRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()
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

  // When the list opens, highlight the selected option (or the first one) and
  // move focus into the popover. When searchable, the search input has autoFocus
  // and drives aria-activedescendant; otherwise we focus the listbox itself.
  useEffect(() => {
    if (!isOpen) return
    const selectedIdx = filteredOptions.findIndex(opt => opt.value === value)
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0)
    if (!searchable) {
      const timer = window.setTimeout(() => listRef.current?.focus(), 0)
      return () => window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Keep the highlight within bounds as the filtered list shrinks/grows
  useEffect(() => {
    if (!isOpen) return
    setHighlightedIndex(prev => {
      if (filteredOptions.length === 0) return 0
      return Math.min(prev, filteredOptions.length - 1)
    })
  }, [filteredOptions.length, isOpen])

  const optionId = (index: number) => `${listId}-opt-${index}`

  const closeDropdown = (restoreFocus = false) => {
    setIsOpen(false)
    setSearchQuery('')
    if (restoreFocus) {
      triggerRef.current?.focus()
    }
  }

  const handleSelect = (optionValue: string | number, restoreFocus = false) => {
    if (disabled) return
    onChange(optionValue)
    setIsOpen(false)
    setSearchQuery('')
    hapticFeedback('light')
    if (restoreFocus) {
      triggerRef.current?.focus()
    }
  }

  const handleToggle = () => {
    if (disabled) return
    setIsOpen(!isOpen)
    hapticFeedback('light')
  }

  // Move the highlight, skipping disabled options (wrapping in the given direction)
  const moveHighlight = (direction: 1 | -1) => {
    const count = filteredOptions.length
    if (count === 0) return
    setHighlightedIndex(prev => {
      let next = prev
      for (let i = 0; i < count; i++) {
        next = (next + direction + count) % count
        if (!filteredOptions[next]?.disabled) return next
      }
      return prev
    })
  }

  const moveHighlightToEdge = (edge: 'first' | 'last') => {
    const count = filteredOptions.length
    if (count === 0) return
    const range = edge === 'first'
      ? Array.from({ length: count }, (_, i) => i)
      : Array.from({ length: count }, (_, i) => count - 1 - i)
    const target = range.find(i => !filteredOptions[i]?.disabled)
    if (target !== undefined) setHighlightedIndex(target)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return

    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setIsOpen(true)
        hapticFeedback('light')
      }
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveHighlight(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveHighlight(-1)
        break
      case 'Home':
        event.preventDefault()
        moveHighlightToEdge('first')
        break
      case 'End':
        event.preventDefault()
        moveHighlightToEdge('last')
        break
      case 'Enter':
      case ' ': {
        // Space inside the search input should type a space, not select.
        if (event.key === ' ' && searchable) return
        event.preventDefault()
        const option = filteredOptions[highlightedIndex]
        if (option && !option.disabled) {
          handleSelect(option.value, true)
        }
        break
      }
      case 'Escape':
        event.preventDefault()
        closeDropdown(true)
        break
      case 'Tab':
        // Popover (not a modal): Tab closes it rather than trapping focus.
        closeDropdown()
        break
      default:
        break
    }
  }

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
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
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
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
                      onKeyDown={handleKeyDown}
                      placeholder={t('selectSearchPlaceholder')}
                      className="w-full pl-10 pr-10 py-2.5 border-2 border-gray-200 dark:border-gray-600
                                 rounded-xl bg-white dark:bg-gray-700
                                 focus:border-primary focus:ring-2 focus:ring-primary/20
                                 transition-all outline-none text-sm"
                      autoFocus
                      role="combobox"
                      aria-expanded={isOpen}
                      aria-controls={listId}
                      aria-activedescendant={
                        filteredOptions.length > 0 ? optionId(highlightedIndex) : undefined
                      }
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
              <div
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={resolvedPlaceholder}
                tabIndex={searchable ? -1 : 0}
                onKeyDown={searchable ? undefined : handleKeyDown}
                aria-activedescendant={
                  !searchable && filteredOptions.length > 0
                    ? optionId(highlightedIndex)
                    : undefined
                }
                className={`overflow-y-auto flex-1 outline-none ${searchable ? 'p-2' : 'p-3'}`}
              >
                {filteredOptions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                    {t('noResultsFound')}
                  </div>
                ) : (
                  filteredOptions.map((option, index) => {
                    const isSelected = option.value === value
                    const isDisabled = option.disabled || false
                    const isHighlighted = index === highlightedIndex

                    return (
                      <motion.button
                        key={option.value}
                        id={optionId(index)}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={isDisabled || undefined}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        onClick={() => !isDisabled && handleSelect(option.value)}
                        onMouseEnter={() => !isDisabled && setHighlightedIndex(index)}
                        disabled={isDisabled}
                        className={`
                          w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                          transition-all touch-manipulation
                          text-left
                          ${isSelected
                            ? 'bg-primary/10 text-primary font-semibold'
                            : isDisabled
                            ? 'opacity-50 cursor-not-allowed text-gray-400'
                            : isHighlighted
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
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



