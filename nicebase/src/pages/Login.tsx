import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { mapUserFromSupabase } from '../lib/userMapper'
import { fetchUserData } from '../lib/userService'
import { errorLoggingService } from '../services/errorLoggingService'
import LoadingSpinner from '../components/LoadingSpinner'
import OAuthButtons from '../components/OAuthButtons'
import { useOAuth } from '../hooks/useOAuth'
import { hapticFeedback } from '../utils/haptic'
import { withTimeout } from '../utils/timeout'
import { isValidEmail as validateEmail, validateEmail as validateEmailDetailed } from '../utils/formValidation'

const AUTH_TIMEOUT_MS = 15000

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setUser, user } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const { handleOAuthLogin, loading: oauthLoading } = useOAuth()

  // Check session and redirect if already logged in
  useEffect(() => {
    const checkAndRedirect = async () => {
      if (user) {
        navigate('/', { replace: true })
        return
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const userData = await fetchUserData(session.user.id)
          if (userData) {
            setUser(userData)
            navigate('/', { replace: true })
          }
        }
      } catch (error) {
        // Session check failed - user can still log in manually
        if (import.meta.env.DEV) {
          console.error('Session check error:', error)
        }
      }
    }
    
    checkAndRedirect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Separate effect to handle user changes after mount
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  // Email validation - use utility function
  const isValidEmail = validateEmail

  // Password strength calculation
  const calculatePasswordStrength = (pwd: string): number => {
    let strength = 0
    if (pwd.length >= 6) strength += 1
    if (pwd.length >= 8) strength += 1
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 1
    if (/\d/.test(pwd)) strength += 1
    if (/[^a-zA-Z\d]/.test(pwd)) strength += 1
    return strength
  }

  useEffect(() => {
    if (isSignUp) {
      setPasswordStrength(calculatePasswordStrength(password))
    }
  }, [password, isSignUp])

  const getStrengthColor = (strength: number) => {
    if (strength <= 1) return 'bg-red-500'
    if (strength <= 2) return 'bg-orange-500'
    if (strength <= 3) return 'bg-yellow-500'
    if (strength <= 4) return 'bg-blue-500'
    return 'bg-green-500'
  }

  const getStrengthText = (strength: number) => {
    if (strength <= 1) return t('passwordStrength.veryWeak')
    if (strength <= 2) return t('passwordStrength.weak')
    if (strength <= 3) return t('passwordStrength.fair')
    if (strength <= 4) return t('passwordStrength.good')
    return t('passwordStrength.strong')
  }

  const handleResendVerification = async () => {
    if (!email || !isValidEmail(email)) {
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
    } catch (error: unknown) {
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Resend verification error'),
        'error'
      )
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(errorMessage || t('failedToSendEmail'))
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!forgotPasswordEmail || !isValidEmail(forgotPasswordEmail)) {
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
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(errorMessage || t('errorOccurred'))
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Email validation
    if (!isValidEmail(email)) {
      hapticFeedback('error')
      toast.error(t('invalidEmail'))
      return
    }
    
    if (password.length < 6) {
      hapticFeedback('error')
      toast.error(t('passwordTooShort'))
      return
    }
    
    if (isSignUp && password !== confirmPassword) {
      hapticFeedback('error')
      toast.error(t('passwordsDoNotMatch'))
      return
    }

    if (isSignUp && !acceptedTerms) {
      hapticFeedback('error')
      toast.error(t('acceptTerms'))
      return
    }
    
    setLoading(true)
    hapticFeedback('light')

    try {
      if (isSignUp) {
        const { data, error } = await withTimeout(
          supabase.auth.signUp({ email, password }),
          AUTH_TIMEOUT_MS
        )

        if (error) throw error

        if (data.user) {
          // Check if email needs verification
          if (data.user.email_confirmed_at === null) {
            toast.success(t('accountCreated'), { duration: 6000 })
          }

          // Refresh session to ensure auth.uid() is available
          await supabase.auth.refreshSession()
          
          // Wait a moment for session to be ready
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Try to create user record with retries
          let userCreated = false
          let retries = 5
          
          while (retries > 0 && !userCreated) {
            const { error: dbError } = await supabase.from('users').insert({
              id: data.user.id,
              email: data.user.email,
              is_premium: false,
              aiya_messages_used: 0,
              aiya_messages_limit: 50,
              weekly_summary_day: null,
              daily_reminder_time: null,
              language: 'tr',
              theme: 'light',
              created_at: new Date().toISOString(),
            })
            
            if (!dbError) {
              userCreated = true
            } else {
              if (import.meta.env.DEV) {
                errorLoggingService.logError(
                  `Insert attempt ${6 - retries} failed: ${dbError.message}`,
                  'warning',
                  data.user.id
                )
              }
              retries--
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          }

          // Fetch user record
          const fetchedUser = await fetchUserData(data.user.id)
          
          if (fetchedUser) {
            setUser(fetchedUser)
            if (data.user.email_confirmed_at === null) {
              toast.success(t('accountCreated'), { duration: 6000 })
            }
            hapticFeedback('success')
            navigate('/')
          } else {
            // If still can't get user, create local user object
            errorLoggingService.logError(
              'Could not fetch user from database after signup, using local data',
              'warning',
              data.user.id
            )
            const newUser = mapUserFromSupabase({
              id: data.user.id,
              email: data.user.email!,
              is_premium: false,
              aiya_messages_used: 0,
              aiya_messages_limit: 50,
              weekly_summary_day: null,
              daily_reminder_time: null,
              language: 'tr',
              theme: 'light',
              created_at: new Date().toISOString(),
            })
            setUser(newUser)
            hapticFeedback('success')
            navigate('/')
          }
        } else {
          // No user returned from signup
          toast.error(t('accountCreationFailed'))
        }
      } else {
        // Login with timeout
        const { data, error } = await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
          AUTH_TIMEOUT_MS
        )

        if (error) throw error

        if (data.user && data.session) {
          // Fetch user data with timeout
          const userData = await withTimeout(
            fetchUserData(data.user.id),
            AUTH_TIMEOUT_MS
          )
          if (userData) {
            setUser(userData)
            hapticFeedback('success')
            toast.success(t('loginSuccess') || 'Giriş başarılı!', { duration: 2000 })
            navigate('/', { replace: true })
          } else {
            toast.error(t('failedToLoadUserData'))
          }
        } else {
          toast.error(t('loginFailed'))
        }
      }
    } catch (error: unknown) {
      hapticFeedback('error')
      const msg = error instanceof Error ? error.message : String(error || '')
      if (msg.includes('timeout') || msg.includes('Timeout')) {
        toast.error(t('connectionTimeout') || 'Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.')
      } else {
        errorLoggingService.logError(
          error instanceof Error ? error : new Error('Authentication error'),
          'error'
        )
        toast.error(msg || t('errorOccurred'))
      }
    } finally {
      // ALWAYS reset loading state regardless of outcome
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 sm:p-10 border border-gray-200 dark:border-gray-700"
      >
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl font-bold mb-3 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent"
          >
            {t('appName')}
          </motion.h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">{t('tagline')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              placeholder="ornek@email.com"
            />
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
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 pr-12 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation text-base"
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation text-base"
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

          <OAuthButtons
            onOAuthLogin={handleOAuthLogin}
            loading={loading || oauthLoading}
          />

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
            }}
            className="w-full text-primary hover:text-primary-dark font-medium text-sm transition-colors"
          >
            {isSignUp ? t('login') : t('signup')}
          </motion.button>
        </form>
      </motion.div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowForgotPassword(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <Lock className="text-primary" size={24} />
              <h2 className="text-2xl font-bold">
                {t('resetPassword')}
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              {t('enterEmailToReset')}
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  {t('email')}
                </label>
                <input
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  placeholder={t('emailPlaceholder')}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={forgotPasswordLoading}
                  className="flex-1 px-4 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {forgotPasswordLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>{t('loading')}</span>
                    </>
                  ) : (
                    <>
                      <Mail size={16} />
                      <span>{t('send')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
