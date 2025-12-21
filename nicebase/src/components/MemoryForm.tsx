import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Memory, MemoryCategory, LifeArea } from '../types'
import { memoryService } from '../services/memoryService'
import { aiyaService } from '../services/aiyaService'
import { notificationService } from '../services/notificationService'
import { compressImage } from '../utils/imageUtils'
import ImageModal from './ImageModal'
import { hapticFeedback } from '../utils/haptic'
import { errorLoggingService } from '../services/errorLoggingService'
import ConfirmationDialog from './ConfirmationDialog'
import SuccessAnimation from './SuccessAnimation'
import MemoryFormHeader from './MemoryFormHeader'
import MemoryFormFields from './MemoryFormFields'
import MemoryFormPhotos from './MemoryFormPhotos'
import MemoryFormAdvancedFields from './MemoryFormAdvancedFields'
import MemoryFormActions from './MemoryFormActions'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useNotifications } from '../hooks/useNotifications'
import { validateConnections, validateDate } from '../utils/formValidation'
import { getUniqueConnections } from '../utils/memoryUtils'
import { useSwipe } from '../hooks/useSwipe'
import ModalShell from './ModalShell'

type MemoryInitialValues = Partial<Pick<
  Memory,
  'text' | 'category' | 'intensity' | 'date' | 'connections' | 'lifeArea' | 'isCore' | 'photos'
>>

interface MemoryFormProps {
  memory?: Memory
  initialValues?: MemoryInitialValues
  initialMode?: 'simple' | 'advanced'
  hideModeToggle?: boolean
  hideHeader?: boolean
  embedded?: boolean
  presentation?: 'modal' | 'embedded' | 'screen'
  enableHistoryClose?: boolean
  onClose: () => void
  onSave: (newMemory?: Memory) => void | Promise<void>
  userId: string
}

export default function MemoryForm({
  memory,
  initialValues,
  initialMode,
  hideModeToggle,
  hideHeader = false,
  embedded = false,
  presentation,
  enableHistoryClose = true,
  onClose,
  onSave,
  userId,
}: MemoryFormProps) {
  const { t } = useTranslation()
  const { showSuccess, showError } = useNotifications()

  // Determine rendering surface early (used by hooks below).
  const resolvedPresentation: 'modal' | 'embedded' | 'screen' =
    presentation || (embedded ? 'embedded' : 'modal')

  const initialFormData = useMemo(() => {
    return {
      text: memory?.text || initialValues?.text || '',
      category: ((memory?.category || initialValues?.category || 'success') as MemoryCategory),
      intensity: memory?.intensity ?? initialValues?.intensity ?? 5,
      date: memory?.date
        ? new Date(memory.date).toISOString().split('T')[0]
        : initialValues?.date
          ? new Date(initialValues.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
      connections: memory?.connections.join(', ') || (initialValues?.connections ? initialValues.connections.join(', ') : ''),
      lifeArea: ((memory?.lifeArea || initialValues?.lifeArea || 'personal') as LifeArea),
      isCore: memory?.isCore ?? initialValues?.isCore ?? false,
      photos: memory?.photos || initialValues?.photos || ([] as string[]),
    }
  }, [memory, initialValues])

  const [formData, setFormData] = useState(initialFormData)
  const [saving, setSaving] = useState(false)
  const [suggestingCategory, setSuggestingCategory] = useState(false)
  const [categorySuggestion, setCategorySuggestion] = useState<MemoryCategory | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [simpleMode, setSimpleMode] = useState(() => {
    if (memory) return false
    if (initialMode) return initialMode === 'simple'
    return true
  }) // Yeni anılar için varsayılan olarak basit mod
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const [connectionSuggestions, setConnectionSuggestions] = useState<string[]>([])

  const { openConfirm, confirmDialogProps } = useConfirmDialog()

  // Keep form in sync when opening for a different memory/draft.
  useEffect(() => {
    setFormData(initialFormData)
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFormData])

  const serializeFormData = useCallback((data: typeof initialFormData) => {
    // Stable, minimal serialization for dirty-check.
    return JSON.stringify({
      text: data.text,
      category: data.category,
      intensity: data.intensity,
      date: data.date,
      connections: data.connections,
      lifeArea: data.lifeArea,
      isCore: data.isCore,
      photos: data.photos,
    })
  }, [])

  const initialSnapshotRef = useRef<string>('')
  useEffect(() => {
    initialSnapshotRef.current = serializeFormData(initialFormData)
  }, [initialFormData, serializeFormData])

  const isDirty = useMemo(() => {
    return serializeFormData(formData) !== initialSnapshotRef.current
  }, [formData, serializeFormData])

  const forceClose = useCallback(() => {
    onClose()
  }, [onClose])

  const requestCloseRef = useRef<null | (() => void)>(null)

  // Allow browser/mobile back to close the modal (instead of getting "stuck").
  // We push a history state on mount and pop it on close, so back works naturally.
  const historyPushedRef = useRef(false)
  const ignoreNextPopRef = useRef(false)
  const closedFromPopRef = useRef(false)

  const requestClose = useCallback(() => {
    if (saving) return
    if (!isDirty) {
      // If we pushed a history entry, pop it so navigation stays consistent.
      if (historyPushedRef.current && !closedFromPopRef.current) {
        try {
          ignoreNextPopRef.current = true
          window.history.back()
          setTimeout(() => {
            ignoreNextPopRef.current = false
          }, 0)
        } catch {
          // ignore
        }
      }
      forceClose()
      return
    }
    openConfirm({
      title: t('discardChangesTitle', { defaultValue: 'Değişiklikler kaydedilmedi' }),
      message: t('discardChangesMessage', { defaultValue: 'Çıkarsanız kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?' }),
      type: 'warning',
      confirmText: t('discardChangesConfirm', { defaultValue: 'Çık' }),
      cancelText: t('keepEditing', { defaultValue: 'Düzenlemeye devam et' }),
      onConfirm: () => {
        if (historyPushedRef.current && !closedFromPopRef.current) {
          try {
            ignoreNextPopRef.current = true
            window.history.back()
            setTimeout(() => {
              ignoreNextPopRef.current = false
            }, 0)
          } catch {
            // ignore
          }
        }
        forceClose()
      },
    })
  }, [saving, isDirty, openConfirm, forceClose, t])

  const swipeCloseHandlers = useSwipe({
    onSwipeDown: () => {
      // Swiping down on the header closes (mobile-friendly, avoids scroll conflicts).
      requestClose()
    },
  })

  useEffect(() => {
    requestCloseRef.current = requestClose
  }, [requestClose])

  // Focus text input on open for a faster capture flow (especially on mobile).
  useEffect(() => {
    if (memory) return
    const shouldAutofocus =
      resolvedPresentation === 'modal' || resolvedPresentation === 'screen'
    if (!shouldAutofocus) return

    const delayMs = resolvedPresentation === 'modal' ? 250 : 0
    const timer = window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>('[data-memory-textarea="true"]')
      if (!el) return
      try {
        el.focus({ preventScroll: true } as any)
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } catch {
        // ignore
      }
    }, delayMs)

    return () => window.clearTimeout(timer)
  }, [memory, resolvedPresentation])

  useEffect(() => {
    if (embedded || !enableHistoryClose) return
    try {
      const currentState = window.history.state || {}
      // React 18 StrictMode (dev) mounts components twice.
      // If we already pushed this modal state, don't push again (prevents duplicate history entries).
      if (currentState?.__nicebase_modal !== 'MemoryForm') {
        window.history.pushState({ ...currentState, __nicebase_modal: 'MemoryForm' }, '')
        historyPushedRef.current = true
      }
    } catch {
      // no-op (some webviews can restrict history)
    }

    const onPopState = () => {
      if (ignoreNextPopRef.current) return
      closedFromPopRef.current = true
      requestCloseRef.current?.()
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [embedded, enableHistoryClose])

  const titleId = resolvedPresentation === 'modal' ? 'memory-form-title' : undefined

  const headerNode = hideHeader ? null : (
    <MemoryFormHeader
      isEditMode={!!memory}
      simpleMode={simpleMode}
      onToggleMode={(simple) => setSimpleMode(simple)}
      onClose={requestClose}
      showModeToggle={!hideModeToggle}
      layoutId={embedded ? 'memoryEntryHeader' : undefined}
      titleId={titleId}
      swipeHandlers={swipeCloseHandlers}
    />
  )

  const bodyNode = (
    <div className="px-4 sm:px-8 lg:px-10 pt-5 sm:pt-7 pb-8 space-y-6 sm:space-y-7">
      <MemoryFormFields
        text={formData.text}
        category={formData.category}
        intensity={formData.intensity}
        textLength={formData.text.length}
        suggestingCategory={suggestingCategory}
        categorySuggestion={categorySuggestion}
        error={errors.text}
        onTextChange={(text) => {
          setFormData({ ...formData, text })
          if (errors.text) {
            setErrors({ ...errors, text: '' })
          }
        }}
        onTextBlur={() => {
          if (!formData.text.trim()) {
            setErrors({ ...errors, text: t('pleaseEnterText') })
          } else if (formData.text.trim().length < 10) {
            setErrors({ ...errors, text: t('textMinLength10') })
          }
        }}
        onTextFocus={(e) => {
          if (formData.text && !memory) {
            const textarea = e.target as HTMLTextAreaElement
            setTimeout(() => {
              textarea.select()
            }, 0)
          }
        }}
        onCategoryChange={(category) => {
          setFormData({ ...formData, category })
          if (categorySuggestion && categorySuggestion !== category) {
            setCategorySuggestion(null)
          }
        }}
        onIntensityChange={(intensity) => setFormData({ ...formData, intensity })}
      />

      <MemoryFormPhotos
        photos={formData.photos}
        uploading={uploadingPhotos}
        onPhotoUpload={handlePhotoUpload}
        onPhotoClick={(idx) => {
          setSelectedImageIndex(idx)
          setShowImageModal(true)
        }}
        onPhotoDelete={(idx) => {
          openConfirm({
            title: t('deletePhoto'),
            message: t('deletePhotoConfirm'),
            type: 'warning',
            onConfirm: () => {
              setFormData({ ...formData, photos: formData.photos.filter((_, i) => i !== idx) })
              hapticFeedback('success')
            },
          })
        }}
      />

      <AnimatePresence initial={false}>
        {!simpleMode && (
          <motion.div
            key="advancedFields"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <MemoryFormAdvancedFields
              date={formData.date}
              connections={formData.connections}
              lifeArea={formData.lifeArea}
              isCore={formData.isCore}
              dateError={errors.date}
              connectionsError={errors.connections}
              connectionSuggestions={connectionSuggestions}
              onDateChange={(date) => {
                setFormData({ ...formData, date })
                if (errors.date) {
                  setErrors({ ...errors, date: '' })
                }
              }}
              onDateBlur={() => {
                const selectedDate = new Date(formData.date)
                const today = new Date()
                today.setHours(23, 59, 59, 999)
                if (selectedDate > today) {
                  setErrors({ ...errors, date: t('dateCannotBeFuture') })
                }
              }}
              onConnectionsChange={(connections) => {
                setFormData({ ...formData, connections })
                if (errors.connections) {
                  setErrors({ ...errors, connections: '' })
                }
              }}
              onLifeAreaChange={(lifeArea) => setFormData({ ...formData, lifeArea })}
              onIsCoreChange={(isCore) => setFormData({ ...formData, isCore })}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  const footerNode = (
    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 glass px-4 sm:px-8 lg:px-10 py-4 safe-area-bottom">
      <MemoryFormActions
        saving={saving}
        onCancel={requestClose}
        onSave={handleSave}
        variant="sticky"
      />
    </div>
  )

  const overlays = (
    <>
      {showImageModal && (
        <ImageModal
          images={formData.photos}
          currentIndex={selectedImageIndex}
          onClose={() => setShowImageModal(false)}
        />
      )}

      <ConfirmationDialog
        {...confirmDialogProps}
      />

      <AnimatePresence>
        {showSuccessAnimation && (
          <SuccessAnimation
            message={t('memoryCreated')}
            onComplete={() => setShowSuccessAnimation(false)}
          />
        )}
      </AnimatePresence>
    </>
  )

  const content = (
    <>
      {headerNode}
      {bodyNode}
      {overlays}
    </>
  )

  useEffect(() => {
    // Auto-suggest category when text changes
    // Only if OpenAI API key is available
    const apiKey = (import.meta as any).env.VITE_OPENAI_API_KEY
    if (!apiKey) return // Skip if no API key
    if (!aiyaService.canSuggestCategory()) return
    
    if (formData.text.length > 20 && !memory) {
      const timeoutId = setTimeout(async () => {
        setSuggestingCategory(true)
        try {
          const suggestion = await aiyaService.suggestCategory(formData.text)
          if (suggestion) {
            setCategorySuggestion(suggestion as MemoryCategory)
            setFormData(prev => ({ ...prev, category: suggestion as MemoryCategory }))
            toast.success(t('categorySuggestion', { category: suggestion }), { duration: 2000 })
          }
        } catch (error) {
          // Silent fail - API key might be invalid or service unavailable
        } finally {
          setSuggestingCategory(false)
        }
      }, 1000)
      return () => clearTimeout(timeoutId)
    }
  }, [formData.text, memory])

  useEffect(() => {
    let active = true
    // Preload existing connections for suggestions (offline-friendly).
    memoryService
      .getAll(userId)
      .then((memories) => {
        if (!active) return
        setConnectionSuggestions(getUniqueConnections(memories))
      })
      .catch(() => {
        // Silent: suggestions are optional
      })
    return () => {
      active = false
    }
  }, [userId])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.text.trim()) {
      newErrors.text = t('pleaseEnterText')
    } else if (formData.text.trim().length < 10) {
      newErrors.text = t('textMinLength10')
    }

    const dateValidation = validateDate(formData.date)
    if (!dateValidation.isValid) {
      newErrors.date = t('dateCannotBeFuture')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const closeAfterCreate = (newMemory: Memory) => {
    // Close form after animation and pass new memory for optimistic update
    setTimeout(() => {
      setShowSuccessAnimation(false)
      setTimeout(() => {
        // Close immediately; refresh in background to avoid "stuck/blank" states
        forceClose()
        Promise.resolve(onSave(newMemory)).catch((error) => {
          // Error is handled silently
          if (import.meta.env.DEV) {
            console.error('Error in onSave callback:', error)
          }
        })
      }, 300)
    }, 1200)
  }

  const saveExisting = async (connections: string[]) => {
    if (!memory) return

    await memoryService.update(memory.id, {
      ...formData,
      connections,
      userId,
    })

    showSuccess(t('memoryUpdatedSuccess'), {
      duration: 3000,
      icon: '✅',
    })
  }

  const createNew = async (connections: string[]) => {
    const newMemory = await memoryService.create({
      ...formData,
      connections,
      userId,
    })

    hapticFeedback('success')

    // Show success animation
    setShowSuccessAnimation(true)

    // Motivasyonel mesajlar
    const messages = [
      t('memoryCreatedMessages.message1'),
      t('memoryCreatedMessages.message2'),
      t('memoryCreatedMessages.message3'),
      t('memoryCreatedMessages.message4'),
      t('memoryCreatedMessages.message5'),
    ]

    const randomMessage = messages[Math.floor(Math.random() * messages.length)]
    toast.success(randomMessage, {
      duration: 4000,
      icon: '✨',
      style: {
        background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
        color: 'white',
        fontWeight: '600',
      },
    })

    closeAfterCreate(newMemory)
    return newMemory
  }

  async function handleSave() {
    if (!validateForm()) {
      showError(t('pleaseCheckForm'))
      return
    }

    try {
      setSaving(true)
      hapticFeedback('light')
      const connectionsResult = validateConnections(formData.connections)
      if (!connectionsResult.isValid) {
        const msg = connectionsResult.error || t('pleaseCheckForm')
        setErrors((prev) => ({ ...prev, connections: msg }))
        showError(msg)
        return
      }
      const connections = connectionsResult.parsed

      if (memory) {
        await saveExisting(connections)
      } else {
        await createNew(connections)
        return
      }

      // Close immediately; refresh in background to avoid "stuck/blank" states
      forceClose()
      Promise.resolve(onSave()).catch((error) => {
        if (import.meta.env.DEV) {
          console.error('Error in onSave callback:', error)
        }
      })
      
      // Show notification if it's a new memory
      if (!memory) {
        notificationService.showNotification('NICEBASE', {
          body: t('newMemorySaved'),
          tag: 'memory-created',
        })
      }
    } catch (error) {
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Save error'),
        'error',
        userId
      )
      showError(t('saveErrorRetry'))
    } finally {
      setSaving(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return

    const newPhotos: string[] = []
    const maxPhotos = 5 - formData.photos.length

    try {
      setUploadingPhotos(true)
      for (let i = 0; i < Math.min(files.length, maxPhotos); i++) {
        const file = files[i]
        // Compress image for mobile (max 1920px width, 80% quality)
        const compressed = await compressImage(file, 1920, 0.8)
        newPhotos.push(compressed)
      }
      setFormData({ ...formData, photos: [...formData.photos, ...newPhotos] })
      toast.success(t('photosAdded', { count: newPhotos.length }))
    } catch (error) {
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Photo upload error'),
        'error',
        userId
      )
      toast.error(t('photoUploadError'))
    } finally {
      setUploadingPhotos(false)
      // Allow selecting the same file again.
      try {
        e.target.value = ''
      } catch {
        // ignore
      }
    }
  }

  if (resolvedPresentation === 'screen') {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-white dark:bg-gray-800 safe-area-inset">
        {headerNode}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' as any }}>
          {bodyNode}
        </div>
        {footerNode}
        {overlays}
      </div>
    )
  }

  if (resolvedPresentation === 'embedded') {
    return (
      <div className="flex flex-col min-h-0">
        {content}
        {footerNode}
      </div>
    )
  }

  return (
    <>
      <ModalShell
        isOpen={true}
        onClose={requestClose}
        labelledBy={titleId}
        header={headerNode}
        footer={footerNode}
      >
        {/* Body content only; ModalShell owns scrolling */}
        {bodyNode}
      </ModalShell>
      {overlays}
    </>
  )
}

