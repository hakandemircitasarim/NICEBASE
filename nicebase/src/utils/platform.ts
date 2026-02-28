import type { WindowWithCapacitor } from '../types/capacitor'

/**
 * Checks if the app is running on a native platform (iOS/Android)
 * @returns true if running on native platform, false otherwise
 */
export function isNativePlatform(): boolean {
  // Check if Capacitor is available (only in native builds)
  // In native builds, Capacitor is injected by the Capacitor runtime
  if (typeof window !== 'undefined') {
    const capacitor = (window as WindowWithCapacitor).Capacitor
    if (capacitor) {
      return capacitor.isNativePlatform()
    }
    // Also check for CapacitorPlugins as fallback
    if ((window as WindowWithCapacitor).CapacitorPlugins) {
      return true
    }
  }
  return false
}

/**
 * Checks if the app is running on a web platform
 * @returns true if running on web platform, false otherwise
 */
export function isWebPlatform(): boolean {
  return !isNativePlatform()
}






