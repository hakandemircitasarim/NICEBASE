import type React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useModalPresence } from '../hooks/useModalPresence'

interface ModalShellProps {
  isOpen: boolean
  onClose: () => void
  labelledBy?: string
  describedBy?: string
  className?: string
  panelClassName?: string
  scroll?: boolean
  /** When true the panel sizes to its content (maxHeight only, no forced height). */
  autoHeight?: boolean
  header?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}

/**
 * Web-first modal shell with a stable inner-scroll layout:
 * - Backdrop is fixed and does NOT intercept wheel/scroll beyond click-to-dismiss.
 * - Panel is height-constrained; body uses flex + min-h-0 so overflow-y works reliably.
 */
export default function ModalShell({
  isOpen,
  onClose,
  labelledBy,
  describedBy,
  className = '',
  panelClassName = '',
  scroll = true,
  autoHeight = false,
  header,
  footer,
  children,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  useBodyScrollLock(isOpen)
  useModalPresence(isOpen)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Escape closes (web convenience + accessibility)
  useEffect(() => {
    if (!isOpen) return
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) || null
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  // Focus trap + restore
  useEffect(() => {
    if (!isOpen) return

    const getFocusable = () => {
      const root = panelRef.current
      if (!root) return [] as HTMLElement[]
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
        )
      )
      return nodes.filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'))
    }

    const focusFirst = () => {
      const focusables = getFocusable()
      if (focusables.length > 0) {
        focusables[0].focus()
        return
      }
      panelRef.current?.focus()
    }

    const timer = window.setTimeout(() => {
      focusFirst()
    }, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusables = getFocusable()
      if (focusables.length === 0) {
        e.preventDefault()
        panelRef.current?.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (!active || active === first || !panelRef.current?.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (!active || active === last || !panelRef.current?.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
      // Restore focus to the element that opened the modal
      previouslyFocusedRef.current?.focus?.()
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={[
            'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 safe-area overflow-hidden',
            'flex items-end sm:items-center justify-center',
            // Keep padding off mobile bottom-sheet feel, add padding on desktop.
            'sm:p-4',
            className,
          ].join(' ')}
          data-modal="true"
          onMouseDown={(e) => {
            // Close only when pressing backdrop itself (prevents scroll/drag from closing).
            if (e.target === e.currentTarget) onClose()
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) {
              // Let iOS register touch but don't interfere with inner scroll.
              // Close happens on click/tap end by mouseDown analogue above on desktop; on mobile, we keep click.
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
          style={{
            paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={[
              'bg-white dark:bg-gray-800',
              'rounded-t-3xl sm:rounded-3xl',
              'w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-gray-700',
              'safe-area-inset flex flex-col overflow-hidden min-h-0',
              panelClassName,
            ].join(' ')}
            style={{
              // Height constraint is required for inner scroll to work reliably.
              // autoHeight: panel sizes to content; only maxHeight is set.
              ...(autoHeight
                ? {}
                : {
                    height:
                      'min(calc(100dvh - 1rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)), 92vh)',
                  }),
              maxHeight:
                'min(calc(100dvh - 1rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)), 92vh)',
            }}
          >
            {header}
            {scroll ? (
              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
                style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
              >
                {children}
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-hidden">
                {children}
              </div>
            )}
            {footer}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}


