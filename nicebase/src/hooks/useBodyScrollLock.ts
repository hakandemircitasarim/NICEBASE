import { useEffect } from 'react'
import { isNative, isIOS } from '../utils/capacitor'

/**
 * Hook to lock/unlock body scroll when a modal is open
 * Prevents background scrolling on iOS and other mobile devices
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (isLocked) {
      const scrollY = window.scrollY
      const prevHtmlOverflow = document.documentElement.style.overflow
      const prevBodyOverflow = document.body.style.overflow
      const prevBodyPosition = document.body.style.position
      const prevBodyTop = document.body.style.top
      const prevBodyWidth = document.body.style.width

      // Web (including device emulation): use overflow only. It preserves nested modal scrolling.
      if (!isNative()) {
        document.documentElement.style.overflow = 'hidden'
        document.body.style.overflow = 'hidden'
        return () => {
          document.documentElement.style.overflow = prevHtmlOverflow
          document.body.style.overflow = prevBodyOverflow
        }
      }

      // Native: iOS needs position:fixed to prevent background bounce; Android is fine with overflow.
      if (!isIOS()) {
        document.documentElement.style.overflow = 'hidden'
        document.body.style.overflow = 'hidden'
        return () => {
          document.documentElement.style.overflow = prevHtmlOverflow
          document.body.style.overflow = prevBodyOverflow
        }
      }

      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'

      return () => {
        document.documentElement.style.overflow = prevHtmlOverflow
        document.body.style.overflow = prevBodyOverflow
        document.body.style.position = prevBodyPosition
        document.body.style.top = prevBodyTop
        document.body.style.width = prevBodyWidth
        window.scrollTo(0, scrollY)
      }
    }
  }, [isLocked])
}
