import { Capacitor } from '@capacitor/core'

/**
 * Checks if the app is running on a native platform (iOS/Android)
 * @returns true if running on native platform, false otherwise
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Checks if the app is running on a web platform
 * @returns true if running on web platform, false otherwise
 */
export function isWebPlatform(): boolean {
  return !Capacitor.isNativePlatform()
}






