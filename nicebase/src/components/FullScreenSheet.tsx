import type React from 'react'

interface FullScreenSheetProps {
  header?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Native/mobile-friendly full screen container.
 * Use for Capacitor routes so keyboard/safe-area behave like a normal page.
 */
export default function FullScreenSheet({
  header,
  footer,
  children,
  className = '',
}: FullScreenSheetProps) {
  return (
    <div
      className={['safe-area-inset', className].join(' ')}
      style={{ position: 'fixed', inset: 0, display: 'grid', gridTemplateRows: header && footer ? 'auto 1fr auto' : header ? 'auto 1fr' : footer ? '1fr auto' : '1fr', overflow: 'hidden' }}
    >
      {header}
      <div className="overflow-y-auto overscroll-contain" style={{ minHeight: 0, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {children}
      </div>
      {footer}
    </div>
  )
}




