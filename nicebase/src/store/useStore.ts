import { create } from 'zustand'
import { User } from '../types'
import i18n from '../i18n'

type ThemePreference = 'light' | 'dark' | 'system'

interface AppState {
  user: User | null
  isOnline: boolean
  // Resolved theme actually applied to the DOM/status bar ('system' is resolved
  // to light/dark via matchMedia). Kept as light|dark so all consumers stay simple.
  theme: 'light' | 'dark'
  // The user's chosen preference, which may be 'system' (follow OS).
  themePreference: ThemePreference
  language: 'tr' | 'en'
  hasCompletedOnboarding: boolean
  openModalCount: number
  setUser: (user: User | null) => void
  setTheme: (theme: 'light' | 'dark') => void
  // Set the theme preference; when 'system', resolves to the current OS scheme
  // and keeps following later OS changes.
  setThemePreference: (preference: ThemePreference) => void
  setLanguage: (lang: 'tr' | 'en') => void
  setHasCompletedOnboarding: (completed: boolean) => void
  // Re-arm the onboarding tour so the user can replay it (e.g. from Settings).
  resetOnboarding: () => void
  incrementModalCount: () => void
  decrementModalCount: () => void
  checkOnlineStatus: () => void
  init: () => Promise<void>
}

// Resolve the OS-preferred color scheme. Falls back to 'light' when matchMedia
// is unavailable (SSR / very old WebViews).
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

// Safe localStorage access — reads the persisted *preference* ('light'|'dark'|'system').
const getStoredThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'light'
  try {
    const pref = localStorage.getItem('themePreference')
    if (pref === 'light' || pref === 'dark' || pref === 'system') {
      return pref
    }
    // Backwards compatibility: older builds stored only the resolved theme under
    // the 'theme' key. Honour it so existing users keep their choice.
    const legacy = localStorage.getItem('theme')
    if (legacy === 'light' || legacy === 'dark') {
      return legacy
    }
    return 'light'
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to read theme preference from localStorage:', error)
    }
    return 'light'
  }
}

// Resolve a preference to the concrete theme that drives the DOM.
const resolveTheme = (preference: ThemePreference): 'light' | 'dark' =>
  preference === 'system' ? getSystemTheme() : preference

const getStoredLanguage = (): 'tr' | 'en' => {
  if (typeof window === 'undefined') return 'tr'
  try {
    const language = localStorage.getItem('language')
    // Type guard for language value
    if (language === 'tr' || language === 'en') {
      return language
    }
    return 'tr'
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to read language from localStorage:', error)
    }
    return 'tr'
  }
}

const getStoredOnboarding = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('hasCompletedOnboarding') === 'true'
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to read onboarding status from localStorage:', error)
    }
    return false
  }
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  themePreference: getStoredThemePreference(),
  theme: resolveTheme(getStoredThemePreference()),
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
    // An explicit light/dark choice is also an explicit preference.
    get().setThemePreference(theme)
  },

  setThemePreference: (preference) => {
    const resolved = resolveTheme(preference)
    try {
      localStorage.setItem('themePreference', preference)
      // Keep the legacy 'theme' key in sync with the resolved value so any code
      // (or older build) reading it still gets a usable light/dark value.
      localStorage.setItem('theme', resolved)
    } catch (e) {
      // localStorage might be disabled, fail silently
      if (import.meta.env.DEV) {
        console.warn('Failed to save theme preference to localStorage:', e)
      }
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', resolved === 'dark')
    }
    set({ theme: resolved, themePreference: preference })
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
    try {
      localStorage.setItem('hasCompletedOnboarding', completed.toString())
    } catch (e) {
      // localStorage might be disabled, fail silently (consistent with the
      // other setters) — but still update state below.
      if (import.meta.env.DEV) {
        console.warn('Failed to save onboarding status to localStorage:', e)
      }
    }
    set({ hasCompletedOnboarding: completed })
  },

  resetOnboarding: () => {
    get().setHasCompletedOnboarding(false)
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
    // Set theme from the resolved preference (handles 'system').
    const resolved = resolveTheme(get().themePreference)
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', resolved === 'dark')
    }
    if (resolved !== get().theme) {
      set({ theme: resolved })
    }

    // Follow OS theme changes while the user's preference is 'system'.
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const onChange = () => {
          if (get().themePreference !== 'system') return
          const next: 'light' | 'dark' = mq.matches ? 'dark' : 'light'
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next === 'dark')
          }
          set({ theme: next })
        }
        // addEventListener is the modern API; older Safari/WebView need addListener.
        if (typeof mq.addEventListener === 'function') {
          mq.addEventListener('change', onChange)
        } else if (typeof mq.addListener === 'function') {
          mq.addListener(onChange)
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('Failed to attach OS theme listener:', e)
        }
      }
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

    // Online/offline listeners are owned solely by OfflineIndicator (always
    // mounted in Layout), which calls checkOnlineStatus — no duplicate set here.
  },
}))

