import { motion, AnimatePresence } from 'framer-motion'
import { CloudUpload, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface MigrationPromptProps {
  show: boolean
  count: number
  confirmDelete: boolean
  onAccept: () => void
  onReject: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

export default function MigrationPrompt({
  show,
  count,
  confirmDelete,
  onAccept,
  onReject,
  onConfirmDelete,
  onCancelDelete,
}: MigrationPromptProps) {
  const { t } = useTranslation()

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-sm w-full"
          >
            {!confirmDelete ? (
              <>
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-4">
                  <CloudUpload size={28} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
                  {t('migrationPromptTitle', { defaultValue: 'Anılarınızı Aktaralım mı?' })}
                </h2>
                <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-6">
                  {t('migrationPromptMessage', {
                    count,
                    defaultValue: `Giriş yapmadan önce eklediğiniz ${count} anı bulunuyor. Bunları hesabınıza aktarmak ister misiniz?`,
                  })}
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={onAccept}
                    className="w-full px-5 py-3 rounded-2xl gradient-primary text-white font-semibold hover:shadow-lg transition-all touch-manipulation"
                  >
                    {t('migrationAccept', { defaultValue: 'Evet, Hesabıma Ekle' })}
                  </button>
                  <button
                    onClick={onReject}
                    className="w-full px-5 py-3 rounded-2xl text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                  >
                    {t('migrationReject', { defaultValue: 'Hayır, İstemiyorum' })}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
                  <AlertTriangle size={28} className="text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-lg font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
                  {t('migrationDeleteTitle', { defaultValue: 'Emin misiniz?' })}
                </h2>
                <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-6">
                  {t('migrationDeleteMessage', {
                    count,
                    defaultValue: `Bu ${count} anı sonsuza kadar silinecek ve bir daha geri getirilemeyecek.`,
                  })}
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={onCancelDelete}
                    className="w-full px-5 py-3 rounded-2xl gradient-primary text-white font-semibold hover:shadow-lg transition-all touch-manipulation"
                  >
                    {t('migrationKeep', { defaultValue: 'Vazgeç, Anılarımı Aktar' })}
                  </button>
                  <button
                    onClick={onConfirmDelete}
                    className="w-full px-5 py-3 rounded-2xl text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-manipulation"
                  >
                    {t('migrationConfirmDelete', { defaultValue: 'Evet, Kalıcı Olarak Sil' })}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
