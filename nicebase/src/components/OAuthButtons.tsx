import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Chrome, Apple } from 'lucide-react'

interface OAuthButtonsProps {
  onOAuthLogin: (provider: 'google' | 'apple') => void
  loading: boolean
}

export default function OAuthButtons({ onOAuthLogin, loading }: OAuthButtonsProps) {
  const { t } = useTranslation()

  return (
    <>
      {/* OAuth Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {t('orContinueWith') || 'veya'}
          </span>
        </div>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-3">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          type="button"
          onClick={() => onOAuthLogin('google')}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
        >
          <Chrome className="w-5 h-5 text-red-500" />
          <span className="text-gray-700 dark:text-gray-200">
            {t('continueWithGoogle') || 'Google ile devam et'}
          </span>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          type="button"
          onClick={() => onOAuthLogin('apple')}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-black dark:bg-gray-900 text-white border-2 border-gray-800 dark:border-gray-700 rounded-xl font-semibold hover:bg-gray-900 dark:hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
        >
          <Apple className="w-5 h-5" />
          <span>
            {t('continueWithApple') || 'Apple ile devam et'}
          </span>
        </motion.button>
      </div>
    </>
  )
}





