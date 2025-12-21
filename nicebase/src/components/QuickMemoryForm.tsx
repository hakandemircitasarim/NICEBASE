import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { X, Zap, Sparkles, Heart, Smile } from 'lucide-react'
import { Memory, MemoryCategory } from '../types'
import { memoryService } from '../services/memoryService'
import { hapticFeedback } from '../utils/haptic'
import { errorLoggingService } from '../services/errorLoggingService'
import LoadingSpinner from './LoadingSpinner'
import MemoryForm from './MemoryForm'
import ModalShell from './ModalShell'

export type QuickMemoryDraft = {
  text: string
  category: MemoryCategory
}

interface QuickMemoryFormProps {
  onClose: () => void
  onSave: (newMemory: Memory) => void
  userId: string
  defaultText?: string
}

export default function QuickMemoryForm({ onClose, onSave, userId, defaultText = '' }: QuickMemoryFormProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(defaultText)
  const [category, setCategory] = useState<MemoryCategory>('success')
  const [saving, setSaving] = useState(false)
  const [isFullyOpen, setIsFullyOpen] = useState(false)
  const [mode, setMode] = useState<'quick' | 'full'>('quick')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Focus textarea after modal animation completes to prevent keyboard flicker
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFullyOpen(true)
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }, 300) // Wait for animation to complete
    
    return () => clearTimeout(timer)
  }, [])

  const requestClose = () => {
    // Prevent closing during initial animation
    if (!isFullyOpen) return
    // In "full" mode, let the embedded form handle close/dirty-confirm via its own UI.
    if (mode === 'full') return
    onClose()
  }

  const handleSave = async () => {
    if (!text.trim() || text.trim().length < 5) {
      hapticFeedback('error')
      toast.error(t('minCharactersRequired', { min: 5 }))
      return
    }

    try {
      setSaving(true)
      hapticFeedback('light')
      
      const newMemory = await memoryService.create({
        text: text.trim(),
        category,
        intensity: 7, // Default intensity for positive memories
        date: new Date().toISOString(),
        connections: [],
        lifeArea: 'personal',
        isCore: false,
        photos: [],
        userId,
      })

      hapticFeedback('success')
      
      const messages = [
        t('quickSaveMessages.message1'),
        t('quickSaveMessages.message2'),
        t('quickSaveMessages.message3'),
      ]
      
      const randomMessage = messages[Math.floor(Math.random() * messages.length)]
      toast.success(randomMessage, {
        duration: 3000,
        icon: '⚡',
        style: {
          background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
          color: 'white',
          fontWeight: '600',
        },
      })

      onSave(newMemory)
      onClose()
    } catch (error) {
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Save error'),
        'error',
        userId
      )
      hapticFeedback('error')
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      isOpen={true}
      onClose={requestClose}
      scroll={false}
      panelClassName="p-0 bg-transparent border-0 shadow-none"
      className="z-[100]"
    >
      <div className="rounded-3xl bg-gradient-to-br from-primary/15 via-white to-orange-50 dark:from-primary/12 dark:via-gray-900 dark:to-gray-800 p-[1.5px] shadow-2xl shadow-primary/10 h-full flex flex-col min-h-0">
        <div className="bg-white dark:bg-gray-800 rounded-[22px] border border-gray-200 dark:border-gray-700 safe-area-inset flex flex-col overflow-hidden min-h-0 flex-1">
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sm:p-5 z-10 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/20">
                <Zap className="text-primary" size={18} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                  {t('addMemory')}
                </span>
                <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{t('addMemory')}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('quickMemorySubtitle')}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="icon-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={t('close')}
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-4 sm:px-6 pt-4 pb-6 flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' as any }}>
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode('quick')}
              className={`flex-1 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border shadow-sm ${
                mode === 'quick'
                  ? 'border-primary bg-gradient-to-r from-primary to-orange-400 text-white shadow-primary/30 shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span aria-hidden>⚡ </span>{t('quickMode')}
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback('light')
                setMode('full')
              }}
              className={`flex-1 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border shadow-sm ${
                mode === 'full'
                  ? 'border-primary bg-gradient-to-r from-primary to-orange-400 text-white shadow-primary/30 shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span aria-hidden>✨ </span>{t('detailedMode')}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {mode === 'quick' ? t('quickModeHint') : t('detailedModeHint')}
          </p>

          <AnimatePresence mode="wait">
            {mode === 'quick' ? (
              <motion.div
                key="quick"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-4 pr-1"
              >
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    {t('text')} <span className="text-red-500">*</span>
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-900/40 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/15 transition-all">
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-transparent focus:outline-none resize-none touch-manipulation text-base text-gray-900 dark:text-gray-100"
                      placeholder={text ? '' : t('quickMemoryPlaceholder')}
                      onFocus={(e) => {
                        e.stopPropagation()
                        if (defaultText && text === defaultText) {
                          e.target.select()
                          setText('')
                        } else if (text && text.trim() === defaultText?.trim()) {
                          e.target.select()
                          setText('')
                        }
                      }}
                      onClick={(e) => {
                        if (defaultText && text === defaultText) {
                          e.currentTarget.select()
                          setText('')
                        }
                      }}
                    />
                    <div className="flex justify-end px-4 pb-2 text-xs text-gray-500">{text.length}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    {t('category')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCategory('success')}
                      className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all touch-manipulation flex items-center justify-center gap-2 ${
                        category === 'success'
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Sparkles size={16} />
                      {t('categories.success')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('peace')}
                      className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all touch-manipulation flex items-center justify-center gap-2 ${
                        category === 'peace'
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Smile size={16} />
                      {t('categories.peace')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('fun')}
                      className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all touch-manipulation flex items-center justify-center gap-2 ${
                        category === 'fun'
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Heart size={16} />
                      {t('categories.fun')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('love')}
                      className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all touch-manipulation flex items-center justify-center gap-2 ${
                        category === 'love'
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Heart size={16} />
                      {t('categories.love')}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={onClose}
                    disabled={saving}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !text.trim()}
                    className="flex-1 px-4 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>{t('saving')}</span>
                      </>
                    ) : (
                      <>
                        <Zap size={16} />
                        <span>{t('save')}</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  {t('quickAddHint')}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="min-h-[60vh] rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40"
              >
                <MemoryForm
                  embedded
                  hideHeader
                  enableHistoryClose={false}
                  hideModeToggle
                  initialMode="advanced"
                  initialValues={{
                    text: text.trim(),
                    category,
                    intensity: 7,
                    date: new Date().toISOString(),
                    connections: [],
                    lifeArea: 'personal',
                    isCore: false,
                    photos: [],
                  }}
                  onClose={onClose}
                  onSave={(m?: Memory) => {
                    if (m) onSave(m)
                  }}
                  userId={userId}
                />
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

