import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function LoginHeader() {
  const { t } = useTranslation()

  return (
    <div className="text-center mb-6 sm:mb-8">
      <motion.h1
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent"
      >
        {t('appName')}
      </motion.h1>
      <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg">{t('tagline')}</p>
    </div>
  )
}





