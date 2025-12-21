import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { hapticFeedback } from '../utils/haptic'
import { useModalPresence } from '../hooks/useModalPresence'

interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  type = 'warning',
}: ConfirmationDialogProps) {
  const { t } = useTranslation()
  useModalPresence(isOpen)

  const handleConfirm = () => {
    hapticFeedback('success')
    onConfirm()
    onClose()
  }

  const handleCancel = () => {
    hapticFeedback('light')
    onClose()
  }

  const colors = {
    danger: 'bg-danger hover:bg-danger-dark',
    warning: 'bg-warning hover:bg-warning-dark',
    info: 'bg-info hover:bg-info-dark',
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className={`p-3 rounded-full ${
                    type === 'danger'
                      ? 'bg-red-100 dark:bg-red-900/20'
                      : type === 'warning'
                      ? 'bg-orange-100 dark:bg-orange-900/20'
                      : 'bg-blue-100 dark:bg-blue-900/20'
                  }`}
                >
                  <AlertTriangle
                    className={
                      type === 'danger'
                        ? 'text-red-600 dark:text-red-400'
                        : type === 'warning'
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }
                    size={24}
                  />
                </motion.div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">{message}</p>
                </div>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 touch-manipulation"
                  aria-label={t('cancel')}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                >
                  {cancelText || t('cancel')}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirm}
                  className={`flex-1 px-4 py-3 ${colors[type]} text-white rounded-xl font-semibold transition-colors touch-manipulation shadow-lg`}
                >
                  {confirmText || t('confirm')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

