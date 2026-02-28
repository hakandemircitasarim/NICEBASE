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
    // Try dynamic import as fallback
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
    // Dynamic import at runtime - module is external in Vite config
    const module = await import('@capacitor/browser')
    return module.Browser
  } catch {
    return null
  }
}

/**
 * Custom hook for handling OAuth authentication
 */
export function useOAuth() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  // Set up deep link listener for OAuth callback
  useEffect(() => {
    if (!isNative()) return

    let listener: { remove: () => Promise<void> } | { remove: () => void } | null = null
    let browserListener: { remove: () => Promise<void> } | null = null

    const setupListener = async () => {
      const App = await getAppPlugin()
      if (!App) return

      try {
        const listenerResult = (App.addListener as (event: string, callback: (data: unknown) => void) => { remove: () => void } | Promise<{ remove: () => Promise<void> }>)('appUrlOpen', async (data: unknown) => {
          const { url: urlString } = data as { url: string }
          try {
            // Check if this is an OAuth callback
            if (urlString.includes('code=') || urlString.includes('error=') || urlString.includes('#access_token=') || urlString.includes('access_token=')) {
              if (import.meta.env.DEV) {
                console.log('OAuth callback received:', urlString)
              }
              
              // Parse the URL to extract parameters
              // Handle both query string and hash fragment formats
              let params = ''
              if (urlString.includes('#')) {
                params = urlString.split('#')[1]
              } else if (urlString.includes('?')) {
                params = urlString.split('?')[1]
              }
              
              if (params) {
                // Reconstruct URL with current origin for Supabase to process
                const callbackUrl = `${window.location.origin}/#${params}`
                
                // Navigate to callback URL - Supabase will handle it
                window.location.href = callbackUrl
              }
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.error('OAuth callback error:', error)
            }
          }
        })
        
        // Handle both sync and async listener return types
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
        if (import.meta.env.DEV) {
          console.error('Failed to setup OAuth listener:', error)
        }
      }
    }

    setupListener()

    // Cleanup function - remove all listeners when component unmounts
    return () => {
      if (listener) {
        const removeResult = listener.remove()
        if (removeResult instanceof Promise) {
          removeResult.catch(() => {})
        }
        listener = null
      }
      if (browserListener) {
        const removeResult = browserListener.remove()
        if (removeResult instanceof Promise) {
          removeResult.catch(() => {})
        }
        browserListener = null
      }
    }
  }, [])

  /**
   * Handles OAuth login with the specified provider
   * @param provider - OAuth provider ('google' or 'apple')
   */
  const handleOAuthLogin = useCallback(async (provider: 'google' | 'apple') => {
    try {
      hapticFeedback('light')
      setLoading(true)

      if (!hasSupabaseConfig) {
        toast.error(t('invalidApiKey'))
        setLoading(false)
        return
      }

      const queryParams = provider === 'google'
        ? { access_type: 'offline', prompt: 'consent' }
        : undefined

      // Determine redirect URL
      // For native apps, we need to use a web URL that Supabase can redirect to
      // The callback will be handled by the appUrlOpen listener
      let redirectTo: string
      
      if (isNative()) {
        // In native, use custom URL scheme for OAuth redirect
        // This allows the app to receive the callback via deep link
        // Can be overridden via environment variable
        redirectTo = import.meta.env.VITE_OAUTH_REDIRECT_URL || 'com.nicebase.app://oauth/callback'
      } else {
        // Web: use current origin
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        // Use environment variable if set, otherwise use current origin
        const webRedirectUrl = import.meta.env.VITE_OAUTH_WEB_REDIRECT_URL
        redirectTo = webRedirectUrl || (import.meta.env.DEV && isLocalHost
          ? `http://${window.location.host}/`
          : `${window.location.origin}/`)
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams,
        },
      })

      if (error) throw error

      if (data?.url) {
        if (isNative()) {
          // Use in-app browser for OAuth flow
          const Browser = await getBrowserPlugin()
          if (Browser) {
            // Open in-app browser - callback will be handled by appUrlOpen listener
            await Browser.open({
              url: data.url,
              windowName: '_self',
            })
            
            // Listen for browser close
            // Note: The listener will be automatically removed when browserFinished fires
            // If component unmounts before that, the listener will be cleaned up by the browser plugin
            await Browser.addListener('browserFinished', async () => {
              // Auth state change will be handled by App.tsx listener
              // Listener is automatically removed by Capacitor when event fires
            })
          } else {
            // Fallback: open in system browser
            // Note: This will redirect back to the app via deep link if configured
            window.open(data.url, '_system')
          }
        } else {
          window.location.assign(data.url)
        }
        return
      }

      throw new Error('OAuth redirect URL missing')
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





