import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function LoginHeader() {
  const { t } = useTranslation()

  return (
    <div className="text-center mb-6 sm:mb-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="flex justify-center mb-4 sm:mb-6"
      >
        <img 
          src="/logo.svg" 
          alt="NICEBASE Logo" 
          className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28"
        />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent"
      >
        {t('appName')}
      </motion.h1>
      <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg">{t('tagline')}</p>
    </div>
  )
}







