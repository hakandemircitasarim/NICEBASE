import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import LoginHeader from '../components/LoginHeader'
import OAuthButtons from '../components/OAuthButtons'
import ForgotPasswordForm from '../components/ForgotPasswordForm'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { mapUserFromSupabase } from '../lib/userMapper'
import { ensureUserExists } from '../lib/userService'
import { errorLoggingService } from '../services/errorLoggingService'
import LoadingSpinner from '../components/LoadingSpinner'
import { hapticFeedback } from '../utils/haptic'
import { clearLocalUserId } from '../utils/localUserId'
import { useLoginForm } from '../hooks/useLoginForm'
import { useOAuth } from '../hooks/useOAuth'
import { withTimeout } from '../utils/timeout'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setUser, user } = useStore()
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  
  const form = useLoginForm()
  const { handleOAuthLogin, loading: oauthLoading } = useOAuth()
  const {
    email,
    password,
    confirmPassword,
    acceptedTerms,
    passwordStrength,
    showPassword,
    showConfirmPassword,
    errors,
    setEmail,
    setPassword,
    setConfirmPassword,
    setAcceptedTerms,
    setShowPassword,
    setShowConfirmPassword,
    isValidEmail,
    getStrengthColor,
    getStrengthText,
    validateForm,
    clearError,
  } = form

  // Check session and redirect if already logged in (only once on mount)
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount


  const handleResendVerification = async () => {
    if (!email || !form.isValidEmail(email)) {
      hapticFeedback('error')
      toast.error(t('invalidEmail'))
      return
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (error) throw error

      toast.success(t('verificationEmailSent'), { duration: 5000 })
    } catch (error: any) {
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Resend verification error'),
        'error'
      )
      // Show error message if available, otherwise use i18n
      const errorMsg = error.message && !error.message.includes('Invalid API key') 
        ? error.message 
        : t('failedToSendEmail')
      toast.error(errorMsg)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!forgotPasswordEmail || !form.isValidEmail(forgotPasswordEmail)) {
      hapticFeedback('error')
      toast.error(t('invalidEmail'))
      return
    }

    setForgotPasswordLoading(true)
    hapticFeedback('light')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      toast.success(t('passwordResetEmailSent'), { duration: 5000 })
      setShowForgotPassword(false)
      setForgotPasswordEmail('')
    } catch (error: unknown) {
      hapticFeedback('error')
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Password reset error'),
        'error'
      )
      // Show error message if available, otherwise use i18n
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorMsg = errorMessage && !errorMessage.includes('Invalid API key')
        ? errorMessage
        : t('errorOccurred')
      toast.error(errorMsg)
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  /**
   * Creates a fallback user object when database fetch fails
   */
  const createFallbackUser = useCallback((userId: string, userEmail: string | undefined) => {
    errorLoggingService.logError(
      'Could not fetch user from database, using local data',
      'warning',
      userId
    )
    return mapUserFromSupabase({
      id: userId,
      email: userEmail || '',
      is_premium: false,
      aiya_messages_used: 0,
      aiya_messages_limit: 30,
      weekly_summary_day: null,
      daily_reminder_time: null,
      language: 'tr',
      theme: 'light',
      created_at: new Date().toISOString(),
    })
  }, [])

  /**
   * Handles successful authentication (signup or login)
   */
  const handleAuthSuccess = useCallback(async (
    userId: string,
    userEmail: string | undefined,
    isSignUp: boolean,
    emailConfirmed: boolean
  ) => {
    // Debug breadcrumb to make "stuck on loading" diagnosable in dev.
    if (import.meta.env.DEV) {
      console.log('[auth] handleAuthSuccess:start', { userId, isSignUp })
    }
    // `signInWithPassword` / `signUp` already returns an authenticated session in the client.
    // `refreshSession()` can hang in some local setups; avoid calling it here.
    const userData = await withTimeout(ensureUserExists(userId, userEmail), 15000)
    if (import.meta.env.DEV) console.log('[auth] ensureUserExists:done', { hasUser: Boolean(userData) })
    
    if (userData) {
      setUser(userData)
      if (isSignUp && !emailConfirmed) {
        toast.success(t('accountCreated'), { duration: 6000 })
      }
      if (!isSignUp) {
        clearLocalUserId()
        hapticFeedback('success')
        toast.success(t('loginSuccess'))
      }
      navigate(isSignUp ? '/' : '/', { replace: !isSignUp })
      return true
    }
    
    // Fallback: create local user object
    const fallbackUser = createFallbackUser(userId, userEmail)
    setUser(fallbackUser)
    if (!isSignUp) {
      clearLocalUserId()
      hapticFeedback('success')
      toast.success(t('loginSuccess'))
    }
    navigate('/', { replace: !isSignUp })
    return true
  }, [t, setUser, navigate, createFallbackUser])

  /**
   * Gets user-friendly error message from error object
   */
  const getUserErrorMessage = useCallback((error: unknown): string => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as { code?: string; status?: string })?.code || 
                     (error as { code?: string; status?: string })?.status || 
                     'UNKNOWN'
    
    if (errorMessage.includes('Invalid API key') || 
        errorMessage.includes('invalid_api_key') ||
        errorMessage.includes('API key') ||
        errorMessage.includes('JWT') ||
        errorMessage.includes('jwt') ||
        errorCode === 'invalid_api_key' ||
        errorCode === 'PGRST301') {
      return t('invalidApiKey')
    }
    // Auth: wrong email/password OR password login not available for that user.
    // Keep this check strict; many unrelated errors contain the substring "invalid".
    const lower = errorMessage.toLowerCase()
    if (
      errorMessage.includes('Invalid login credentials') ||
      lower.includes('invalid login credentials') ||
      lower.includes('invalid_credentials') ||
      lower.includes('invalid_grant') ||
      errorCode === 'invalid_credentials'
    ) {
      return t('invalidCredentials') || t('errorOccurred')
    }
    if (errorMessage.includes('Email not confirmed') || 
        errorMessage.includes('email_not_confirmed')) {
      return t('emailNotConfirmed') || t('errorOccurred')
    }
    if (errorMessage.includes('Too many requests') || 
        errorCode === 'too_many_requests') {
      return t('tooManyRequests') || t('errorOccurred')
    }
    return errorMessage || t('errorOccurred')
  }, [t])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    const validation = validateForm(isSignUp)
    if (!validation.isValid) {
      hapticFeedback('error')
      const firstError = Object.values(validation.errors)[0]
      if (firstError) {
        toast.error(firstError)
      }
      return
    }
    
    setLoading(true)
    hapticFeedback('light')

    try {
      // Normalize email to avoid invisible whitespace / casing issues that lead to "Invalid login credentials".
      const normalizedEmail = (email || '').trim().toLowerCase()

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        })

        if (error) throw error

        if (!data.user) {
          toast.error(t('accountCreationFailed'))
          return
        }

        // Check if email needs verification
        const emailConfirmed = data.user.email_confirmed_at !== null
        const hasSession = Boolean(data.session)
        if (!emailConfirmed || !hasSession) {
          // When email confirmation is enabled, Supabase returns `session: null`.
          // In that state the user is NOT authenticated yet, so writing to `public.users`
          // (ensureUserExists) can fail due to RLS. We should stop here and ask the user to confirm email.
          toast.success(t('accountCreated'), { duration: 7000 })
          toast.success(
            t('checkYourEmailToVerify', { defaultValue: 'E-postanı kontrol et ve doğruladıktan sonra giriş yap.' }),
            { duration: 8000 }
          )
          setIsSignUp(false)
          return
        }

        const success = await handleAuthSuccess(
          data.user.id,
          data.user.email,
          true,
          emailConfirmed
        )
        if (success) return
      } else {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (error) throw error

        if (!data.user || !data.session) {
          toast.error(t('loginFailed'))
          return
        }

        const success = await handleAuthSuccess(
          data.user.id,
          data.user.email,
          false,
          true
        )
        if (success) return
      }
    } catch (error: unknown) {
      hapticFeedback('error')
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorCode = (error as { code?: string; status?: string })?.code || 
                       (error as { code?: string; status?: string })?.status || 
                       'UNKNOWN'

      // If the user tried to sign up with an already-registered email,
      // switch to login mode automatically (common local-dev / test flow).
      if (
        isSignUp &&
        (errorMessage.toLowerCase().includes('already registered') ||
          errorMessage.toLowerCase().includes('user already registered') ||
          errorMessage.toLowerCase().includes('already exists'))
      ) {
        setIsSignUp(false)
        toast.error(t('userAlreadyExists') || 'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.')
        return
      }
      
      errorLoggingService.logError(
        error instanceof Error ? error : new Error(`Authentication error: ${errorMessage} (${errorCode})`),
        'error',
        email
      )
      
      const userMessage = getUserErrorMessage(error)
      
      // Special handling for API key errors
      if (userMessage === t('invalidApiKey')) {
        toast.error(userMessage, {
          duration: 6000,
          icon: '⚠️',
        })
      } else {
        toast.error(userMessage)
      }
      
    } finally {
      setLoading(false)
    }
  }, [isSignUp, email, password, validateForm, handleAuthSuccess, getUserErrorMessage, t])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-gray-200 dark:border-gray-700"
      >
        <LoginHeader />

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              {t('email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                // Clear error when user starts typing
                clearError('email')
              }}
              onBlur={() => {
                // Validate email on blur
                if (email && !isValidEmail(email)) {
                  form.setError('email', t('invalidEmail'))
                } else {
                  clearError('email')
                }
              }}
              required
              autoComplete="username"
              className={`w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 transition-all outline-none ${
                errors.email 
                  ? 'border-red-500 focus:border-red-500' 
                  : 'border-gray-200 dark:border-gray-600 focus:border-primary'
              }`}
              placeholder={t('emailPlaceholder')}
            />
            {errors.email && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-sm text-red-500"
              >
                {errors.email}
              </motion.p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              {t('password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  // Clear error when user starts typing
                  clearError('password')
                }}
                onBlur={() => {
                  // Validate password on blur
                  if (password && password.length < 6) {
                    form.setError('password', t('passwordTooShort'))
                  } else {
                    clearError('password')
                  }
                }}
                required
                className={`w-full px-4 py-3 pr-12 border-2 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation text-base ${
                  errors.password 
                    ? 'border-red-500 focus:border-red-500' 
                    : 'border-gray-200 dark:border-gray-600 focus:border-primary'
                }`}
                placeholder={t('passwordPlaceholder')}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => {
                  hapticFeedback('light')
                  setShowPassword(!showPassword)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 touch-manipulation"
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-sm text-red-500"
              >
                {errors.password}
              </motion.p>
            )}
            {isSignUp && password && (
              <div className="mt-2">
                <div className="flex gap-1 h-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`flex-1 rounded-full transition-all ${
                        level <= passwordStrength
                          ? getStrengthColor(passwordStrength)
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs mt-1 ${getStrengthColor(passwordStrength).replace('bg-', 'text-')}`}>
                  {getStrengthText(passwordStrength)}
                </p>
              </div>
            )}
            {isSignUp && !password && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('passwordHint')}
              </p>
            )}
          </motion.div>

            {isSignUp && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
            >
              <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                {t('confirmPassword')}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    // Clear error when user starts typing
                    clearError('confirmPassword')
                  }}
                  onBlur={() => {
                    // Validate confirm password on blur
                    if (confirmPassword && password !== confirmPassword) {
                      form.setError('confirmPassword', t('passwordsDoNotMatch'))
                    } else {
                      clearError('confirmPassword')
                    }
                  }}
                  required
                  className={`w-full px-4 py-3 pr-12 border-2 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation text-base ${
                    errors.confirmPassword 
                      ? 'border-red-500 focus:border-red-500' 
                      : 'border-gray-200 dark:border-gray-600 focus:border-primary'
                  }`}
                  placeholder={t('passwordPlaceholder')}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback('light')
                    setShowConfirmPassword(!showConfirmPassword)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 touch-manipulation"
                  aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-red-500"
                >
                  {errors.confirmPassword}
                </motion.p>
              )}
            </motion.div>
          )}

          {isSignUp && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.36 }}
              className="flex items-start gap-2"
            >
              <input
                type="checkbox"
                id="terms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
              />
              <label htmlFor="terms" className="text-sm text-gray-600 dark:text-gray-400">
                {t('acceptTerms')}
              </label>
            </motion.div>
          )}

          {!isSignUp && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-right"
            >
              <button
                type="button"
                onClick={() => {
                  hapticFeedback('light')
                  setShowForgotPassword(true)
                }}
                className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
              >
                {t('forgotPassword')}
              </button>
            </motion.div>
          )}

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            type="submit"
            disabled={loading}
            className="w-full gradient-primary text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>{t('loading')}</span>
              </>
            ) : (
              isSignUp ? t('signup') : t('login')
            )}
          </motion.button>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setConfirmPassword('')
              setPassword('')
              setEmail('')
              setAcceptedTerms(false)
              form.clearErrors()
            }}
            className="w-full text-primary hover:text-primary-dark font-medium text-sm transition-colors"
          >
            {isSignUp ? t('login') : t('signup')}
          </motion.button>

          <OAuthButtons onOAuthLogin={handleOAuthLogin} loading={loading || oauthLoading} />
        </form>
      </motion.div>

      {showForgotPassword && (
        <ForgotPasswordForm
          email={forgotPasswordEmail}
          loading={forgotPasswordLoading}
          onEmailChange={setForgotPasswordEmail}
          onSubmit={handleForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />
      )}
    </div>
  )
}

