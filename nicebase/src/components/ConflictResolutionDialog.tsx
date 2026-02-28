import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Check, X, Cloud, HardDrive } from 'lucide-react'
import { Memory } from '../types'
import { memoryService } from '../services/memoryService'
import { hapticFeedback } from '../utils/haptic'
import toast from 'react-hot-toast'

interface ConflictResolutionDialogProps {
  memory: Memory
  onResolved: () => void
  onClose: () => void
}

export default function ConflictResolutionDialog({
  memory,
  onResolved,
  onClose,
}: ConflictResolutionDialogProps) {
  const { t } = useTranslation()
  const [resolving, setResolving] = useState(false)
  const cloudMemory = memory.conflictCloud

  if (!cloudMemory) {
    return null
  }

  const handleResolve = async (keepLocal: boolean) => {
    if (resolving) return

    setResolving(true)
    hapticFeedback('light')

    try {
      if (keepLocal) {
        // Keep local version - mark as synced and clear conflict
        await memoryService.update(memory.id, {
          conflict: false,
          conflictCloud: undefined,
          conflictDetectedAt: undefined,
          synced: false, // Will be synced on next sync
        })
        toast.success(t('conflictResolvedLocal', { defaultValue: 'Yerel versiyon korundu' }))
      } else {
        // Keep cloud version - replace local with cloud
        const updates: Partial<Memory> = {
          text: cloudMemory.text,
          category: cloudMemory.category,
          categories: cloudMemory.categories,
          intensity: cloudMemory.intensity,
          date: cloudMemory.date,
          connections: cloudMemory.connections,
          lifeArea: cloudMemory.lifeArea,
          isCore: cloudMemory.isCore,
          photos: cloudMemory.photos,
          updatedAt: cloudMemory.updatedAt,
          conflict: false,
          conflictCloud: undefined,
          conflictDetectedAt: undefined,
          synced: true,
        }
        await memoryService.update(memory.id, updates)
        toast.success(t('conflictResolvedCloud', { defaultValue: 'Bulut versiyonu kullanıldı' }))
      }
      onResolved()
    } catch (error) {
      hapticFeedback('error')
      toast.error(
        t('conflictResolutionError', {
          defaultValue: 'Çakışma çözülürken bir hata oluştu',
        })
      )
    } finally {
      setResolving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {t('conflictDetected', { defaultValue: 'Çakışma Tespit Edildi' })}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('conflictDescription', {
                    defaultValue: 'Bu anı hem yerelde hem bulutta değiştirilmiş',
                  })}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={resolving}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
              aria-label={t('close', { defaultValue: 'Kapat' })}
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Local Version */}
            <div className="border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  {t('localVersion', { defaultValue: 'Yerel Versiyon' })}
                </h3>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {formatDate(memory.updatedAt)}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                {memory.text}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
                  {memory.category}
                </span>
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
                  {memory.lifeArea}
                </span>
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
                  {t('intensity')}: {memory.intensity}/10
                </span>
              </div>
            </div>

            {/* Cloud Version */}
            <div className="border-2 border-purple-200 dark:border-purple-800 rounded-xl p-4 bg-purple-50 dark:bg-purple-900/20">
              <div className="flex items-center gap-2 mb-3">
                <Cloud className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                  {t('cloudVersion', { defaultValue: 'Bulut Versiyonu' })}
                </h3>
                <span className="text-xs text-purple-600 dark:text-purple-400">
                  {formatDate(cloudMemory.updatedAt)}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                {cloudMemory.text}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded">
                  {cloudMemory.category}
                </span>
                <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded">
                  {cloudMemory.lifeArea}
                </span>
                <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded">
                  {t('intensity')}: {cloudMemory.intensity}/10
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => handleResolve(true)}
                disabled={resolving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors touch-manipulation"
              >
                <HardDrive className="w-4 h-4" />
                {t('keepLocal', { defaultValue: 'Yerel Versiyonu Koru' })}
              </button>
              <button
                onClick={() => handleResolve(false)}
                disabled={resolving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors touch-manipulation"
              >
                <Cloud className="w-4 h-4" />
                {t('keepCloud', { defaultValue: 'Bulut Versiyonunu Kullan' })}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
