import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff } from 'lucide-react'

export default function OfflineIndicator() {
  const { t } = useTranslation()
  const isOnline = useStore((s) => s.isOnline)
  const checkOnlineStatus = useStore((s) => s.checkOnlineStatus)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Initial check
    if (typeof navigator !== 'undefined') {
      checkOnlineStatus()
    }
    
    const handleOnline = () => {
      if (typeof navigator !== 'undefined') {
        checkOnlineStatus()
      }
    }
    const handleOffline = () => {
      if (typeof navigator !== 'undefined') {
        checkOnlineStatus()
      }
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [checkOnlineStatus])

  useEffect(() => {
    if (!isOnline) {
      setShow(true)
    } else {
      // Delay hiding to show reconnection message
      const timer = setTimeout(() => setShow(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isOnline])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 left-0 right-0 z-50 safe-area-top"
        >
          <div className={`mx-4 mt-2 px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg ${
            isOnline 
              ? 'bg-green-500 dark:bg-green-600 text-white' 
              : 'bg-yellow-500 dark:bg-yellow-600 text-white'
          }`}>
            <motion.div
              animate={isOnline ? {} : { rotate: [0, -10, 10, -10, 10, 0] }}
              transition={{ duration: 0.5, repeat: isOnline ? 0 : Infinity, repeatDelay: 2 }}
            >
              <WifiOff size={18} />
            </motion.div>
            <span className="text-sm font-medium flex-1">
              {isOnline 
                ? t('connectionRestored')
                : t('noInternetConnection')
              }
            </span>
            {!isOnline && (
              <motion.div
                className="w-2 h-2 bg-white rounded-full"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

