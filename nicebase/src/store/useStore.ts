import { create } from 'zustand'
import { User } from '../types'
import i18n from '../i18n'

interface AppState {
  user: User | null
  isOnline: boolean
  theme: 'light' | 'dark'
  language: 'tr' | 'en'
  hasCompletedOnboarding: boolean
  openModalCount: number
  setUser: (user: User | null) => void
  setTheme: (theme: 'light' | 'dark') => void
  setLanguage: (lang: 'tr' | 'en') => void
  setHasCompletedOnboarding: (completed: boolean) => void
  incrementModalCount: () => void
  decrementModalCount: () => void
  checkOnlineStatus: () => void
  init: () => Promise<void>
}

let onlineListenersRegistered = false

// Safe localStorage access
const getStoredTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  try {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  } catch {
    return 'light'
  }
}

const getStoredLanguage = (): 'tr' | 'en' => {
  if (typeof window === 'undefined') return 'tr'
  try {
    return (localStorage.getItem('language') as 'tr' | 'en') || 'tr'
  } catch {
    return 'tr'
  }
}

const getStoredOnboarding = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('hasCompletedOnboarding') === 'true'
  } catch {
    return false
  }
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  theme: getStoredTheme(),
  language: getStoredLanguage(),
  hasCompletedOnboarding: getStoredOnboarding(),
  openModalCount: 0,

  setUser: (user) => {
    set({ user })
    // If user has a language preference, apply it
    if (user?.language && user.language !== get().language) {
      get().setLanguage(user.language)
    }
  },

  setTheme: (theme) => {
    try {
      localStorage.setItem('theme', theme)
    } catch (e) {
      // localStorage might be disabled, fail silently
      if (import.meta.env.DEV) {
        console.warn('Failed to save theme to localStorage:', e)
      }
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
    set({ theme })
  },

  setLanguage: (language) => {
    try {
      localStorage.setItem('language', language)
    } catch (e) {
      // localStorage might be disabled, fail silently
      if (import.meta.env.DEV) {
        console.warn('Failed to save language to localStorage:', e)
      }
    }
    // Only change language if i18n is initialized
    try {
      if (i18n && typeof i18n.changeLanguage === 'function') {
        i18n.changeLanguage(language)
      }
    } catch (e) {
      // i18n might not be ready, fail silently
      if (import.meta.env.DEV) {
        console.warn('Failed to change i18n language:', e)
      }
    }
    set({ language })
  },

  setHasCompletedOnboarding: (completed) => {
    localStorage.setItem('hasCompletedOnboarding', completed.toString())
    set({ hasCompletedOnboarding: completed })
  },

  incrementModalCount: () => {
    set({ openModalCount: get().openModalCount + 1 })
  },

  decrementModalCount: () => {
    set({ openModalCount: Math.max(0, get().openModalCount - 1) })
  },

  checkOnlineStatus: () => {
    set({ isOnline: navigator.onLine })
  },

  init: async () => {
    // Set theme
    const theme = get().theme
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }

    // Set language in i18n (only if i18n is ready)
    const language = get().language
    try {
      if (i18n && typeof i18n.changeLanguage === 'function') {
        i18n.changeLanguage(language)
      }
    } catch (e) {
      // i18n might not be ready, fail silently
      if (import.meta.env.DEV) {
        console.warn('Failed to initialize i18n language:', e)
      }
    }

    // Listen to online/offline
    if (typeof window !== 'undefined') {
      if (!onlineListenersRegistered) {
        window.addEventListener('online', get().checkOnlineStatus)
        window.addEventListener('offline', get().checkOnlineStatus)
        onlineListenersRegistered = true
      }
    }
  },
}))

