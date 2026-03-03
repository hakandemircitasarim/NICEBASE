import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase, hasSupabaseConfig } from '../lib/supabase'
import { errorLoggingService } from '../services/errorLoggingService'
import { hapticFeedback } from '../utils/haptic'
import { isNative } from '../utils/capacitor'
import type { WindowWithCapacitor } from '../types/capacitor'

// Dynamically load App plugin at runtime if available
async function getAppPlugin() {
  if (!isNative()) return null
  try {
    if (typeof window !== 'undefined') {
      const plugins = (window as WindowWithCapacitor).CapacitorPlugins
      if (plugins?.App) {
        return plugins.App
      }
    }
    const module = await import('@capacitor/app')
    return module.App
  } catch {
    return null
  }
}

// Dynamically load Browser plugin at runtime if available
async function getBrowserPlugin() {
  if (!isNative()) return null
  try {
    const module = await import('@capacitor/browser')
    return module.Browser
  } catch {
    return null
  }
}

/**
 * Custom hook for handling Google OAuth authentication
 */
export function useOAuth() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  // Set up deep link listener for OAuth callback (native only)
  useEffect(() => {
    if (!isNative()) return

    let listener: { remove: () => Promise<void> } | { remove: () => void } | null = null
    let aborted = false

    const setupListener = async () => {
      const App = await getAppPlugin()
      if (!App || aborted) return

      try {
        const listenerResult = (App.addListener as (event: string, callback: (data: unknown) => void) => { remove: () => void } | Promise<{ remove: () => Promise<void> }>)('appUrlOpen', async (data: unknown) => {
          const { url: urlString } = data as { url: string }
          try {
            if (urlString.includes('code=') || urlString.includes('error=') || urlString.includes('#access_token=') || urlString.includes('access_token=')) {
              let params = ''
              if (urlString.includes('#')) {
                params = urlString.split('#')[1]
              } else if (urlString.includes('?')) {
                params = urlString.split('?')[1]
              }

              if (params) {
                const callbackUrl = `${window.location.origin}/#${params}`
                window.location.href = callbackUrl
              }
            }
          } catch (error) {
            console.error('OAuth callback error:', error)
          }
        })

        if (listenerResult instanceof Promise) {
          const resolved = await listenerResult
          if (resolved && 'remove' in resolved) {
            const removeFn = resolved.remove
            listener = typeof removeFn === 'function'
              ? { remove: async () => { await removeFn() } }
              : null
          }
        } else if (listenerResult && 'remove' in listenerResult) {
          const removeFn = listenerResult.remove
          listener = typeof removeFn === 'function'
            ? { remove: async () => { await Promise.resolve(removeFn()) } }
            : null
        }
      } catch (error) {
        console.error('Failed to setup OAuth listener:', error)
      }
    }

    setupListener()

    return () => {
      aborted = true
      if (listener) {
        const removeResult = listener.remove()
        if (removeResult instanceof Promise) {
          removeResult.catch(() => {})
        }
        listener = null
      }
    }
  }, [])

  /**
   * Handles Google OAuth login
   */
  const handleOAuthLogin = useCallback(async (_provider: 'google' = 'google') => {
    try {
      hapticFeedback('light')
      setLoading(true)

      if (!hasSupabaseConfig) {
        toast.error(t('invalidApiKey'))
        setLoading(false)
        return
      }

      // Determine redirect URL
      let redirectTo: string

      if (isNative()) {
        redirectTo = import.meta.env.VITE_OAUTH_REDIRECT_URL || 'com.nicebase.app://oauth/callback'
      } else {
        // Web: use current origin
        const webRedirectUrl = import.meta.env.VITE_OAUTH_WEB_REDIRECT_URL
        redirectTo = webRedirectUrl || `${window.location.origin}/`
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          // On web: let the browser redirect naturally (no skipBrowserRedirect)
          // On native: get URL to open in in-app browser
          skipBrowserRedirect: isNative(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) throw error

      if (isNative() && data?.url) {
        // Native: open in-app browser
        const Browser = await getBrowserPlugin()
        if (Browser) {
          await Browser.open({
            url: data.url,
            windowName: '_self',
          })

          const finishedListener = await Browser.addListener('browserFinished', async () => {
            setLoading(false)
            if (finishedListener && 'remove' in finishedListener) {
              finishedListener.remove()
            }
          })
          setLoading(false)
        } else {
          // Fallback: system browser
          window.open(data.url, '_system')
        }
      }
      // On web, Supabase handles the redirect automatically (skipBrowserRedirect is false)
    } catch (error: unknown) {
      hapticFeedback('error')
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('OAuth login error'),
        'error'
      )

      let userMessage = t('oauthError')
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes('popup_closed_by_user')) {
        userMessage = t('oauthCancelled')
      } else if (errorMessage) {
        userMessage = errorMessage
      }

      toast.error(userMessage)
      setLoading(false)
    }
  }, [t])

  return {
    handleOAuthLogin,
    loading,
  }
}
