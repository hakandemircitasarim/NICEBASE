import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import { hapticFeedback } from '../utils/haptic'

interface MemoryFormActionsProps {
  saving: boolean
  onCancel: () => void
  onSave: () => void
  variant?: 'inline' | 'sticky'
  className?: string
}

export default function MemoryFormActions({
  saving,
  onCancel,
  onSave,
  variant = 'inline',
  className = '',
}: MemoryFormActionsProps) {
  const { t } = useTranslation()

  return (
    <div
      className={[
        'flex gap-4 sm:gap-5',
        variant === 'inline'
          ? 'mt-8 pt-6 border-t border-gray-200 dark:border-gray-700'
          : '',
        className,
      ].join(' ')}
    >
      <button
        onClick={() => {
          hapticFeedback('light')
          onCancel()
        }}
        disabled={saving}
        className="flex-1 px-6 py-3.5 sm:py-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 touch-manipulation flex items-center justify-center gap-2"
      >
        <X size={18} />
        <span>{t('cancel')}</span>
      </button>
      <button
        onClick={() => {
          if (saving) return
          hapticFeedback('light')
          onSave()
        }}
        disabled={saving}
        className="flex-1 px-6 py-3.5 sm:py-4 gradient-primary text-white rounded-xl font-semibold hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation"
      >
        {saving ? (
          <>
            <LoadingSpinner size="sm" />
            <span>{t('saving')}</span>
          </>
        ) : (
          <>
            <Check size={18} />
            <span>{t('save')}</span>
          </>
        )}
      </button>
    </div>
  )
}






