import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  X, Sparkles, AlertCircle, Calendar, ChevronDown,
  Star, Link2, Check, Camera, Tag, Compass, Settings2,
} from 'lucide-react'
import { Memory, DailyQuestion, MemoryCategory, LifeArea } from '../types'
import { memoryService } from '../services/memoryService'
import { dailyQuestionService } from '../services/dailyQuestionService'
import { notificationService } from '../services/notificationService'
import { compressImage } from '../utils/imageUtils'
import ImageModal from './ImageModal'
import { hapticFeedback } from '../utils/haptic'
import { isNative, setBackButtonHandler } from '../utils/capacitor'
import { errorLoggingService } from '../services/errorLoggingService'
import LoadingSpinner from './LoadingSpinner'
import ConfirmationDialog from './ConfirmationDialog'
import ModalShell from './ModalShell'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import Toggle from './Toggle'
import ConnectionsInput from './ConnectionsInput'
import { 
  validateMemoryText, 
  validateDate, 
  validateIntensity, 
  validateConnections,
  validatePhotoCount 
} from '../utils/formValidation'

/* ═══════════════════════════════════════════════════
 *  CONSTANTS
 * ═══════════════════════════════════════════════════ */

interface MemoryFormProps {
  memory?: Memory
  onClose: () => void | Promise<void>
  onSave: (memory?: Memory) => void | Promise<void>
  userId: string
  presentation?: 'screen' | 'modal'
  dailyQuestion?: DailyQuestion | null
}

const INTENSITY_EMOJI: Record<number, string> = {
  1: '😶', 2: '🙂', 3: '😊', 4: '😄', 5: '😁',
  6: '🤩', 7: '🔥', 8: '💪', 9: '⚡', 10: '🚀',
}

function getIntensityGradient(val: number): string {
  if (val <= 2) return 'linear-gradient(90deg, #9CA3AF, #9CA3AF)'
  if (val <= 4) return 'linear-gradient(90deg, #FBBF24, #F59E0B)'
  if (val <= 6) return 'linear-gradient(90deg, #F97316, #EA580C)'
  if (val <= 8) return 'linear-gradient(90deg, #FF6B35, #E55A2B)'
  return 'linear-gradient(90deg, #EF4444, #DC2626)'
}

function getIntensityThumbColor(val: number): string {
  if (val <= 2) return '#9CA3AF'
  if (val <= 4) return '#F59E0B'
  if (val <= 6) return '#F97316'
  if (val <= 8) return '#FF6B35'
  return '#EF4444'
}

const CATEGORIES: MemoryCategory[] = [
  'uncategorized', 'success', 'peace', 'fun', 'love', 'gratitude', 'inspiration', 'growth', 'adventure',
]

const LIFE_AREAS: LifeArea[] = [
  'uncategorized', 'personal', 'work', 'relationship', 'family', 'friends', 'hobby', 'travel', 'health',
]

const CATEGORY_EMOJIS: Record<MemoryCategory, string> = {
  uncategorized: '🤖',
  success: '🏆',
  peace: '🕊️',
  fun: '🎉',
  love: '❤️',
  gratitude: '🙏',
  inspiration: '💡',
  growth: '🌱',
  adventure: '🧭',
}

const LIFE_AREA_EMOJIS: Record<LifeArea, string> = {
  uncategorized: '🤖',
  personal: '👤',
  work: '💼',
  relationship: '💑',
  family: '👨‍👩‍👧‍👦',
  friends: '👯',
  hobby: '🎨',
  travel: '✈️',
  health: '💪',
}

/* ═══════════════════════════════════════════════════
 *  ChipSelector — STABLE component (defined outside MemoryForm)
 * ═══════════════════════════════════════════════════ */
interface ChipSelectorProps<T extends string> {
  label: string
  icon: React.ReactNode
  options: T[]
  emojis: Record<string, string>
  value: T | T[]
  onChange: (val: T | T[]) => void
  aiHint: string
  t: (key: string, opts?: Record<string, string>) => string
  tPrefix: string
  multiSelect?: boolean
}

function ChipSelector<T extends string>({
  label,
  icon,
  options,
  emojis,
  value,
  onChange,
  aiHint,
  t,
  tPrefix,
  multiSelect = false,
}: ChipSelectorProps<T>) {
  const isArray = Array.isArray(value)
  const selectedValues = isArray ? value : [value]
  
  const handleToggle = (opt: T) => {
    hapticFeedback('light')
    if (multiSelect) {
      const current = isArray ? value : []
      if (current.includes(opt)) {
        // Remove from selection
        const newValue = current.filter(v => v !== opt)
        // If nothing selected, default to uncategorized
        onChange(newValue.length > 0 ? newValue : ['uncategorized'] as T[])
      } else {
        // Add to selection (remove uncategorized if adding something else)
        const filtered = current.filter(v => v !== 'uncategorized')
        onChange([...filtered, opt] as T[])
      }
    } else {
      onChange(opt)
    }
  }

  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold mb-2.5 text-gray-700 dark:text-gray-300">
        {icon}
        {label}
        {multiSelect && selectedValues.length > 1 && (
          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
            ({selectedValues.length})
          </span>
        )}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isActive = selectedValues.includes(opt)
          const isAI = opt === 'uncategorized'
          return (
            <button
              key={opt}
              type="button"
              onClick={() => handleToggle(opt)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all touch-manipulation border ${
                isActive
                  ? isAI
                    ? 'bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/15 border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                    : 'bg-primary/10 dark:bg-primary/15 border-primary/30 text-primary dark:text-primary-light'
                  : 'bg-white dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/60'
              }`}
            >
              {multiSelect && (
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                  isActive
                    ? 'bg-primary border-primary'
                    : 'border-gray-300 dark:border-gray-500'
                }`}>
                  {isActive && (
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
              )}
              <span className="text-sm leading-none">{emojis[opt] || '📌'}</span>
              <span>
                {isAI
                  ? aiHint
                  : t(`${tPrefix}.${opt}`, { defaultValue: opt })
                }
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
 *  MAIN FORM COMPONENT
 * ═══════════════════════════════════════════════════ */
export default function MemoryForm({
  memory,
  onClose,
  onSave,
  userId,
  presentation = 'modal',
  dailyQuestion,
}: MemoryFormProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  const initialDate = memory?.date
    ? new Date(memory.date).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  // Support both old (category) and new (categories) format — memoize to avoid
  // new array reference on every render which would retrigger useEffect loops
  const initialCategories = useMemo(() =>
    memory?.categories && memory.categories.length > 0
      ? memory.categories
      : memory?.category
        ? [memory.category]
        : ['uncategorized'],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memory?.id]
  )

  const [formData, setFormData] = useState({
    text: memory?.text ?? '',
    intensity: memory?.intensity ?? 5,
    date: initialDate,
    connections: memory?.connections.join(', ') ?? '',
    isCore: memory?.isCore ?? false,
    photos: memory?.photos ?? [] as string[],
    category: (memory?.category ?? 'uncategorized') as MemoryCategory, // Keep for backward compatibility
    categories: initialCategories as MemoryCategory[], // New multi-select
    lifeArea: (memory?.lifeArea ?? 'uncategorized') as LifeArea,
  })

  const [saving, setSaving] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isFullyOpen, setIsFullyOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false)
  
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    type?: 'danger' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  useBodyScrollLock(presentation === 'modal')

  // Auto-save draft
  useEffect(() => {
    if (!memory && formData.text.trim().length > 0) {
      const draftTimer = setTimeout(() => {
        try {
          localStorage.setItem(`memory_draft_${userId}`, JSON.stringify({
            ...formData,
            savedAt: Date.now(),
          }))
        } catch (error) {
          // Ignore localStorage errors
        }
      }, 30000) // Save every 30 seconds

      return () => clearTimeout(draftTimer)
    }
  }, [formData, memory, userId])

  // Save form state to sessionStorage when app goes to background
  useEffect(() => {
    if (!memory) {
      const saveToSession = () => {
        try {
          sessionStorage.setItem(`memory_form_state_${userId}`, JSON.stringify({
            ...formData,
            savedAt: Date.now(),
          }))
        } catch (error) {
          // Ignore sessionStorage errors
        }
      }

      // Save on visibility change (app goes to background)
      const handleVisibilityChange = () => {
        if (document.hidden && formData.text.trim().length > 0) {
          saveToSession()
        }
      }

      // Save periodically while form is open
      const interval = setInterval(() => {
        if (formData.text.trim().length > 0) {
          saveToSession()
        }
      }, 5000) // Save every 5 seconds

      document.addEventListener('visibilitychange', handleVisibilityChange)

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        clearInterval(interval)
      }
    }
  }, [formData, memory, userId])

  // Restore form state from sessionStorage on mount
  useEffect(() => {
    if (!memory) {
      try {
        const saved = sessionStorage.getItem(`memory_form_state_${userId}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          // Only restore if saved within last hour
          if (parsed.savedAt && Date.now() - parsed.savedAt < 3600000) {
            const restoredCategories = parsed.categories || (parsed.category ? [parsed.category] : ['uncategorized'])
            setFormData({
              text: parsed.text || '',
              intensity: parsed.intensity || 5,
              date: parsed.date || initialDate,
              connections: parsed.connections || '',
              isCore: parsed.isCore || false,
              photos: parsed.photos || [],
              category: restoredCategories[0] || 'uncategorized',
              categories: restoredCategories,
              lifeArea: parsed.lifeArea || 'uncategorized',
            })
            // Clear sessionStorage after restore
            sessionStorage.removeItem(`memory_form_state_${userId}`)
          }
        }
      } catch (error) {
        // Ignore restore errors
      }
    }
  }, [memory, userId, initialDate])

  // Load draft on mount
  useEffect(() => {
    if (!memory) {
      try {
        const draft = localStorage.getItem(`memory_draft_${userId}`)
        if (draft) {
          const parsed = JSON.parse(draft)
          // Only load if draft is less than 1 hour old and not for a saved memory
          if (parsed.savedAt && Date.now() - parsed.savedAt < 3600000 && !parsed.memoryId) {
            setFormData({
              text: parsed.text || '',
              intensity: parsed.intensity || 5,
              date: parsed.date || initialDate,
              connections: parsed.connections || '',
              isCore: parsed.isCore || false,
              photos: parsed.photos || [],
              category: parsed.category || 'uncategorized',
              categories: parsed.categories || initialCategories,
              lifeArea: parsed.lifeArea || 'uncategorized',
            })
            toast.success(t('draftLoaded', { defaultValue: 'Taslak yüklendi' }), { duration: 2000 })
          } else if (parsed.memoryId) {
            // Draft is for a saved memory, clear it
            localStorage.removeItem(`memory_draft_${userId}`)
          }
        }
      } catch (error) {
        // Ignore draft loading errors
      }
    }
  }, [memory, userId, initialDate, t, initialCategories])

  // Clear draft on save
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(`memory_draft_${userId}`)
    } catch (error) {
      // Ignore
    }
  }, [userId])

  useEffect(() => {
    if (memory) setExpanded(true)
  }, [memory])

  const isDirty = useMemo(() => {
    if (memory) {
      return (
        formData.text !== memory.text ||
        formData.intensity !== memory.intensity ||
        formData.date !== (memory.date ? new Date(memory.date).toISOString().split('T')[0] : initialDate) ||
        formData.connections !== memory.connections.join(', ') ||
        formData.isCore !== memory.isCore ||
        formData.photos.length !== memory.photos.length ||
        JSON.stringify(formData.categories?.sort()) !== JSON.stringify((memory.categories || (memory.category ? [memory.category] : ['uncategorized'])).sort()) ||
        formData.lifeArea !== memory.lifeArea
      )
    }
    return formData.text.trim().length > 0 || formData.photos.length > 0 || formData.connections.trim().length > 0
  }, [formData, memory, initialDate])

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFullyOpen(true)
      if (textareaRef.current && !memory) {
        textareaRef.current.focus()
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [memory])

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.max(el.scrollHeight, 120)}px`
  }

  useEffect(() => {
    autoResize()
  }, [formData.text])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    // Validate text using utility function
    const textValidation = validateMemoryText(formData.text, 10)
    if (!textValidation.isValid) {
      newErrors.text = textValidation.error || t('pleaseEnterText')
    }
    
    // Validate date using utility function
    const dateValidation = validateDate(formData.date)
    if (!dateValidation.isValid) {
      newErrors.date = dateValidation.error || t('dateCannotBeFuture')
    }
    
    // Validate intensity using utility function
    const intensityValidation = validateIntensity(formData.intensity)
    if (!intensityValidation.isValid) {
      newErrors.intensity = intensityValidation.error || t('intensityRange')
    }
    
    // Validate connections using utility function
    const connectionsValidation = validateConnections(formData.connections)
    if (!connectionsValidation.isValid) {
      newErrors.connections = connectionsValidation.error || t('invalidConnections')
    }
    
    // Validate photo count using utility function
    const photoValidation = validatePhotoCount(formData.photos.length, 5)
    if (!photoValidation.isValid) {
      newErrors.photos = photoValidation.error || t('maxPhotos')
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      hapticFeedback('error')
      toast.error(t('pleaseCheckForm'))
      return
    }
    try {
      setSaving(true)
      hapticFeedback('light')
      const connections = formData.connections.split(',').map(c => c.trim()).filter(c => c)
      let savedMemory: Memory | undefined

      // Use categories array if available, otherwise fall back to category for backward compatibility
      const categories = formData.categories && formData.categories.length > 0 
        ? formData.categories 
        : [formData.category]
      const primaryCategory = categories[0] // Keep category for backward compatibility

      if (memory) {
        await memoryService.update(memory.id, {
          text: formData.text,
          intensity: formData.intensity,
          date: formData.date,
          connections,
          isCore: formData.isCore,
          photos: formData.photos,
          category: primaryCategory, // Backward compatibility
          categories, // New multi-select
          lifeArea: formData.lifeArea,
        })
        hapticFeedback('success')
        savedMemory = memory
      } else {
        const created = await memoryService.create({
          text: formData.text,
          category: primaryCategory, // Backward compatibility
          categories, // New multi-select
          intensity: formData.intensity,
          date: formData.date,
          connections,
          lifeArea: formData.lifeArea,
          isCore: formData.isCore,
          photos: formData.photos,
          userId,
        })
        savedMemory = created
        hapticFeedback('success')
        
        if (dailyQuestion && dailyQuestion.id && formData.text.trim()) {
          dailyQuestionService.saveAnswer({
            userId,
            questionId: dailyQuestion.id,
            answerText: formData.text.trim(),
            memoryId: created.id,
          }).catch(() => {})
        }
      }

      setSaveSuccess(true)
      // Clear all draft storage on successful save
      clearDraft()
      try {
        sessionStorage.removeItem(`memory_form_state_${userId}`)
      } catch (_) {
        // Ignore
      }
      await new Promise(r => setTimeout(r, 500))

      if (savedMemory) {
        await onSave(savedMemory)
      }
      onClose()

      setTimeout(() => {
        if (memory) {
          toast.success(t('memoryUpdatedSuccess'), { duration: 3000, icon: '✅' })
        } else {
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
      }
      }, 200)

      if (!memory) {
        notificationService.showNotification('NICEBASE', {
          body: t('newMemorySaved', { defaultValue: 'Yeni anı kaydedildi! 💝' }),
          tag: 'memory-created',
        })
      }
    } catch (error) {
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Save error'),
        'error',
        userId
      )
      hapticFeedback('error')
      toast.error(t('saveErrorRetry'))
    } finally {
      setSaving(false)
      setSaveSuccess(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    // Store current textarea focus state
    const wasFocused = document.activeElement === textareaRef.current
    
    const newPhotos: string[] = []
    const maxPhotos = 5 - formData.photos.length
    if (maxPhotos <= 0) {
      toast.error(t('maxPhotosReached', { defaultValue: 'Maksimum 5 fotoğraf ekleyebilirsiniz' }))
      return
    }
    
    setUploading(true)
    try {
      for (let i = 0; i < Math.min(files.length, maxPhotos); i++) {
        const file = files[i]
        const compressed = await compressImage(file, 1920, 0.8)
        newPhotos.push(compressed)
      }
      setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }))
      hapticFeedback('success')
      
      // Restore focus if textarea was focused
      if (wasFocused && textareaRef.current) {
        setTimeout(() => {
          textareaRef.current?.focus()
        }, 100)
      }
    } catch (error) {
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Photo upload error'),
        'error',
        userId
      )
      toast.error(t('photoUploadError'))
    } finally {
      setUploading(false)
      // Reset input to allow selecting the same file again
      e.target.value = ''
    }
  }

  const requestClose = () => {
    if (!isFullyOpen) return
    if (isDirty && !saving) {
      setShowDirtyConfirm(true)
      return
    }
    onClose()
  }

  // Use a ref so the back button handler always calls the latest requestClose
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose

  // Handle Android back button to close the modal
  useEffect(() => {
    if (!isNative()) return
    setBackButtonHandler(() => {
      requestCloseRef.current()
      return true
    })
    return () => setBackButtonHandler(null)
  }, [])

  const questionText = dailyQuestion
    ? dailyQuestionService.getLocalizedQuestion(dailyQuestion)
    : null

  const detailBadgeCount = [
    formData.connections.trim().length > 0,
    formData.isCore,
    formData.photos.length > 0,
    formData.date !== new Date().toISOString().split('T')[0],
    formData.category !== 'uncategorized',
    formData.lifeArea !== 'uncategorized',
  ].filter(Boolean).length

  /* ═══════════════════════════════════════════════════
   *  SLIDER LOGIC
   * ═══════════════════════════════════════════════════ */
  const THUMB_SIZE = 28
  const THUMB_R = THUMB_SIZE / 2
  const [sliderWidth, setSliderWidth] = useState(0)

  useEffect(() => {
    if (!sliderRef.current) return
    const el = sliderRef.current
    const update = () => setSliderWidth(el.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sliderPct = (formData.intensity - 1) / 9
  const usableTrack = Math.max(0, sliderWidth - THUMB_SIZE)
  const thumbLeft = THUMB_R + sliderPct * usableTrack

  const updateSliderFromX = useCallback((clientX: number) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const usable = Math.max(1, rect.width - THUMB_SIZE)
    const rawX = clientX - rect.left
    const pct = Math.max(0, Math.min(1, (rawX - THUMB_R) / usable))
    const raw = 1 + pct * 9
    const stepped = Math.round(raw)
    const clamped = Math.max(1, Math.min(10, stepped))
    setFormData(prev => {
      if (prev.intensity === clamped) return prev
      hapticFeedback('light')
      return { ...prev, intensity: clamped }
    })
  }, [])

  const onSliderPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingSlider(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    updateSliderFromX(clientX)
  }

  useEffect(() => {
    if (!isDraggingSlider) return
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
      updateSliderFromX(clientX)
    }
    const onEnd = () => setIsDraggingSlider(false)

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [isDraggingSlider, updateSliderFromX])

  /* ═══════════════════════════════════════════════════
   *  FORM CONTENT
   *
   *  Structure (modal):
   *    flex-col wrapper  (with max-height constraint)
   *      Header          (flex-shrink-0)
   *      Scroll body     (flex-1 min-h-0 — scrolls when content exceeds)
   *      Action bar      (flex-shrink-0 — fixed at bottom)
   *
   *  The ModalShell uses autoHeight so the panel only has maxHeight,
   *  not a forced height. This means:
   *    - Collapsed: card is compact, centered by the overlay's flexbox.
   *    - Expanded:  card grows until it hits maxHeight, then scrolls.
   * ═══════════════════════════════════════════════════ */
  /* ── MODAL HEADER — rendered outside scroll container via ModalShell header prop ── */
  const modalHeader = (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/50">
      <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
        <div className="w-9 h-1 rounded-full bg-gray-200 dark:bg-gray-600" />
      </div>
      <div className="px-5 py-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {memory ? t('edit') : t('addMemory')}
        </h2>
        <button
          onClick={requestClose}
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
          aria-label={t('close')}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )

  /* ── MODAL FOOTER — rendered outside scroll container via ModalShell footer prop ── */
  const modalFooter = (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/50 px-5 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={requestClose}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl font-medium text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 touch-manipulation"
        >
          {t('cancel')}
        </button>
        <motion.button
          onClick={handleSave}
          disabled={saving || !formData.text.trim() || saveSuccess}
          whileTap={!saving ? { scale: 0.97 } : {}}
          className={`flex-1 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation ${
            saveSuccess
              ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
              : formData.text.trim()
                ? 'gradient-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 active:shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
          }`}
        >
          {saveSuccess ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2"
            >
              <Check size={16} />
              <span>{t('saved', { defaultValue: 'Kaydedildi!' })}</span>
            </motion.div>
          ) : saving ? (
            <>
              <LoadingSpinner size="sm" />
              <span>{t('saving')}</span>
            </>
          ) : (
            t('save')
          )}
        </motion.button>
      </div>
    </div>
  )

  const formContent = (
    <>
      {/* ── FORM BODY — scrolls inside ModalShell's scroll container ── */}
      <div className="px-5 space-y-5 pt-2 pb-4">

          {/* Daily Question Banner */}
          <AnimatePresence>
            {questionText && !memory && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50/50 dark:from-primary/8 dark:to-primary/4 px-4 py-3 border border-orange-100/60 dark:border-primary/10"
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="text-primary" size={12} />
                    </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest mb-0.5">
                    {t('dailyQuestion', { defaultValue: 'Günlük Soru' })}
                  </p>
                  <p className="text-[13px] font-medium text-gray-700 dark:text-gray-200 leading-snug">
                    {questionText}
                  </p>
              </div>
            </motion.div>
          )}
          </AnimatePresence>

          {/* ═══ TEXTAREA ═══ */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={formData.text}
              onChange={(e) => {
                  setFormData({ ...formData, text: e.target.value })
                if (errors.text) setErrors({ ...errors, text: '' })
                autoResize()
              }}
              rows={4}
              className={`w-full px-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-700/40 focus:outline-none resize-none touch-manipulation leading-relaxed text-[15px] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all ${
                errors.text 
                  ? 'ring-2 ring-red-400/50 bg-red-50/50 dark:bg-red-900/10'
                  : 'focus:bg-gray-100/80 dark:focus:bg-gray-700/60 focus:ring-2 focus:ring-primary/15'
              }`}
              placeholder={questionText || t('memoryTextPlaceholder')}
            />
            <AnimatePresence>
            {errors.text && (
              <motion.p 
                  initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-1.5 text-xs text-red-500 flex items-center gap-1"
              >
                  <AlertCircle size={12} className="flex-shrink-0" />
                <span>{errors.text}</span>
              </motion.p>
            )}
            </AnimatePresence>
          </div>

          {/* ═══ INTENSITY SLIDER ═══ */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('intensity')}
              </span>
              <div className="flex items-center gap-2">
                <motion.span
                  key={formData.intensity}
                  initial={{ scale: 1.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-xl leading-none"
                >
                  {INTENSITY_EMOJI[formData.intensity]}
                </motion.span>
                <motion.span
                  key={`n-${formData.intensity}`}
                  initial={{ y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-base font-bold tabular-nums min-w-[2.5ch] text-right"
                  style={{ color: getIntensityThumbColor(formData.intensity) }}
                >
                  {formData.intensity}
                </motion.span>
              </div>
            </div>

            <div
              ref={sliderRef}
              className="relative h-7 cursor-pointer touch-manipulation select-none"
              onMouseDown={onSliderPointerDown}
              onTouchStart={onSliderPointerDown}
            >
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[6px] rounded-full bg-gray-100 dark:bg-gray-700" />
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 left-0 h-[6px] rounded-full"
                style={{
                  background: getIntensityGradient(formData.intensity),
                  width: `${thumbLeft}px`,
                }}
                initial={false}
                animate={{ width: `${thumbLeft}px` }}
                transition={{ duration: isDraggingSlider ? 0 : 0.15 }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${thumbLeft}px` }}
              >
                <motion.div
                  animate={{ scale: isDraggingSlider ? 1.2 : 1 }}
                  transition={{ duration: 0.15 }}
                  className="w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center touch-manipulation"
                  style={{
                    border: `3px solid ${getIntensityThumbColor(formData.intensity)}`,
                    boxShadow: isDraggingSlider
                      ? `0 0 0 6px ${getIntensityThumbColor(formData.intensity)}20, 0 2px 8px rgba(0,0,0,0.15)`
                      : '0 2px 6px rgba(0,0,0,0.12)',
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getIntensityThumbColor(formData.intensity) }}
                />
                </motion.div>
              </div>
          </div>

            <div className="flex justify-between">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">
                {t('low', { defaultValue: 'Düşük' })}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">
                {t('high', { defaultValue: 'Yüksek' })}
              </span>
              </div>
              </div>

          {/* ═══ PHOTOS ═══ */}
          <div className="space-y-2.5">
            {formData.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {formData.photos.map((photo, idx) => (
                  <div key={idx} className="relative group flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden">
                    <img 
                      src={photo} 
                      alt={t('photo') + ` ${idx + 1}`} 
                      loading="lazy"
                      className="w-full h-full object-cover cursor-pointer touch-manipulation bg-gray-100 dark:bg-gray-700"
                      onError={(e) => {
                        const target = e.currentTarget
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23e5e7eb"/%3E%3C/svg%3E'
                        target.className = target.className + ' opacity-50'
                      }}
                      onClick={() => {
                        hapticFeedback('light')
                        setSelectedImageIndex(idx)
                        setShowImageModal(true)
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        hapticFeedback('warning')
                        setConfirmDialog({
                          isOpen: true,
                          title: t('deletePhoto'),
                          message: t('deletePhotoConfirm'),
                          type: 'warning',
                          onConfirm: () => {
                            setFormData({ ...formData, photos: formData.photos.filter((_, i) => i !== idx) })
                            hapticFeedback('success')
                          },
                        })
                      }}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 backdrop-blur-sm text-white rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg touch-manipulation"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {formData.photos.length < 5 && (
              <motion.label
                whileTap={{ scale: 0.98 }}
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl cursor-pointer transition-all touch-manipulation ${
                  uploading
                    ? 'bg-primary/5 border border-primary/20'
                    : 'bg-gray-50 dark:bg-gray-700/40 border border-dashed border-gray-200 dark:border-gray-600 hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10'
                }`}
              >
                {uploading ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-xs font-medium text-primary">{t('uploading', { defaultValue: 'Yükleniyor...' })}</span>
                  </div>
                ) : (
                  <>
                    <Camera size={16} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-500">
                      {t('uploadPhoto')} ({formData.photos.length}/5)
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </motion.label>
            )}
          </div>

          {/* ═══ DETAIL TOGGLE ═══ */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback('light')
              setExpanded(!expanded)
            }}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/60 active:bg-gray-100 dark:active:bg-gray-700 transition-colors touch-manipulation"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
              <Settings2 size={15} className="text-gray-400" />
              <span>{expanded ? t('lessDetail', { defaultValue: 'Daha Az' }) : t('moreDetail', { defaultValue: 'Daha Detaylı' })}</span>
              {!expanded && detailBadgeCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {detailBadgeCount}
                </span>
              )}
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>

          {/* ═══ DETAIL SECTION ═══ */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="details"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-5 pb-1">

                  {/* Category - Multi-select */}
                  <ChipSelector<MemoryCategory>
                    label={t('category', { defaultValue: 'Kategori' })}
                    icon={<Tag size={14} className="text-gray-400" />}
                    options={CATEGORIES}
                    emojis={CATEGORY_EMOJIS}
                    value={formData.categories}
                    onChange={(val) => {
                      const newCategories = Array.isArray(val) ? val : [val]
                      setFormData({ 
                        ...formData, 
                        categories: newCategories,
                        category: newCategories[0] // Keep for backward compatibility
                      })
                    }}
                    aiHint={t('aiDecides', { defaultValue: 'Aiya Belirlesin' })}
                    t={t}
                    tPrefix="categories"
                    multiSelect={true}
                  />

                  {/* Life Area */}
                  <ChipSelector<LifeArea>
                    label={t('lifeArea', { defaultValue: 'Yaşam Alanı' })}
                    icon={<Compass size={14} className="text-gray-400" />}
                    options={LIFE_AREAS}
                    emojis={LIFE_AREA_EMOJIS}
                    value={formData.lifeArea}
                    onChange={(val) => setFormData({ ...formData, lifeArea: Array.isArray(val) ? val[0] : val })}
                    aiHint={t('aiDecides', { defaultValue: 'Aiya Belirlesin' })}
                    t={t}
                    tPrefix="lifeAreas"
                  />

                  {/* Date */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30">
                    <div className="flex items-center gap-2.5">
                      <Calendar size={15} className="text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {new Date(formData.date).toLocaleDateString(
                          t('locale', { defaultValue: 'tr-TR' }),
                          { day: 'numeric', month: 'long', year: 'numeric' }
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback('light')
                        setShowDatePicker(!showDatePicker)
                      }}
                      className="text-xs text-primary font-semibold touch-manipulation"
                    >
                      {t('changeDate', { defaultValue: 'Değiştir' })}
                    </button>
                  </div>
                  <AnimatePresence>
                    {showDatePicker && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <input
                          type="date"
                          value={formData.date}
                          onChange={(e) => {
                            setFormData({ ...formData, date: e.target.value })
                            if (errors.date) setErrors({ ...errors, date: '' })
                          }}
                          max={new Date().toISOString().split('T')[0]}
                          className={`w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation border ${
                            errors.date
                              ? 'border-red-500'
                              : 'border-gray-200 dark:border-gray-600 focus:border-primary'
                          }`}
                        />
                        {errors.date && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-1.5 text-xs text-red-500 flex items-center gap-1"
                          >
                            <AlertCircle size={12} className="flex-shrink-0" />
                            <span>{errors.date}</span>
                          </motion.p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Connections */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                      <Link2 size={14} className="text-gray-400" />
                      {t('connections')}
                    </label>
                    <ConnectionsInput
                      value={formData.connections}
                      onChange={(val) => setFormData({ ...formData, connections: val })}
                      suggestions={[]}
                      placeholder={t('connectionsPlaceholder')}
                      hint={t('connectionsHint')}
                    />
                  </div>

                  {/* Core Memory */}
                  <div className={`flex items-center justify-between gap-3 p-3 rounded-xl transition-all ${
                    formData.isCore
                      ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/15 dark:to-amber-900/10 border border-yellow-200/60 dark:border-yellow-800/30'
                      : 'bg-gray-50 dark:bg-gray-700/30'
                  }`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Star size={16} className={formData.isCore ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'} />
                      <span className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
                        {t('coreMemory')}
                      </span>
                    </div>
                    <Toggle
                      checked={formData.isCore}
                      onChange={(val) => {
                        hapticFeedback('light')
                        setFormData({ ...formData, isCore: val })
                      }}
                      ariaLabel={t('coreMemory')}
                      size="sm"
                      className="flex-shrink-0"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      {/* Modals */}
        {showImageModal && (
          <ImageModal
            images={formData.photos}
            currentIndex={selectedImageIndex}
            onClose={() => setShowImageModal(false)}
          />
        )}

        <ConfirmationDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          type={confirmDialog.type}
        />

      {/* Unsaved Changes Dialog with Draft Save Option */}
      <AnimatePresence>
        {showDirtyConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDirtyConfirm(false)}
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
                    className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/20"
                  >
                    <AlertCircle
                      className="text-orange-600 dark:text-orange-400"
                      size={24}
                    />
                  </motion.div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {t('unsavedChanges', { defaultValue: 'Kaydedilmemiş Değişiklikler' })}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {t('unsavedChangesMessage', { defaultValue: 'Kaydedilmemiş değişiklikleriniz var. Ne yapmak istersiniz?' })}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDirtyConfirm(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 touch-manipulation"
                    aria-label={t('cancel')}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      // Save as draft
                      try {
                        const connections = formData.connections.split(',').map(c => c.trim()).filter(c => c)
                        const categories = formData.categories && formData.categories.length > 0 
                          ? formData.categories 
                          : [formData.category]
                        const primaryCategory = categories[0]
                        
                        // Save to localStorage as draft
                        localStorage.setItem(`memory_draft_${userId}`, JSON.stringify({
                          ...formData,
                          savedAt: Date.now(),
                        }))
                        
                        hapticFeedback('success')
                        toast.success(t('draftSaved', { defaultValue: 'Taslak olarak kaydedildi' }), { duration: 2000 })
                        setShowDirtyConfirm(false)
                        onClose()
                      } catch (error) {
                        hapticFeedback('error')
                        toast.error(t('draftSaveError', { defaultValue: 'Taslak kaydedilemedi' }))
                      }
                    }}
                    className="w-full px-4 py-3 bg-primary text-white rounded-xl font-semibold transition-colors touch-manipulation shadow-lg hover:bg-primary-dark"
                  >
                    {t('saveAsDraft', { defaultValue: 'Taslak Olarak Kaydet' })}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowDirtyConfirm(false)
                      onClose()
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                  >
                    {t('discardChanges', { defaultValue: 'Kaydetmeden Çık' })}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDirtyConfirm(false)}
                    className="w-full px-4 py-3 text-gray-600 dark:text-gray-400 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                  >
                    {t('cancel')}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )

  if (presentation === 'screen') {
    return (
      <div
        className="fixed inset-0 flex flex-col bg-white dark:bg-gray-800 z-50"
        style={{
          paddingTop: 'var(--safe-area-inset-top, 0px)',
          paddingBottom: 'var(--safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex-shrink-0">{modalHeader}</div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="max-w-2xl mx-auto w-full">
            {formContent}
          </div>
        </div>
        <div className="flex-shrink-0">{modalFooter}</div>
      </div>
    )
  }

  return (
    <ModalShell
      isOpen={true}
      onClose={requestClose}
      scroll={true}
      autoHeight={true}
      panelClassName="p-0"
      className="z-[100]"
      header={modalHeader}
      footer={modalFooter}
    >
      {formContent}
    </ModalShell>
  )
}
