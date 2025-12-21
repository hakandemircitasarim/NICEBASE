import { motion } from 'framer-motion'
import { hapticFeedback } from '../utils/haptic'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  ariaLabel?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  ariaLabel,
  size = 'md',
  className = '',
}: ToggleProps) {
  const handleToggle = () => {
    if (disabled) return
    onChange(!checked)
    hapticFeedback('light')
  }

  const sizeClasses = {
    sm: {
      track: 'w-9 h-5',
      thumb: 'w-4 h-4',
      translateX: 16,
    },
    md: {
      track: 'w-11 h-6',
      thumb: 'w-5 h-5',
      translateX: 20,
    },
    lg: {
      track: 'w-14 h-7',
      thumb: 'w-6 h-6',
      translateX: 28,
    },
  }

  const sizes = sizeClasses[size]

  return (
    <div className={`flex items-center ${label ? 'justify-between w-full' : 'gap-3'} ${className}`}>
      {label && (
        <label
          className={`text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={disabled ? undefined : handleToggle}
        >
          {label}
        </label>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label}
        disabled={disabled}
        onClick={handleToggle}
        className={`
          touch-target inline-flex items-center justify-center
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span
          className={`
            relative inline-flex items-center ${sizes.track} rounded-full transition-colors duration-200
            ${checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}
          `}
        >
          {/* IMPORTANT: Keep Y-centering out of Motion element.
              Framer Motion writes `transform` for x-anim, which would override Tailwind translateY. */}
          <span className="absolute top-1/2 left-0.5 -translate-y-1/2">
            <motion.span
              className={`${sizes.thumb} block bg-white rounded-full shadow-md`}
              animate={{ x: checked ? sizes.translateX : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </span>
        </span>
      </button>
    </div>
  )
}









