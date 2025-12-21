import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { errorLoggingService } from '../services/errorLoggingService'
import { hapticFeedback } from '../utils/haptic'

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

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) throw error

      // OAuth redirect will happen automatically
      // User will be redirected back after authentication
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



