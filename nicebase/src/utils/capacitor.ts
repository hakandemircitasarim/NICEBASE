/**
 * Capacitor utilities - Detect if running in native app and provide platform info
 */

import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { App } from '@capacitor/app'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

/**
 * Check if app is running natively (iOS or Android)
 */
export const isNative = () => {
  return Capacitor.isNativePlatform()
}

/**
 * Get current platform (web, ios, android)
 */
export const getPlatform = () => {
  return Capacitor.getPlatform()
}

/**
 * Check if running on iOS
 */
export const isIOS = () => {
  return getPlatform() === 'ios'
}

/**
 * Check if running on Android
 */
export const isAndroid = () => {
  return getPlatform() === 'android'
}

/**
 * Check if running on web
 */
export const isWeb = () => {
  return getPlatform() === 'web'
}

/**
 * Initialize Status Bar for native platforms
 * @param isDarkMode - Whether dark mode is enabled
 */
export const initializeStatusBar = async (isDarkMode: boolean = false) => {
  if (!isNative()) return

  try {
    // Set status bar style based on dark mode
    const statusBarStyle = isDarkMode ? Style.Light : Style.Dark
    await StatusBar.setStyle({
      style: statusBarStyle,
    })

    // Set background color based on theme
    const backgroundColor = isDarkMode ? '#1f2937' : '#ffffff'
    await StatusBar.setBackgroundColor({
      color: backgroundColor,
    })

    if (isIOS()) {
      await StatusBar.setOverlaysWebView({
        overlay: false,
      })
    }
  } catch (error) {
    // StatusBar initialization failed - non-critical
    if (import.meta.env.DEV) {
      console.warn('StatusBar initialization failed:', error)
    }
  }
}

/**
 * Update Status Bar when theme changes
 */
export const updateStatusBar = async (isDarkMode: boolean) => {
  await initializeStatusBar(isDarkMode)
}

/**
 * Native haptic feedback using Capacitor Haptics
 * Falls back to web vibration if not available
 */
export const nativeHapticFeedback = async (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if (!isNative()) {
    // Fallback to web vibration
    if ('vibrate' in navigator) {
      const patterns: Record<string, number> = {
        light: 10,
        medium: 20,
        heavy: 40,
      }
      navigator.vibrate(patterns[style] || 10)
    }
    return
  }

  try {
    const impactStyle: Record<string, ImpactStyle> = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    }

    await Haptics.impact({
      style: impactStyle[style] || ImpactStyle.Light,
    })
  } catch (error) {
    // Haptic feedback failed - non-critical, fail silently
    if (import.meta.env.DEV) {
      console.warn('Haptic feedback failed:', error)
    }
  }
}

// Store back button handler in a ref so it can be updated
let backButtonHandler: (() => boolean) | null = null

/**
 * Set the back button handler (can be updated dynamically)
 */
export const setBackButtonHandler = (handler: (() => boolean) | null) => {
  backButtonHandler = handler
}

/**
 * Setup app state listeners (native only)
 * Should only be called once
 */
export const setupAppListeners = () => {
  if (!isNative()) return

  // Handle app state changes
  App.addListener('appStateChange', ({ isActive }) => {
    // App state changed - can be used for analytics or background sync
    if (import.meta.env.DEV) {
      console.log('App state changed. Is active?', isActive)
    }
  })

  // Handle back button on Android
  if (isAndroid()) {
    App.addListener('backButton', () => {
      // If custom handler is provided and returns true, don't use default behavior
      if (backButtonHandler && backButtonHandler()) {
        return
      }

      // Check if we can go back in history
      if (window.history.length > 1) {
        window.history.back()
      } else {
        // If no history, exit app (only on Android)
        App.exitApp()
      }
    })
  }
}

/**
 * Setup native app initialization
 * @param isDarkMode - Whether dark mode is enabled
 */
export const initializeNativeApp = async (isDarkMode: boolean = false) => {
  if (!isNative()) return

  await initializeStatusBar(isDarkMode)
  setupAppListeners()
}








