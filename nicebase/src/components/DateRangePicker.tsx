import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns'
import { tr, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { hapticFeedback } from '../utils/haptic'
import { useModalPresence } from '../hooks/useModalPresence'

interface DateRangePickerProps {
  startDate: string // YYYY-MM-DD format
  endDate: string // YYYY-MM-DD format
  onChange: (start: string, end: string) => void
  onClose?: () => void
}

export default function DateRangePicker({ startDate, endDate, onChange, onClose }: DateRangePickerProps) {
  const { i18n, t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedStart, setSelectedStart] = useState<Date | null>(startDate ? new Date(startDate) : null)
  const [selectedEnd, setSelectedEnd] = useState<Date | null>(endDate ? new Date(endDate) : null)
  const [tempStart, setTempStart] = useState<Date | null>(null)
  // The day that currently holds keyboard focus (roving tabindex anchor).
  const [focusedDate, setFocusedDate] = useState<Date | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  useModalPresence(isOpen)

  const locale = i18n.language?.startsWith('tr') ? tr : enUS

  // Parse dates
  useEffect(() => {
    if (startDate) {
      const start = new Date(startDate)
      if (!isNaN(start.getTime())) {
        setSelectedStart(start)
        setCurrentMonth(start)
      }
    } else {
      setSelectedStart(null)
    }
    
    if (endDate) {
      const end = new Date(endDate)
      if (!isNaN(end.getTime())) {
        setSelectedEnd(end)
      }
    } else {
      setSelectedEnd(null)
    }
  }, [startDate, endDate])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside as EventListener)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchstart', handleClickOutside as EventListener)
      }
    }
  }, [isOpen])

  // Move DOM focus to the day button matching the given date (if rendered).
  const focusDayButton = useCallback((date: Date) => {
    const root = gridRef.current
    if (!root) return
    const btn = root.querySelector<HTMLButtonElement>(
      `[data-day="${format(date, 'yyyy-MM-dd')}"]`
    )
    btn?.focus()
  }, [])

  // Escape closes (mirrors ModalShell). Restore focus to the trigger on close.
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      // Restore focus to the trigger (or whatever opened the picker).
      const restore = triggerRef.current || previouslyFocusedRef.current
      restore?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Focus trap (mirrors ModalShell) + initial focus on the calendar grid.
  useEffect(() => {
    if (!isOpen) return

    const getFocusable = () => {
      const root = pickerRef.current
      if (!root) return [] as HTMLElement[]
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
        )
      )
      return nodes.filter(
        (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden') && el !== triggerRef.current
      )
    }

    // Focus the focused day first, falling back to the first focusable.
    const timer = window.setTimeout(() => {
      const root = gridRef.current
      const focusedBtn = root?.querySelector<HTMLButtonElement>('[data-day][tabindex="0"]')
      if (focusedBtn) {
        focusedBtn.focus()
        return
      }
      const focusables = getFocusable()
      focusables[0]?.focus()
    }, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusables = getFocusable()
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (!active || active === first || !pickerRef.current?.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (!active || active === last || !pickerRef.current?.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleOpen = () => {
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) || null
    // Seed keyboard focus on the most relevant day so the grid is navigable.
    const anchor = selectedStart || selectedEnd || new Date()
    setCurrentMonth(anchor)
    setFocusedDate(anchor)
    setIsOpen(true)
    hapticFeedback('light')
  }

  const handleClose = () => {
    setIsOpen(false)
    onClose?.()
  }

  const handleDateClick = (date: Date) => {
    hapticFeedback('light')
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    // Can't select future dates
    if (date > today) return

    if (!selectedStart || (selectedStart && selectedEnd)) {
      // Start new selection
      setSelectedStart(date)
      setSelectedEnd(null)
      setTempStart(date)
    } else if (selectedStart && !selectedEnd) {
      // Complete selection
      if (date < selectedStart) {
        // Selected end date is before start date, swap them
        setSelectedEnd(selectedStart)
        setSelectedStart(date)
        setTempStart(date)
      } else {
        setSelectedEnd(date)
        setTempStart(null)
      }
    }
  }

  // Roving-tabindex keyboard navigation across the calendar grid.
  const moveFocus = (next: Date) => {
    setFocusedDate(next)
    if (!isSameMonth(next, currentMonth)) {
      setCurrentMonth(next)
    }
    // Focus after the DOM updates so the target cell exists.
    requestAnimationFrame(() => focusDayButton(next))
  }

  const handleDayKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, day: Date) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        moveFocus(subDays(day, 1))
        break
      case 'ArrowRight':
        e.preventDefault()
        moveFocus(addDays(day, 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        moveFocus(subDays(day, 7))
        break
      case 'ArrowDown':
        e.preventDefault()
        moveFocus(addDays(day, 7))
        break
      case 'Home':
        e.preventDefault()
        moveFocus(startOfWeek(day, { weekStartsOn: 1 }))
        break
      case 'End':
        e.preventDefault()
        moveFocus(endOfWeek(day, { weekStartsOn: 1 }))
        break
      case 'PageUp':
        e.preventDefault()
        moveFocus(subMonths(day, 1))
        break
      case 'PageDown':
        e.preventDefault()
        moveFocus(addMonths(day, 1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        handleDateClick(day)
        break
      default:
        break
    }
  }

  const handleApply = () => {
    if (selectedStart && selectedEnd) {
      onChange(
        format(selectedStart, 'yyyy-MM-dd'),
        format(selectedEnd, 'yyyy-MM-dd')
      )
      handleClose()
      hapticFeedback('success')
    } else if (selectedStart && !selectedEnd) {
      // If only start date is selected, use it as both start and end
      const dateStr = format(selectedStart, 'yyyy-MM-dd')
      onChange(dateStr, dateStr)
      handleClose()
      hapticFeedback('success')
    }
  }

  const handleClear = () => {
    setSelectedStart(null)
    setSelectedEnd(null)
    setTempStart(null)
    onChange('', '')
    handleClose()
    hapticFeedback('light')
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
    hapticFeedback('light')
  }

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
    hapticFeedback('light')
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  // Group the flat day list into 7-day week rows for the ARIA grid structure.
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  const getDisplayText = () => {
    if (selectedStart && selectedEnd) {
      return `${format(selectedStart, 'd MMM', { locale })} - ${format(selectedEnd, 'd MMM yyyy', { locale })}`
    } else if (selectedStart) {
      return format(selectedStart, 'd MMM yyyy', { locale })
    }
    return t('selectDateRange')
  }

  const isDateInRange = (date: Date) => {
    if (!selectedStart || !selectedEnd) return false
    return date >= selectedStart && date <= selectedEnd
  }

  const isDateBetween = (date: Date) => {
    if (!selectedStart || selectedEnd) return false
    const start = tempStart || selectedStart
    const end = selectedEnd || tempStart
    if (!start || !end) return false
    
    const min = start < end ? start : end
    const max = start < end ? end : start
    return date > min && date < max
  }

  const dayNames = i18n.language?.startsWith('tr')
    ? ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date()

  // Exactly one day cell is tabbable at a time (roving tabindex). Pick the
  // focused day if it is currently rendered, otherwise fall back to a day that
  // is guaranteed to be in view (monthStart is always within the grid).
  const tabbableCandidate = focusedDate || selectedStart || today
  const tabbableDate =
    tabbableCandidate && days.some((d) => isSameDay(d, tabbableCandidate))
      ? tabbableCandidate
      : monthStart

  return (
    <div className="relative" ref={pickerRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        aria-label={t('selectDateRange')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="w-full px-4 py-3.5 sm:py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation text-left flex items-center justify-between group"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Calendar className="text-gray-400 group-hover:text-primary transition-colors flex-shrink-0" size={18} />
          <span className={`text-sm sm:text-base truncate ${selectedStart ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
            {getDisplayText()}
          </span>
        </div>
        {(selectedStart || selectedEnd) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors flex-shrink-0 touch-target inline-flex items-center justify-center"
              aria-label={t('clear')}
            >
              <X size={16} className="text-gray-400" />
            </button>
        )}
      </button>

      {/* Calendar Modal */}
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

            {/* Calendar
                IMPORTANT: Keep centering transforms out of the motion element. */}
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={t('selectDateRange')}
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto"
              >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={prevMonth}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                    aria-label={t('previousMonth')}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 min-w-[140px] text-center">
                    {format(currentMonth, 'MMMM yyyy', { locale })}
                  </h3>
                  <button
                    onClick={nextMonth}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                    aria-label={t('nextMonth')}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                  aria-label={t('close')}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 gap-1 mb-2" aria-hidden="true">
                {dayNames.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div ref={gridRef} role="grid" className="grid grid-cols-7 gap-1">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} role="row" className="contents">
                    {week.map((day, idx) => {
                      const isCurrentMonth = isSameMonth(day, currentMonth)
                      const isToday = isSameDay(day, today)
                      const isSelectedStart = selectedStart && isSameDay(day, selectedStart)
                      const isSelectedEnd = selectedEnd && isSameDay(day, selectedEnd)
                      const isInRange = isDateInRange(day)
                      const isBetween = isDateBetween(day)
                      const isPast = day > today
                      const isDisabled = isPast && !isCurrentMonth
                      const isTabbable = isSameDay(day, tabbableDate)
                      const isRangeEndpoint = Boolean(isSelectedStart || isSelectedEnd)

                      return (
                        <div key={idx} role="gridcell" aria-selected={isRangeEndpoint || isInRange} className="contents">
                          <button
                            type="button"
                            onClick={() => handleDateClick(day)}
                            onKeyDown={(e) => handleDayKeyDown(e, day)}
                            disabled={isDisabled}
                            aria-disabled={isDisabled}
                            aria-label={format(day, 'PPPP', { locale })}
                            tabIndex={isTabbable ? 0 : -1}
                            data-day={format(day, 'yyyy-MM-dd')}
                            className={`
                              aspect-square text-sm font-medium rounded-lg transition-all touch-manipulation
                              ${!isCurrentMonth ? 'text-gray-300 dark:text-gray-600' : 'text-gray-900 dark:text-gray-100'}
                              ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-primary/10 cursor-pointer'}
                              ${isToday && !isSelectedStart && !isSelectedEnd ? 'bg-primary/10 border-2 border-primary' : ''}
                              ${isSelectedStart || isSelectedEnd ? 'bg-primary text-white font-bold' : ''}
                              ${isInRange && !isSelectedStart && !isSelectedEnd ? 'bg-primary/20' : ''}
                              ${isBetween ? 'bg-primary/10' : ''}
                            `}
                          >
                            {format(day, 'd')}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleClear}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                >
                  {t('clear')}
                </button>
                <button
                  onClick={handleApply}
                  disabled={!selectedStart}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
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









