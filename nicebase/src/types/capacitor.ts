/**
 * Type definitions for Capacitor plugins and global objects
 */

/**
 * Capacitor global object
 */
export interface CapacitorGlobal {
  isNativePlatform(): boolean
  getPlatform(): string
}

/**
 * Capacitor Plugins namespace
 */
export interface CapacitorPlugins {
  App?: AppPlugin
  StatusBar?: StatusBarPlugin
  Haptics?: HapticsPlugin
  PushNotifications?: PushNotificationsPlugin
  LocalNotifications?: LocalNotificationsPlugin
}

/**
 * App plugin interface
 */
export interface AppPlugin {
  addListener(event: string, callback: (data: unknown) => void): { remove: () => void } | Promise<{ remove: () => Promise<void> }>
  removeAllListeners(): void
  getLaunchUrl(): Promise<{ url: string } | null>
}

/**
 * StatusBar plugin interface
 */
export interface StatusBarPlugin {
  setStyle(options: { style: 'dark' | 'light' }): Promise<void>
  setBackgroundColor(options: { color: string }): Promise<void>
  show(): Promise<void>
  hide(): Promise<void>
}

/**
 * Haptics plugin interface
 */
export interface HapticsPlugin {
  impact(options: { style: 'light' | 'medium' | 'heavy' }): Promise<void>
  notification(options: { type: 'success' | 'warning' | 'error' }): Promise<void>
  selectionStart(): Promise<void>
  selectionChanged(): Promise<void>
  selectionEnd(): Promise<void>
  vibrate(options?: { duration: number }): Promise<void>
}

/**
 * PushNotifications plugin interface
 */
export interface PushNotificationsPlugin {
  register(): Promise<void>
  requestPermission(): Promise<{ granted: boolean }>
  addListener(event: string, callback: (data: unknown) => void): { remove: () => void }
  removeAllListeners(): void
}

/**
 * LocalNotifications plugin interface
 */
export interface LocalNotificationsPlugin {
  schedule(options: { notifications: Array<{
    title: string
    body: string
    id: number
    schedule?: {
      at?: Date
      repeats?: boolean
      every?: string
    }
  }> }): Promise<void>
  cancel(options: { notifications: Array<{ id: number }> }): Promise<void>
  getPending(): Promise<{ notifications: Array<unknown> }>
  removeAllListeners(): void
}

/**
 * Extended Window interface with Capacitor
 */
export interface WindowWithCapacitor extends Omit<Window, 'SpeechRecognition' | 'webkitSpeechRecognition'> {
  Capacitor?: CapacitorGlobal
  CapacitorPlugins?: CapacitorPlugins
  webkitSpeechRecognition?: {
    new (): SpeechRecognition
  }
  SpeechRecognition?: {
    new (): SpeechRecognition
  }
}

// Speech Recognition types
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
