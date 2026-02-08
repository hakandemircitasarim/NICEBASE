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
    <div className={['min-h-[100dvh] flex flex-col safe-area-inset', className].join(' ')}>
      {header}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' as any }}>
        {children}
      </div>
      {footer}
    </div>
  )
}




