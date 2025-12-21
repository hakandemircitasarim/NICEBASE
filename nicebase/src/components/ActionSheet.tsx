import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Zap, FileText, X } from 'lucide-react'
import { hapticFeedback } from '../utils/haptic'
import { useModalPresence } from '../hooks/useModalPresence'

interface ActionSheetProps {
  isOpen: boolean
  onClose: () => void
  onQuickAdd: () => void
  onFullAdd: () => void
}

export default function ActionSheet({ isOpen, onClose, onQuickAdd, onFullAdd }: ActionSheetProps) {
  const { t } = useTranslation()
  useModalPresence(isOpen)

  const handleQuickAdd = () => {
    hapticFeedback('light')
    onQuickAdd()
  }

  const handleFullAdd = () => {
    hapticFeedback('light')
    onFullAdd()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-md z-[90] safe-area"
          />
          
          {/* Action Sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ 
              type: 'spring', 
              damping: 35, 
              stiffness: 400,
              mass: 0.8
            }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl z-[100] safe-area-bottom border-t border-gray-200 dark:border-gray-700 max-h-[85vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-4 pb-3 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="w-14 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={t('close')}
            >
              <X size={18} strokeWidth={2} />
            </button>

            {/* Content */}
            <div className="px-6 pb-8 pt-2">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {t('addMemory')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('selectAddType')}
                </p>
              </div>
              
              <div className="space-y-3">
                {/* Quick Add Option */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleQuickAdd}
                  className="w-full bg-white dark:bg-gray-800 border-2 border-primary/30 dark:border-primary/40 rounded-2xl p-6 flex items-center gap-4 hover:border-primary hover:shadow-lg dark:hover:border-primary/50 transition-all duration-200 touch-manipulation group"
                >
                  <div className="w-16 h-16 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors">
                    <Zap className="text-primary" size={28} strokeWidth={2} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-1">
                      {t('quickAdd')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {t('quickAddDescription')}
                    </p>
                  </div>
                </motion.button>

                {/* Full Add Option */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleFullAdd}
                  className="w-full bg-white dark:bg-gray-800 border-2 border-primary/30 dark:border-primary/40 rounded-2xl p-6 flex items-center gap-4 hover:border-primary hover:shadow-lg dark:hover:border-primary/50 transition-all duration-200 touch-manipulation group"
                >
                  <div className="w-16 h-16 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors">
                    <FileText className="text-primary" size={28} strokeWidth={2} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-1">
                      {t('fullAdd')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {t('fullAddDescription')}
                    </p>
                  </div>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}







