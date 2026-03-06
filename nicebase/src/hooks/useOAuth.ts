import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase, hasSupabaseConfig } from '../lib/supabase'
import { errorLoggingService } from '../services/errorLoggingService'
import { hapticFeedback } from '../utils/haptic'
import { isNative } from '../utils/capacitor'

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
    toast('🔧 [1] SocialLogin import ediliyor...', { duration: 2000 })
    const { SocialLogin } = await import('@capgo/capacitor-social-login')
    const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || ''

    toast(`🔑 [2] Client ID: ${webClientId ? webClientId.slice(0, 20) + '...' : 'BOŞ!'}`, { duration: 3000 })

    if (!webClientId) {
      toast.error('❌ VITE_GOOGLE_WEB_CLIENT_ID boş — Google Sign-In çalışmaz!')
      console.warn('[OAuth] VITE_GOOGLE_WEB_CLIENT_ID is not set — native Google Sign-In will fail')
      return
    }

    toast('⚙️ [3] SocialLogin.initialize() çağrılıyor...', { duration: 2000 })
    await SocialLogin.initialize({
      google: {
        webClientId,
      },
    })
    _socialLoginInitialized = true
    toast.success('✅ [4] SocialLogin başarıyla initialize edildi')
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    toast.error(`❌ [init] SocialLogin.initialize HATA: ${msg}`)
    console.error('[OAuth] SocialLogin.initialize failed:', error)
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

    const setupListener = async () => {
      const App = await getAppPlugin()
      if (!App || aborted) return

      try {
        const listenerResult = (App.addListener as (event: string, callback: (data: unknown) => void) => { remove: () => void } | Promise<{ remove: () => Promise<void> }>)('appUrlOpen', async (data: unknown) => {
          const { url: urlString } = data as { url: string }
          if (!urlString) return

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
              console.error('[OAuth] Provider error:', desc)
              toast.error(desc)
              loadingRef.current = false
              setLoading(false)
              return
            }

            // PKCE flow
            const code = searchParams.get('code') || hashParams.get('code')
            if (code) {
              const { error } = await supabase.auth.exchangeCodeForSession(code)
              if (error) {
                console.error('[OAuth] Code exchange failed:', error.message)
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

      if (!hasSupabaseConfig) {
        toast.error(t('invalidApiKey'))
        setLoading(false)
        loadingRef.current = false
        return
      }

      // ─── NATIVE: Use Google's native Credential Manager ───────────
      if (isNative()) {
        toast('📱 [A] Native mod — SocialLogin import ediliyor...', { duration: 2000 })
        const { SocialLogin } = await import('@capgo/capacitor-social-login')

        // Ensure initialized
        if (!_socialLoginInitialized) {
          toast('🔄 [B] SocialLogin henüz init edilmemiş, şimdi yapılıyor...', { duration: 2000 })
          await initSocialLogin()
          toast(`📊 [C] Init sonucu: ${_socialLoginInitialized ? 'BAŞARILI' : 'BAŞARISIZ'}`, { duration: 2000 })
        }

        if (!_socialLoginInitialized) {
          const msg = 'Native Google Sign-In init failed. Check VITE_GOOGLE_WEB_CLIENT_ID.'
          console.error('[OAuth]', msg)
          toast.error(`❌ [D] ${msg}`)
          loadingRef.current = false
          setLoading(false)
          return
        }

        try {
          toast('🚀 [E] SocialLogin.login() çağrılıyor...', { duration: 3000 })
          const res = await SocialLogin.login({
            provider: 'google',
            options: {
              scopes: ['email', 'profile'],
            },
          })

          // Debug: show full response
          const resStr = JSON.stringify(res, null, 2)
          toast(`📋 [F] Login yanıtı: ${resStr.slice(0, 150)}`, { duration: 5000 })
          console.log('[OAuth] SocialLogin.login() result:', resStr)

          const googleResult = res?.result
          if (!googleResult || !('idToken' in googleResult) || !googleResult.idToken) {
            toast.error(`❌ [G] idToken yok! Yanıt: ${resStr.slice(0, 200)}`)
            throw new Error('Google Sign-In did not return an idToken. Response: ' + resStr.slice(0, 300))
          }

          toast(`🔐 [H] idToken alındı (${googleResult.idToken.slice(0, 20)}...), Supabase ile exchange ediliyor...`, { duration: 3000 })
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: googleResult.idToken,
            access_token: googleResult.accessToken?.token,
          })

          if (error) {
            toast.error(`❌ [I] Supabase signInWithIdToken HATA: ${error.message}`)
            console.error('[OAuth] signInWithIdToken failed:', error.message)
            throw error
          }

          toast.success('✅ [J] Google Sign-In başarılı!')
          console.log('[OAuth] Native Google Sign-In successful!')
          loadingRef.current = false
          setLoading(false)
          return
        } catch (nativeError: unknown) {
          const errMsg = nativeError instanceof Error ? nativeError.message : String(nativeError)

          // Extract ALL properties from error object for debugging
          let fullDebug = errMsg
          try {
            if (nativeError && typeof nativeError === 'object') {
              const keys = Object.keys(nativeError as Record<string, unknown>)
              const details: Record<string, unknown> = { _keys: keys }
              for (const key of keys) {
                details[key] = (nativeError as Record<string, unknown>)[key]
              }
              fullDebug = JSON.stringify(details, null, 2)
            }
          } catch { /* ignore */ }

          console.error('[OAuth] Native Google Sign-In error:', fullDebug, nativeError)

          // User cancelled the native picker — not an error
          if (errMsg.includes('cancel') || errMsg.includes('Cancel') || errMsg.includes('dismissed')) {
            toast('🚫 [K] Kullanıcı iptal etti', { duration: 2000 })
            loadingRef.current = false
            setLoading(false)
            return
          }

          // Show full error details on screen for debugging
          toast.error(`❌ [L] ${errMsg}`, { duration: 8000 })
          // Second toast with full error object details
          setTimeout(() => {
            toast(`🔍 [L-detail] ${fullDebug.slice(0, 300)}`, { duration: 12000 })
          }, 500)
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
