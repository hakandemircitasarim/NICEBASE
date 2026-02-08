import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { hapticFeedback } from '../utils/haptic'

interface RangeSliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  showValue?: boolean
  label?: string
  className?: string
}

export default function RangeSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  showValue = true,
  label,
  className = '',
}: RangeSliderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const sliderRef = useRef<HTMLDivElement>(null)
  const lastHapticValue = useRef(value)
  const [trackWidth, setTrackWidth] = useState(0)
  const THUMB_PX = 24
  const THUMB_R = THUMB_PX / 2

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Measure track width for accurate thumb positioning (prevents misalignment at min/max)
  useEffect(() => {
    if (!sliderRef.current) return
    const el = sliderRef.current
    const update = () => setTrackWidth(el.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    updateValue(e.clientX)
    hapticFeedback('light')
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    updateValue(e.touches[0].clientX)
    hapticFeedback('light')
  }

  const handleMove = (clientX: number) => {
    if (!isDragging) return
    updateValue(clientX)
  }

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX)
    }
  }

  const handleEnd = () => {
    setIsDragging(false)
    hapticFeedback('success')
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleEnd)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleEnd)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleEnd)
      }
    }
  }, [isDragging])

  const updateValue = (clientX: number) => {
    if (!sliderRef.current) return

    const rect = sliderRef.current.getBoundingClientRect()
    const usableWidth = Math.max(1, rect.width - THUMB_PX)
    const rawX = clientX - rect.left
    // Map pointer position to thumb center within [THUMB_R, rect.width - THUMB_R]
    const percentage = Math.max(0, Math.min(1, (rawX - THUMB_R) / usableWidth))
    const rawValue = min + percentage * (max - min)
    const steppedValue = Math.round(rawValue / step) * step
    const clampedValue = Math.max(min, Math.min(max, steppedValue))
    
    // Special handling for max value to ensure thumb reaches the end
    const finalValue = clampedValue === max ? max : clampedValue

    setLocalValue(finalValue)
    onChange(finalValue)

    // Haptic feedback when value changes significantly
    if (Math.abs(clampedValue - lastHapticValue.current) >= step) {
      hapticFeedback('light')
      lastHapticValue.current = clampedValue
    }
  }

  const percentage = (localValue - min) / (max - min)
  const usableTrack = Math.max(0, trackWidth - THUMB_PX)
  // Ensure thumb center is positioned correctly, especially at max value
  // At max value, thumb should be at rect.width - THUMB_R (fully to the right)
  const thumbLeftPx = localValue === max && trackWidth > 0
    ? trackWidth - THUMB_R
    : Math.min(
        THUMB_R + percentage * usableTrack,
        trackWidth > 0 ? trackWidth - THUMB_R : THUMB_R
      )
  const fillWidthPx = thumbLeftPx

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
            {label}
          </label>
          {showValue && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary">{localValue}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/ {max}</span>
            </div>
          )}
        </div>
      )}
      
      <div className="relative">
        {/* Slider Track */}
        <div
          ref={sliderRef}
          className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer touch-manipulation"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Filled Track */}
          <motion.div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-primary-dark rounded-full"
            initial={false}
            animate={{ width: `${fillWidthPx}px` }}
            transition={{ duration: isDragging ? 0 : 0.2 }}
          />

          {/* Thumb
              IMPORTANT: Keep Y-centering out of the motion element. */}
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `${thumbLeftPx}px` }}
          >
            <motion.div
              className="w-6 h-6 bg-white dark:bg-gray-800 rounded-full shadow-lg border-2 border-primary cursor-grab active:cursor-grabbing touch-manipulation flex items-center justify-center"
              animate={{ scale: isDragging ? 1.2 : 1 }}
              transition={{ duration: 0.2 }}
            >
            {/* Value Tooltip */}
            {isDragging && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: -35 }}
                className="absolute top-0 bg-gray-900 dark:bg-gray-700 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap pointer-events-none"
              >
                {localValue}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                </div>
              </motion.div>
            )}
            
            {/* Thumb inner dot */}
            <div className="w-2 h-2 bg-primary rounded-full" />
            </motion.div>
          </div>
        </div>

        {/* Step Indicators (Optional - for better UX) */}
        {max - min <= 10 && (
          <div className="flex justify-between mt-2 px-3">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((stepValue) => (
              <button
                key={stepValue}
                onClick={() => {
                  setLocalValue(stepValue)
                  onChange(stepValue)
                  hapticFeedback('light')
                }}
                className={`text-xs font-medium transition-colors touch-manipulation ${
                  stepValue <= localValue
                    ? 'text-primary'
                    : 'text-gray-400 dark:text-gray-600'
                }`}
                aria-label={`Set value to ${stepValue}`}
              >
                {stepValue}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}









