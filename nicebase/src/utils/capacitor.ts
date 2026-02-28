/**
 * Capacitor utilities - Detect if running in native app and provide platform info
 */

// Try to import Capacitor modules - will work in native, fail gracefully in web
import type { CapacitorGlobal, CapacitorPlugins, AppPlugin, StatusBarPlugin, HapticsPlugin, WindowWithCapacitor } from '../types/capacitor'

let CapacitorModule: CapacitorGlobal | null = null
let StatusBarModule: StatusBarPlugin | null = null
let AppModule: AppPlugin | null = null
let HapticsModule: HapticsPlugin | null = null

// Check if we're in native environment
function isNativeEnv(): boolean {
  // In native builds, Capacitor is available via window
  if (typeof window !== 'undefined') {
    // Check for Capacitor global (set by Capacitor runtime in native builds)
    if ((window as WindowWithCapacitor).Capacitor) {
      return true
    }
    // Also check for CapacitorPlugins (another indicator of native build)
    if ((window as WindowWithCapacitor).CapacitorPlugins) {
      return true
    }
  }
  return false
}

// Load Capacitor - in native it's available via window, in web it's not available
function loadCapacitor() {
  if (CapacitorModule) return CapacitorModule
  
  // In native builds, Capacitor is injected by the Capacitor runtime
  if (typeof window !== 'undefined' && (window as WindowWithCapacitor).Capacitor) {
    CapacitorModule = (window as WindowWithCapacitor).Capacitor ?? null
    return CapacitorModule
  }
  
  // In web, Capacitor is not available
  return null
}

// Load Capacitor plugins - in native they're available via window, in web they're not
async function loadStatusBar() {
  if (StatusBarModule) return StatusBarModule
  if (!isNative()) return null
  
  try {
    const statusBar = (window as WindowWithCapacitor).CapacitorPlugins?.StatusBar
    if (statusBar) {
      StatusBarModule = statusBar ?? null
      return StatusBarModule
    }
    // Try dynamic import as fallback
    const module = await import('@capacitor/status-bar')
    const { Style } = module
    // Map the imported StatusBar to our interface
    StatusBarModule = {
      setStyle: async (options: { style: 'dark' | 'light' }) => {
        await module.StatusBar.setStyle({ style: options.style === 'dark' ? Style.Dark : Style.Light })
      },
      setBackgroundColor: module.StatusBar.setBackgroundColor,
      show: module.StatusBar.show,
      hide: module.StatusBar.hide,
    } as StatusBarPlugin
    return StatusBarModule
  } catch {
    return null
  }
}

async function loadApp() {
  if (AppModule) return AppModule
  if (!isNative()) return null
  
  try {
    const appPlugin = (window as WindowWithCapacitor).CapacitorPlugins?.App
    if (appPlugin) {
      AppModule = {
        addListener: (event: string, callback: (data: unknown) => void) => {
          return appPlugin.addListener(event as never, callback as never) as { remove: () => void } | Promise<{ remove: () => Promise<void> }>
        },
        removeAllListeners: appPlugin.removeAllListeners.bind(appPlugin),
        getLaunchUrl: appPlugin.getLaunchUrl.bind(appPlugin),
      } as AppPlugin
      return AppModule
    }
    // Try dynamic import as fallback
    const module = await import('@capacitor/app')
    AppModule = {
      addListener: (event: string, callback: (data: unknown) => void) => {
        return module.App.addListener(event as never, callback as never) as { remove: () => void } | Promise<{ remove: () => Promise<void> }>
      },
      removeAllListeners: module.App.removeAllListeners.bind(module.App),
      getLaunchUrl: module.App.getLaunchUrl.bind(module.App),
    } as AppPlugin
    return AppModule
  } catch {
    return null
  }
}

async function loadHaptics() {
  if (HapticsModule) return HapticsModule
  if (!isNative()) return null
  
  try {
    const hapticsPlugin = (window as WindowWithCapacitor).CapacitorPlugins?.Haptics
    if (hapticsPlugin) {
      HapticsModule = {
        impact: async (options: { style: 'light' | 'medium' | 'heavy' }) => {
          const { ImpactStyle } = await import('@capacitor/haptics')
          const styleMap: Record<string, string> = {
            light: ImpactStyle.Light,
            medium: ImpactStyle.Medium,
            heavy: ImpactStyle.Heavy,
          }
          await hapticsPlugin.impact({ style: styleMap[options.style] || ImpactStyle.Light } as never)
        },
        notification: async (options: { type: 'success' | 'warning' | 'error' }) => {
          const { NotificationType } = await import('@capacitor/haptics')
          const typeMap: Record<string, string> = {
            success: NotificationType.Success,
            warning: NotificationType.Warning,
            error: NotificationType.Error,
          }
          await hapticsPlugin.notification({ type: typeMap[options.type] || NotificationType.Success } as never)
        },
        selectionStart: hapticsPlugin.selectionStart.bind(hapticsPlugin),
        selectionChanged: hapticsPlugin.selectionChanged.bind(hapticsPlugin),
        selectionEnd: hapticsPlugin.selectionEnd.bind(hapticsPlugin),
        vibrate: hapticsPlugin.vibrate.bind(hapticsPlugin),
      } as HapticsPlugin
      return HapticsModule
    }
    // Try dynamic import as fallback
    const module = await import('@capacitor/haptics')
    const { ImpactStyle, NotificationType } = module
    HapticsModule = {
      impact: async (options: { style: 'light' | 'medium' | 'heavy' }) => {
        const styleMap: Record<string, string> = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy,
        }
        await module.Haptics.impact({ style: styleMap[options.style] || ImpactStyle.Light } as never)
      },
      notification: async (options: { type: 'success' | 'warning' | 'error' }) => {
        const typeMap: Record<string, string> = {
          success: NotificationType.Success,
          warning: NotificationType.Warning,
          error: NotificationType.Error,
        }
        await module.Haptics.notification({ type: typeMap[options.type] || NotificationType.Success } as never)
      },
      selectionStart: module.Haptics.selectionStart.bind(module.Haptics),
      selectionChanged: module.Haptics.selectionChanged.bind(module.Haptics),
      selectionEnd: module.Haptics.selectionEnd.bind(module.Haptics),
      vibrate: module.Haptics.vibrate.bind(module.Haptics),
    } as HapticsPlugin
    return HapticsModule
  } catch {
    return null
  }
}

/**
 * Check if app is running natively (iOS or Android)
 */
export const isNative = () => {
  // Check if Capacitor is available via window object (set by Capacitor runtime)
  if (typeof window !== 'undefined') {
    const capacitor = (window as WindowWithCapacitor).Capacitor
    if (capacitor) {
      return capacitor.isNativePlatform()
    }
  }
  return false
}

/**
 * Get current platform (web, ios, android)
 */
export const getPlatform = () => {
  const Capacitor = loadCapacitor()
  if (Capacitor) {
    return Capacitor.getPlatform()
  }
  return 'web'
}

/**
 * Check if running on iOS
 */
export const isIOS = () => {
  const platform = getPlatform()
  return platform === 'ios'
}

/**
 * Check if running on Android
 */
export const isAndroid = () => {
  const platform = getPlatform()
  return platform === 'android'
}

/**
 * Check if running on web
 */
export const isWeb = () => {
  const platform = getPlatform()
  return platform === 'web'
}

/**
 * Initialize Status Bar for native platforms
 * @param isDarkMode - Whether dark mode is enabled
 */
export const initializeStatusBar = async (isDarkMode: boolean = false) => {
  if (!isNative()) return

  try {
    const StatusBar = await loadStatusBar()
    if (!StatusBar) return

    // Set status bar style based on dark mode
    await StatusBar.setStyle({
      style: isDarkMode ? 'light' : 'dark',
    })

    // Set background color based on theme
    const backgroundColor = isDarkMode ? '#1f2937' : '#ffffff'
    await StatusBar.setBackgroundColor({
      color: backgroundColor,
    })

    // Note: setOverlaysWebView is not available in our StatusBarPlugin interface
    // This is handled by the native plugin configuration
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
    const Haptics = await loadHaptics()
    if (!Haptics) {
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

    await Haptics.impact({
      style: style,
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
export const setupAppListeners = async () => {
  if (!isNative()) return

  try {
    const App = await loadApp()
    if (!App) return

    // Handle app state changes
    App.addListener('appStateChange', (data: unknown) => {
      const { isActive } = data as { isActive: boolean }
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
        }
        // Note: exitApp is not available in our AppPlugin interface
        // This should be handled by the native app configuration
      })
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to setup app listeners:', error)
    }
  }
}

/**
 * Setup native app initialization
 * @param isDarkMode - Whether dark mode is enabled
 */
export const initializeNativeApp = async (isDarkMode: boolean = false) => {
  if (!isNative()) return

  await initializeStatusBar(isDarkMode)
  await setupAppListeners()
}










