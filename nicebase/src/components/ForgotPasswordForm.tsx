import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import { hapticFeedback } from '../utils/haptic'
import { useModalPresence } from '../hooks/useModalPresence'

interface ForgotPasswordFormProps {
  email: string
  loading: boolean
  onEmailChange: (email: string) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export default function ForgotPasswordForm({
  email,
  loading,
  onEmailChange,
  onSubmit,
  onClose,
}: ForgotPasswordFormProps) {
  const { t } = useTranslation()
  useModalPresence(true)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
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
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              {t('email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              placeholder={t('emailPlaceholder')}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                hapticFeedback('light')
                onClose()
              }}
              disabled={loading}
              className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>{t('loading')}</span>
                </>
              ) : (
                t('send')
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}








