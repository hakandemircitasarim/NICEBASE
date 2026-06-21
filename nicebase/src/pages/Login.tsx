import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { fetchUserData } from '../lib/userService'
import { errorLoggingService } from '../services/errorLoggingService'
import { authErrorMessage } from '../utils/authErrors'
import LoadingSpinner from '../components/LoadingSpinner'
import OAuthButtons from '../components/OAuthButtons'
import ForgotPasswordForm from '../components/ForgotPasswordForm'
import { useOAuth } from '../hooks/useOAuth'
import { hapticFeedback } from '../utils/haptic'
import { withTimeout } from '../utils/timeout'
import { isValidEmail as validateEmail } from '../utils/formValidation'

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
  // Inline per-field validation errors (replaces transient toast-only feedback)
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Set when sign-up succeeds but email confirmation is required (no session).
  // We must NOT log the user in; instead surface a "check your inbox" state.
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)
  // Surfaces a "resend confirmation email" action when login fails because the
  // account's email was never confirmed.
  const [showResendVerification, setShowResendVerification] = useState(false)
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

  const handleResendVerification = async (targetEmail?: string) => {
    const address = targetEmail || email
    if (!address || !isValidEmail(address)) {
      hapticFeedback('error')
      toast.error(t('invalidEmail'))
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: address,
      })

      if (error) throw error

      hapticFeedback('success')
      toast.success(t('verificationEmailSent'), { duration: 5000 })
    } catch (error: unknown) {
      hapticFeedback('error')
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Resend verification error'),
        'error'
      )
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(errorMessage || t('failedToSendEmail'))
    } finally {
      setLoading(false)
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

  // Collect all field errors at once so the user sees every problem inline,
  // not one transient toast at a time.
  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {}
    if (!isValidEmail(email)) next.email = t('invalidEmail')
    if (password.length < 6) next.password = t('passwordTooShort')
    if (isSignUp && password !== confirmPassword) next.confirmPassword = t('passwordsDoNotMatch')
    if (isSignUp && !acceptedTerms) next.terms = t('acceptTerms')
    return next
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      hapticFeedback('error')
      return
    }

    setShowResendVerification(false)
    setLoading(true)
    hapticFeedback('light')

    try {
      if (isSignUp) {
        const { data, error } = await withTimeout(
          supabase.auth.signUp({ email, password }),
          AUTH_TIMEOUT_MS
        )

        if (error) throw error

        if (!data.user) {
          // No user returned from signup
          toast.error(t('accountCreationFailed'))
        } else if (!data.session) {
          // Email confirmation is required: signUp returned a user but NO session.
          // Do NOT setUser/navigate (that would drop the user into an
          // authenticated shell with no real session). Surface a "check your
          // inbox" state with a resend option instead. Toast is shown ONCE.
          toast.success(t('accountCreated'), { duration: 6000 })
          hapticFeedback('success')
          setPendingVerificationEmail(data.user.email || email)
        } else {
          // A real session exists (confirmation disabled / auto-confirmed):
          // create the user record and log them in.
          const { error: dbError } = await supabase.from('users').upsert(
            {
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
            },
            { onConflict: 'id', ignoreDuplicates: true }
          )

          if (dbError) {
            if (import.meta.env.DEV) console.warn('[Login] User upsert warning:', dbError.message)
          }

          // Fetch user record
          const fetchedUser = await fetchUserData(data.user.id)

          if (fetchedUser) {
            setUser(fetchedUser)
            hapticFeedback('success')
            navigate('/')
          } else {
            // Session exists but the record could not be read back.
            errorLoggingService.logError(
              'Could not fetch user from database after signup despite a valid session',
              'warning',
              data.user.id
            )
            toast.error(t('failedToLoadUserData'))
          }
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
            toast.success(t('loginSuccess'), { duration: 2000 })
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
        toast.error(t('connectionTimeout'))
      } else {
        // Login blocked because the account's email was never confirmed —
        // give the user a reachable "resend confirmation email" affordance.
        if (!isSignUp && /email not confirmed|email_not_confirmed/i.test(msg)) {
          setShowResendVerification(true)
        }
        errorLoggingService.logError(
          error instanceof Error ? error : new Error('Authentication error'),
          'error'
        )
        toast.error(authErrorMessage(msg, t))
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

        {pendingVerificationEmail ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MailCheck className="text-primary" size={32} />
              </div>
            </div>
            <h2 className="text-2xl font-bold">
              {t('checkYourInbox', { defaultValue: 'Check your inbox' })}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {t('verifyEmailInstructions', {
                email: pendingVerificationEmail,
                defaultValue: 'We sent a confirmation link to {{email}}. Please verify your email to finish signing in.',
              })}
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleResendVerification(pendingVerificationEmail)}
              className="w-full gradient-primary text-white py-3 rounded-xl font-semibold hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>{t('loading')}</span>
                </>
              ) : (
                t('resendVerificationEmail', { defaultValue: 'Resend confirmation email' })
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingVerificationEmail(null)
                setIsSignUp(false)
                setPassword('')
                setConfirmPassword('')
                setAcceptedTerms(false)
                setErrors({})
              }}
              className="w-full text-primary hover:text-primary-dark font-medium text-sm transition-colors"
            >
              {t('backToLogin')}
            </button>
          </div>
        ) : (
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
              onChange={(e) => {
                setEmail(e.target.value)
                if (errors.email) setErrors((prev) => { const n = { ...prev }; delete n.email; return n })
              }}
              required
              aria-invalid={!!errors.email}
              className={`w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 transition-all outline-none ${
                errors.email
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-200 dark:border-gray-600 focus:border-primary'
              }`}
              placeholder={t('emailPlaceholder')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email}</p>
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
                  if (errors.password) setErrors((prev) => { const n = { ...prev }; delete n.password; return n })
                }}
                required
                aria-invalid={!!errors.password}
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
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password}</p>
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
                    if (errors.confirmPassword) setErrors((prev) => { const n = { ...prev }; delete n.confirmPassword; return n })
                  }}
                  required
                  aria-invalid={!!errors.confirmPassword}
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
                <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>
              )}
            </motion.div>
          )}

          {isSignUp && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.36 }}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    setAcceptedTerms(e.target.checked)
                    if (errors.terms) setErrors((prev) => { const n = { ...prev }; delete n.terms; return n })
                  }}
                  aria-invalid={!!errors.terms}
                  className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
                />
                <label htmlFor="terms" className="text-sm text-gray-600 dark:text-gray-400">
                  {t('acceptTerms')}{' '}
                  <a
                    href="/privacy-policy.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary-dark font-medium underline"
                  >
                    {t('privacyPolicy', { defaultValue: 'Privacy Policy' })}
                  </a>
                </label>
              </div>
              {errors.terms && (
                <p className="mt-1 text-xs text-red-500">{errors.terms}</p>
              )}
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

          {showResendVerification && (
            <div className="text-center -mt-1">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {t('emailNotConfirmed')}
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleResendVerification()}
                className="text-sm text-primary hover:text-primary-dark font-medium transition-colors disabled:opacity-50"
              >
                {t('resendVerificationEmail', { defaultValue: 'Resend confirmation email' })}
              </button>
            </div>
          )}

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
              setErrors({})
              setShowResendVerification(false)
            }}
            className="w-full text-primary hover:text-primary-dark font-medium text-sm transition-colors"
          >
            {isSignUp ? t('login') : t('signup')}
          </motion.button>
        </form>
        )}
      </motion.div>

      {/* Forgot Password Modal — uses the shared component for scroll-lock,
          Escape-to-close and modal-presence consistency. */}
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
