import { useState, useEffect } from 'react'

/**
 * Detects whether the virtual keyboard is visible using the visualViewport API.
 *
 * On Android WebView with viewport-fit=cover, env(safe-area-inset-bottom)
 * returns the nav-bar height at all times — even when the keyboard is open
 * and the nav bar is hidden. This hook lets components apply safe-area
 * padding only when the keyboard is closed (nav bar visible).
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      // When keyboard is open, visualViewport.height is significantly
      // smaller than window.innerHeight (the layout viewport).
      setVisible(window.innerHeight - vv.height > 100)
    }

    vv.addEventListener('resize', update)
    update()
    return () => vv.removeEventListener('resize', update)
  }, [])

  return visible
}
