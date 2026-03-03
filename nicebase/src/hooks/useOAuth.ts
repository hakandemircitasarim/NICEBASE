import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase, hasSupabaseConfig } from '../lib/supabase'
import { errorLoggingService } from '../services/errorLoggingService'
import { hapticFeedback } from '../utils/haptic'
import { isNative } from '../utils/capacitor'

// Module-level Browser reference so the deep-link callback can close it
let _browserRef: { close: () => Promise<void> } | null = null

// Dynamically load App plugin at runtime if available
async function getAppPlugin() {
  if (!isNative()) return null
  try {
    const module = await import('@capacitor/app')
    return module.App
  } catch {
    return null
  }
}

// Dynamically load Browser plugin at runtime if available
async function getBrowserPlugin() {
  const native = isNative()
  console.log('[OAuth] getBrowserPlugin: isNative =', native)
  if (!native) return null
  try {
    const module = await import('@capacitor/browser')
    console.log('[OAuth] getBrowserPlugin: @capacitor/browser loaded OK, Browser =', !!module.Browser)
    _browserRef = module.Browser
    return module.Browser
  } catch (e) {
    console.error('[OAuth] getBrowserPlugin: import FAILED', e)
    return null
  }
}

/**
 * Custom hook for handling Google OAuth authentication
 */
export function useOAuth() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

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
          if (!urlString) return

          try {
            // 1) Close the in-app browser (Chrome Custom Tab) immediately
            if (_browserRef) {
              try { await _browserRef.close() } catch { /* already closed */ }
            }

            // 2) Parse the callback URL
            const url = new URL(urlString)
            const searchParams = new URLSearchParams(url.search || '')
            const hashParams = new URLSearchParams((url.hash || '').replace('#', ''))

            // 3) Check for error from provider
            const errorParam = searchParams.get('error') || hashParams.get('error')
            if (errorParam) {
              const desc = searchParams.get('error_description') || hashParams.get('error_description') || errorParam
              console.error('[OAuth] Provider error:', desc)
              toast.error(desc)
              loadingRef.current = false
              setLoading(false)
              return
            }

            // 4) PKCE flow: exchange authorization code for session
            const code = searchParams.get('code') || hashParams.get('code')
            if (code) {
              const { error } = await supabase.auth.exchangeCodeForSession(code)
              if (error) {
                console.error('[OAuth] Code exchange failed:', error.message)
                toast.error(t('oauthError'))
              }
              // App.tsx onAuthStateChange will handle the rest (setUser, sync)
              loadingRef.current = false
              setLoading(false)
              return
            }

            // 5) Implicit flow fallback: extract tokens from hash
            const accessToken = hashParams.get('access_token')
            const refreshToken = hashParams.get('refresh_token')
            if (accessToken) {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              })
              if (error) {
                console.error('[OAuth] setSession failed:', error.message)
                toast.error(t('oauthError'))
              }
              loadingRef.current = false
              setLoading(false)
              return
            }
          } catch (error) {
            console.error('[OAuth] Callback error:', error)
            loadingRef.current = false
            setLoading(false)
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
        console.error('[OAuth] Failed to setup listener:', error)
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
  }, [t])

  /**
   * Handles Google OAuth login
   */
  const handleOAuthLogin = useCallback(async (_provider: 'google' = 'google') => {
    try {
      hapticFeedback('light')
      setLoading(true)
      loadingRef.current = true

      console.log('[OAuth] handleOAuthLogin: isNative =', isNative())

      if (!hasSupabaseConfig) {
        toast.error(t('invalidApiKey'))
        setLoading(false)
        loadingRef.current = false
        return
      }

      // Determine redirect URL
      let redirectTo: string

      if (isNative()) {
        redirectTo = import.meta.env.VITE_OAUTH_REDIRECT_URL || 'com.nicebase.app://oauth/callback'
      } else {
        const webRedirectUrl = import.meta.env.VITE_OAUTH_WEB_REDIRECT_URL
        redirectTo = webRedirectUrl || `${window.location.origin}/`
      }

      console.log('[OAuth] redirectTo =', redirectTo, '| skipBrowserRedirect =', isNative())

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: isNative(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) throw error

      console.log('[OAuth] signInWithOAuth result - url:', data?.url?.substring(0, 80), '| error:', error)

      if (isNative() && data?.url) {
        // Native: open Chrome Custom Tab (in-app browser)
        const Browser = await getBrowserPlugin()
        if (Browser) {
          console.log('[OAuth] Opening Chrome Custom Tab via Browser.open()...')
          await Browser.open({
            url: data.url,
          })
          console.log('[OAuth] Browser.open() called successfully')

          // If user manually closes the browser without completing OAuth
          try {
            const finishedListener = await Browser.addListener('browserFinished', () => {
              if (loadingRef.current) {
                loadingRef.current = false
                setLoading(false)
              }
              if (finishedListener && 'remove' in finishedListener) {
                finishedListener.remove()
              }
            })
          } catch {
            // Listener setup failed — non-critical
          }
          // Don't setLoading(false) here — wait for callback or browserFinished
        } else {
          // Fallback: system browser
          console.warn('[OAuth] WARNING: Browser plugin is null — falling back to window.open() (system browser)')
          window.open(data.url, '_blank')
          loadingRef.current = false
          setLoading(false)
        }
      }
      // On web, Supabase handles the redirect automatically
    } catch (error: unknown) {
      hapticFeedback('error')
      loadingRef.current = false
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
