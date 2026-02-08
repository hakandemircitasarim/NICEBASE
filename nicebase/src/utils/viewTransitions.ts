/**
 * View Transitions API utilities
 * Provides smooth page transitions using the native View Transitions API
 */

/**
 * Check if View Transitions API is supported
 */
export const supportsViewTransitions = (): boolean => {
  return 'startViewTransition' in document && typeof (document as any).startViewTransition === 'function'
}

/**
 * Start a view transition
 * @param callback - Callback function to execute during transition
 */
export const startViewTransition = (callback: () => void | Promise<void>) => {
  if (!supportsViewTransitions()) {
    // Fallback: execute callback without transition
    const result = callback()
    return Promise.resolve(result)
  }

  return (document as any).startViewTransition(() => {
    const result = callback()
    return result instanceof Promise ? result : Promise.resolve()
  })
}

/**
 * Set view transition name for an element
 * @param element - DOM element
 * @param name - Transition name
 */
export const setViewTransitionName = (element: HTMLElement | null, name: string | null) => {
  if (!element || !supportsViewTransitions()) return

  if (name) {
    element.style.viewTransitionName = name
  } else {
    element.style.viewTransitionName = ''
  }
}










