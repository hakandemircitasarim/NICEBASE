/**
 * Haptic feedback utilities for mobile devices
 * Uses Capacitor Haptics on native platforms, falls back to web vibration
 */

import { nativeHapticFeedback, isNative } from './capacitor'

export function hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'medium') {
  if (isNative()) {
    // Use native haptics on mobile
    const nativeStyle = type === 'warning' || type === 'error' ? 'heavy' : type === 'success' ? 'medium' : type
    if (nativeStyle === 'light' || nativeStyle === 'medium' || nativeStyle === 'heavy') {
      nativeHapticFeedback(nativeStyle)
    } else {
      nativeHapticFeedback('light')
    }
    return
  }

  // Fallback to web vibration
  if (!('vibrate' in navigator)) return

  const patterns: Record<string, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [20, 50, 20],
    error: [30, 100, 30],
  }

  navigator.vibrate(patterns[type] || patterns.medium)
}













