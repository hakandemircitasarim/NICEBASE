import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase, hasSupabaseConfig } from '../lib/supabase'
import { errorLoggingService } from '../services/errorLoggingService'
import { hapticFeedback } from '../utils/haptic'
import { isNative } from '../utils/capacitor'

// Dynamically load Browser plugin at runtime if available
async function getBrowserPlugin() {
  if (!isNative()) return null
  try {
    // Dynamic import at runtime - module is external in Vite config
    // @ts-ignore - Capacitor browser is external and may not be available at build time
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

      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const redirectOrigin = import.meta.env.DEV && isLocalHost
        ? `http://${window.location.host}`
        : window.location.origin

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${redirectOrigin}/`,
          skipBrowserRedirect: true,
          queryParams,
        },
      })

      if (error) throw error

      if (data?.url) {
        if (isNative()) {
          // Try to use Capacitor Browser plugin for better OAuth handling
          const Browser = await getBrowserPlugin()
          if (Browser) {
            await Browser.open({
              url: data.url,
              windowName: '_self',
            })
          } else {
            // Fallback if Browser plugin not available
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





