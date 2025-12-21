import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { errorLoggingService } from '../services/errorLoggingService'
import { hapticFeedback } from '../utils/haptic'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)

  useEffect(() => {
    // Check if we have the hash from email
    const hash = searchParams.get('hash')
    if (!hash) {
      toast.error(t('invalidResetLink'))
      navigate('/login')
    }
  }, [searchParams, navigate])

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
    setPasswordStrength(calculatePasswordStrength(password))
  }, [password])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password.length < 6) {
      hapticFeedback('error')
      toast.error(t('passwordTooShort'))
      return
    }

    if (password !== confirmPassword) {
      hapticFeedback('error')
      toast.error(t('passwordsDoNotMatch'))
      return
    }

    setLoading(true)
    hapticFeedback('light')

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      toast.success(t('passwordUpdatedSuccessfully'), { duration: 3000 })
      
      setTimeout(() => {
        navigate('/login')
      }, 2000)
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
        : t('passwordUpdateFailed')
      toast.error(errorMsg)
    } finally {
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
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center mb-4"
          >
            <Lock className="text-primary" size={48} />
          </motion.div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            {t('resetPassword')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('enterNewPassword')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              {t('newPassword')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 pr-12 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation text-base"
                placeholder={t('passwordPlaceholder')}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => {
                  hapticFeedback('light')
                  setShowPassword(!showPassword)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 touch-manipulation"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {password && (
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
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              {t('confirmNewPassword')}
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
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || passwordStrength < 2}
            className="w-full gradient-primary text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>{t('updating')}</span>
              </>
            ) : (
              t('updatePassword')
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full text-primary hover:text-primary-dark font-medium text-sm transition-colors"
          >
            {t('backToLogin')}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

