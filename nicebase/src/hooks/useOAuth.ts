import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase, hasSupabaseConfig } from '../lib/supabase'
import { errorLoggingService } from '../services/errorLoggingService'
import { hapticFeedback } from '../utils/haptic'
import { isNative } from '../utils/capacitor'
import { authErrorMessage } from '../utils/authErrors'

// ─── Native Google Sign-In (via @capgo/capacitor-social-login) ──────────
// On Android/iOS: shows the native Google account picker (bottom sheet)
// Returns an idToken which we exchange with Supabase via signInWithIdToken
// No browser or Chrome Custom Tab is opened — fully native experience.
// ─────────────────────────────────────────────────────────────────────────

let _socialLoginInitialized = false

async function initSocialLogin() {
  if (_socialLoginInitialized) return
  if (!isNative()) return

  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login')
    const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || ''

    if (!webClientId) {
      if (import.meta.env.DEV) console.warn('[OAuth] VITE_GOOGLE_WEB_CLIENT_ID is not set')
      return
    }

    await SocialLogin.initialize({
      google: {
        webClientId,
      },
    })
    _socialLoginInitialized = true
  } catch (error) {
    errorLoggingService.logError(error instanceof Error ? error : new Error('SocialLogin.initialize failed'), 'error')
  }
}

// ─── Web fallback: keep the existing browser-based OAuth flow ───────────
// Module-level Browser reference so the deep-link callback can close it
let _browserRef: { close: () => Promise<void> } | null = null

async function getAppPlugin() {
  if (!isNative()) return null
  try {
    const module = await import('@capacitor/app')
    return module.App
  } catch {
    return null
  }
}

async function getBrowserPlugin() {
  if (!isNative()) return null
  try {
    const module = await import('@capacitor/browser')
    _browserRef = module.Browser
    return module.Browser
  } catch {
    return null
  }
}

/**
 * Custom hook for handling Google OAuth authentication
 *
 * Native (Android/iOS): Uses Google's native Credential Manager via SocialLogin plugin.
 *   → Shows a native bottom-sheet account picker, no browser opened.
 *   → Returns idToken → supabase.auth.signInWithIdToken()
 *
 * Web: Uses Supabase's browser-based OAuth redirect flow (unchanged).
 */
export function useOAuth() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  // Holds the id of the 60s OAuth safety timeout so the deep-link callback can
  // cancel it the moment a code/token arrives — otherwise a slow-but-successful
  // code exchange that finishes near the 60s mark would still fire a spurious
  // "login failed" toast.
  const oauthTimeoutRef = useRef<number | null>(null)

  const clearOAuthTimeout = useCallback(() => {
    if (oauthTimeoutRef.current !== null) {
      window.clearTimeout(oauthTimeoutRef.current)
      oauthTimeoutRef.current = null
    }
  }, [])

  // Initialize SocialLogin plugin on mount (native only)
  useEffect(() => {
    if (isNative()) {
      initSocialLogin()
    }
  }, [])

  // Deep link listener for web OAuth callback fallback (kept for edge cases)
  useEffect(() => {
    if (!isNative()) return

    let listener: { remove: () => Promise<void> } | { remove: () => void } | null = null
    let aborted = false

    // De-dupe callback URLs: on a cold start the same deep link arrives via BOTH
    // getLaunchUrl() and the appUrlOpen listener, so without this the single-use
    // OAuth code would be exchanged twice — the second exchange fails ("code
    // already used") and would flash a spurious error toast after a successful
    // login.
    const handledCallbacks = new Set<string>()

    // Shared callback handler so the live deep-link listener AND the cold-start
    // getLaunchUrl() path run the exact same token exchange.
    const processCallback = async (urlString: string) => {
      if (!urlString) return
      if (handledCallbacks.has(urlString)) return
      handledCallbacks.add(urlString)
      // The deep link arrived — the flow was NOT abandoned. Cancel the 60s
      // safety timeout so it can't fire a spurious error toast while the code
      // exchange below is still completing on a slow network.
      clearOAuthTimeout()
      try {
        // Close the in-app browser if open
        if (_browserRef) {
          try { await _browserRef.close() } catch { /* already closed */ }
        }

        const url = new URL(urlString)
        const searchParams = new URLSearchParams(url.search || '')
        const hashParams = new URLSearchParams((url.hash || '').replace('#', ''))

        const errorParam = searchParams.get('error') || hashParams.get('error')
        if (errorParam) {
          const desc = searchParams.get('error_description') || hashParams.get('error_description') || errorParam
          errorLoggingService.logError(new Error(`OAuth provider error: ${desc}`), 'error')
          // Show a localized message, not the raw provider/SDK string.
          toast.error(t('oauthError'))
          loadingRef.current = false
          setLoading(false)
          return
        }

        // PKCE flow
        const code = searchParams.get('code') || hashParams.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            errorLoggingService.logError(new Error(`OAuth code exchange failed: ${error.message}`), 'error')
            toast.error(t('oauthError'))
          }
          loadingRef.current = false
          setLoading(false)
          return
        }

        // Implicit flow fallback
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        if (accessToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          })
          if (error) {
            errorLoggingService.logError(new Error(`OAuth setSession failed: ${error.message}`), 'error')
            toast.error(t('oauthError'))
          }
          loadingRef.current = false
          setLoading(false)
          return
        }
      } catch (error) {
        errorLoggingService.logError(error instanceof Error ? error : new Error('OAuth callback error'), 'error')
        loadingRef.current = false
        setLoading(false)
      }
    }

    const setupListener = async () => {
      const App = await getAppPlugin()
      if (!App || aborted) return

      try {
        const listenerResult = (App.addListener as (event: string, callback: (data: unknown) => void) => { remove: () => void } | Promise<{ remove: () => Promise<void> }>)('appUrlOpen', async (data: unknown) => {
          const { url: urlString } = data as { url: string }
          await processCallback(urlString)
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
        errorLoggingService.logError(error instanceof Error ? error : new Error('OAuth listener setup failed'), 'error')
      }

      // Cold-start safety: the deep link that re-launched the app may have been
      // delivered before the listener above was attached. Consult getLaunchUrl
      // so a killed-app OAuth round-trip still completes instead of hanging.
      try {
        const launch = await App.getLaunchUrl()
        if (launch?.url && launch.url.includes('oauth/callback')) {
          await processCallback(launch.url)
        }
      } catch { /* ignore */ }
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
  }, [t, clearOAuthTimeout])

  /**
   * Handles Google OAuth login
   */
  const handleOAuthLogin = useCallback(async (_provider: 'google' = 'google') => {
    try {
      hapticFeedback('light')
      setLoading(true)
      loadingRef.current = true

      if (!hasSupabaseConfig) {
        toast.error(t('invalidApiKey'))
        setLoading(false)
        loadingRef.current = false
        return
      }

      // ─── NATIVE: Use Google's native Credential Manager ───────────
      if (isNative()) {
        const { SocialLogin } = await import('@capgo/capacitor-social-login')

        // Ensure initialized
        if (!_socialLoginInitialized) {
          await initSocialLogin()
        }

        if (!_socialLoginInitialized) {
          // Initialization failed (probably missing VITE_GOOGLE_WEB_CLIENT_ID).
          // Keep the technical detail in logs only — never leak an env-var name
          // to the user; show a localized, friendly message.
          const msg = 'Native Google Sign-In init failed. Check VITE_GOOGLE_WEB_CLIENT_ID.'
          errorLoggingService.logError(new Error(msg), 'error')
          toast.error(t('googleSignInUnavailable'))
          loadingRef.current = false
          setLoading(false)
          return
        }

        try {
          const res = await SocialLogin.login({
            provider: 'google',
            options: {
              scopes: ['email', 'profile'],
            },
          })
          const googleResult = res?.result
          // The response can be 'online' (has idToken) or 'offline' (has serverAuthCode)
          if (!googleResult || !('idToken' in googleResult) || !googleResult.idToken) {
            throw new Error('Google Sign-In did not return an idToken. Response: ' + JSON.stringify(res))
          }

          // Exchange the native idToken with Supabase
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: googleResult.idToken,
            access_token: googleResult.accessToken?.token,
          })

          if (error) {
            errorLoggingService.logError(new Error(`signInWithIdToken failed: ${error.message}`), 'error')
            throw error
          }

          // Done! onAuthStateChange in App.tsx will handle the rest
          loadingRef.current = false
          setLoading(false)
          return
        } catch (nativeError: unknown) {
          const errMsg = nativeError instanceof Error ? nativeError.message : String(nativeError)
          errorLoggingService.logError(new Error(`Native Google Sign-In error: ${errMsg}`), 'error')

          // User cancelled the native picker — not an error
          if (errMsg.includes('cancel') || errMsg.includes('Cancel') || errMsg.includes('dismissed')) {
            loadingRef.current = false
            setLoading(false)
            return
          }

          // Log the raw native error, show a localized message.
          errorLoggingService.logError(new Error(`Google Sign-In: ${errMsg}`), 'error')
          toast.error(authErrorMessage(errMsg, t))
          loadingRef.current = false
          setLoading(false)
          return
        }
      }

      // ─── WEB (or native fallback): Browser-based Supabase OAuth ───
      let redirectTo: string

      if (isNative()) {
        redirectTo = import.meta.env.VITE_OAUTH_REDIRECT_URL || 'com.nicebase.app://oauth/callback'
      } else {
        const webRedirectUrl = import.meta.env.VITE_OAUTH_WEB_REDIRECT_URL
        redirectTo = webRedirectUrl || `${window.location.origin}/`
      }

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

      if (isNative() && data?.url) {
        const Browser = await getBrowserPlugin()
        if (Browser) {
          await Browser.open({
            url: data.url,
            windowName: '_self',
          })

          // Safety net: if no deep-link callback ever arrives (user abandoned the
          // flow, or the callback was lost on a cold start), stop the spinner
          // after 60s instead of hanging forever. The callback handler clears
          // this timer (clearOAuthTimeout) the moment a deep link arrives.
          clearOAuthTimeout()
          oauthTimeoutRef.current = window.setTimeout(async () => {
            if (!loadingRef.current) return
            // Double-check: a slow code exchange may have just landed a session
            // right at the 60s mark — don't show a "login failed" toast then.
            try {
              const { data: { session } } = await supabase.auth.getSession()
              if (session) {
                loadingRef.current = false
                setLoading(false)
                return
              }
            } catch { /* fall through to the timeout error */ }
            if (loadingRef.current) {
              loadingRef.current = false
              setLoading(false)
              toast.error(t('oauthError'))
            }
          }, 60000)

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
        } else {
          window.open(data.url, '_blank')
          loadingRef.current = false
          setLoading(false)
        }
      }
    } catch (error: unknown) {
      hapticFeedback('error')
      loadingRef.current = false
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('OAuth login error'),
        'error'
      )

      // Always surface a localized message; never the raw error string.
      let userMessage = t('oauthError')
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('popup_closed_by_user')) {
        userMessage = t('oauthCancelled')
      }

      toast.error(userMessage)
      setLoading(false)
    }
  }, [t, clearOAuthTimeout])

  return {
    handleOAuthLogin,
    loading,
  }
}
