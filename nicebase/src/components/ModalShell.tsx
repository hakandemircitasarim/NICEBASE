import type React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, useCallback } from 'react'
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
 * Track the real visible viewport height via the VisualViewport API
 * and detect whether the on-screen keyboard is open.
 *
 * On Android WebView with adjustResize, CSS vh/dvh units may NOT update
 * when the keyboard opens, but visualViewport.height always reflects
 * the true visible area. Falls back to window.innerHeight.
 *
 * keyboardOpen is true when the viewport has shrunk by more than 100px
 * compared to its maximum observed height (i.e. the keyboard appeared).
 */
function useVisualViewport(): { height: number; keyboardOpen: boolean } {
  const [height, setHeight] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.visualViewport?.height ?? window.innerHeight
    }
    return 800
  })
  // Track the largest viewport height we've ever seen.
  // This is the "full" height without keyboard.
  const maxHeightRef = useRef(height)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) {
      const onResize = () => {
        const h = window.innerHeight
        if (h > maxHeightRef.current) maxHeightRef.current = h
        setHeight(h)
      }
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }

    const onUpdate = () => {
      const h = vv.height
      if (h > maxHeightRef.current) maxHeightRef.current = h
      setHeight(h)
    }
    onUpdate()
    vv.addEventListener('resize', onUpdate)
    vv.addEventListener('scroll', onUpdate)
    return () => {
      vv.removeEventListener('resize', onUpdate)
      vv.removeEventListener('scroll', onUpdate)
    }
  }, [])

  const keyboardOpen = maxHeightRef.current - height > 100
  return { height, keyboardOpen }
}

/**
 * Web-first modal shell with a stable inner-scroll layout.
 *
 * On mobile it renders as a bottom-sheet that extends to the very bottom
 * of the screen. The panel height is driven by the VisualViewport API so
 * it reacts correctly when the Android keyboard opens/closes.
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
  const { height: vpHeight, keyboardOpen } = useVisualViewport()

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

  // Panel height driven by real visual-viewport pixels.
  // Reserve a small gap at the top so the backdrop peeks through.
  const panelMaxPx = Math.floor(vpHeight * 0.92)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={[
            'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-hidden',
            'flex items-end sm:items-center justify-center',
            'sm:p-4',
            className,
          ].join(' ')}
          data-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) {
              // Let iOS register touch but don't interfere with inner scroll.
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
          style={{
            // On desktop (sm+), keep safe-area padding. On mobile the panel
            // extends to the bottom edge so we only need top padding.
            paddingTop: 'max(0.5rem, var(--safe-area-inset-top, 0px))',
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
              'flex flex-col overflow-hidden min-h-0',
              panelClassName,
            ].join(' ')}
            style={{
              // Use JS-driven pixel values so the panel reacts instantly
              // when the Android keyboard opens/closes.
              ...(autoHeight
                ? {}
                : { height: `${panelMaxPx}px` }),
              maxHeight: `${panelMaxPx}px`,
            }}
          >
            {header && <div className="flex-shrink-0">{header}</div>}
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
            {footer && (
              <div
                className="flex-shrink-0"
                style={{
                  // Only add safe-area bottom padding when keyboard is CLOSED.
                  // When keyboard is open, nav bar is behind the keyboard so no padding needed.
                  paddingBottom: keyboardOpen ? 0 : 'var(--safe-area-inset-bottom, 0px)',
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
