import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Heart, Plus, Sparkles, Flame, Sun, Moon, Sunrise, Sunset, CheckCircle, RefreshCw, Image as ImageIcon, X, Calendar, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { Memory, DailyQuestion } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import { streakService } from '../services/streakService'
import { notificationService } from '../services/notificationService'
import { dailyQuestionService, getDefaultQuestion } from '../services/dailyQuestionService'
import Onboarding from '../components/Onboarding'
import MemoryForm from '../components/MemoryForm'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import { useNotifications } from '../hooks/useNotifications'
import { isNative } from '../utils/capacitor'
import ConflictResolutionDialog from '../components/ConflictResolutionDialog'

export default function Home() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const user = useStore((s) => s.user)
  const hasCompletedOnboarding = useStore((s) => s.hasCompletedOnboarding)
  const setHasCompletedOnboarding = useStore((s) => s.setHasCompletedOnboarding)
  const userId = useUserId()
  const { showSuccess, showError, hapticFeedback } = useNotifications()
  const prefersReducedMotion = useReducedMotion()
  const locale = (i18n?.language || 'tr').startsWith('tr') ? 'tr-TR' : 'en-US'
  const [isBreathing, setIsBreathing] = useState(false)
  const [randomMemory, setRandomMemory] = useState<Memory | null>(null)
  const [lastShownMemoryId, setLastShownMemoryId] = useState<string | null>(null)
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0, lastMemoryDate: null as string | null, streakStartDate: null as string | null })
  const [showForm, setShowForm] = useState(false)
  const [editingMemory, setEditingMemory] = useState<Memory | undefined>()
  // Nav height is h-16 (64px) + safe-area-inset-bottom + 1.5rem gap
  const fabBottom = 'calc(64px + env(safe-area-inset-bottom, 0px) + 1.5rem)'
  const skipBreathingRef = useRef<null | (() => void)>(null)

  // Daily question state
  const [dailyQuestion, setDailyQuestion] = useState<DailyQuestion>(() => getDefaultQuestion())
  const [dailyQuestionForForm, setDailyQuestionForForm] = useState<DailyQuestion | null>(null)
  const [hasAnsweredToday, setHasAnsweredToday] = useState(false)

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 6) return { text: t('greetingNight', { defaultValue: 'İyi geceler' }), Icon: Moon }
    if (hour < 12) return { text: t('greetingMorning', { defaultValue: 'Günaydın' }), Icon: Sunrise }
    if (hour < 18) return { text: t('greetingAfternoon', { defaultValue: 'İyi günler' }), Icon: Sun }
    if (hour < 22) return { text: t('greetingEvening', { defaultValue: 'İyi akşamlar' }), Icon: Sunset }
    return { text: t('greetingNight', { defaultValue: 'İyi geceler' }), Icon: Moon }
  }, [t])

  // Load daily question + check if answered
  useEffect(() => {
    let cancelled = false
    dailyQuestionService.getTodaysQuestion().then(async (q) => {
      if (cancelled) return
      setDailyQuestion(q)
      if (userId && q.id) {
        const answered = await dailyQuestionService.hasAnsweredToday(userId, q.id)
        if (!cancelled) setHasAnsweredToday(answered)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [userId])

  // Load streak function - must be defined before useMemories hook
  // Accepts pre-loaded memories to avoid a duplicate DB/network call
  const loadStreak = useCallback(async (loadedMemories?: Memory[]) => {
    const streakData = await streakService.calculateStreak(userId, loadedMemories)
    setStreak(streakData)

    // Check for milestone (only show once per milestone)
    // Only check if streak has changed or is a new milestone
    if (streakData.currentStreak > 0) {
      const milestoneKey = `milestone_${streakData.currentStreak}_${userId}`
      const alreadyShown = localStorage.getItem(milestoneKey)
      
      // Only check milestone if it hasn't been shown before
      if (!alreadyShown) {
        const milestone = await streakService.checkStreakMilestone(userId, streakData.currentStreak, t)
        if (milestone) {
          localStorage.setItem(milestoneKey, 'true')
          showSuccess(milestone, { duration: 5000 })
        }
      }
    }

    // Streak koruma bildirimi ayarla (only if logged in)
    if (user && streakData.currentStreak > 0) {
      notificationService.scheduleStreakProtection(
        userId,
        streakData.lastMemoryDate,
        streakData.currentStreak
      )
    }
  }, [userId, user, t, showSuccess])

  // Use memories hook - loadStreak must be defined before this
  const { memories, loading, refreshMemories } = useMemories(userId, {
    onLoadComplete: async (loadedMemories) => {
      await loadStreak(loadedMemories)
    }
  })

  // Find memories with conflicts
  const conflictedMemory = memories.find((m) => m.conflict && m.conflictCloud)
  const [showConflictDialog, setShowConflictDialog] = useState(false)

  // Show conflict dialog when conflicts are detected
  useEffect(() => {
    if (conflictedMemory && !showConflictDialog) {
      setShowConflictDialog(true)
    }
  }, [conflictedMemory, showConflictDialog])

  const handleAddMemory = useCallback(() => {
    hapticFeedback('light')
    setEditingMemory(undefined)
    setDailyQuestionForForm(null)
    if (isNative()) {
      navigate('/add-memory')
      return
    }
    setShowForm(true)
  }, [hapticFeedback, navigate])

  const handleDailyQuestionClick = useCallback(() => {
    hapticFeedback('light')
    setEditingMemory(undefined)
    setDailyQuestionForForm(dailyQuestion)
    if (isNative()) {
      navigate('/add-memory', { state: { dailyQuestion } })
      return
    }
    setShowForm(true)
  }, [hapticFeedback, navigate, dailyQuestion])

  // Setup notifications function
  const setupNotifications = useCallback(async () => {
    if (!user) return
    await notificationService.requestPermission()
    if (user.dailyReminderTime) {
      notificationService.scheduleDailyReminder(user.dailyReminderTime, userId, streak.currentStreak)
    }
  }, [user, userId, streak.currentStreak])

  useEffect(() => {
    if (user) {
      setupNotifications()
    }
  }, [user, userId, setupNotifications])

  // Smart memory selection - prioritizes high intensity and core memories
  const selectRandomMemory = useCallback((memories: Memory[], skipBreathing: boolean = false): Memory | null => {
    if (memories.length === 0) return null

    // Filter out last shown memory if there are other options
    const availableMemories = memories.length > 1 && lastShownMemoryId
      ? memories.filter(m => m.id !== lastShownMemoryId)
      : memories

    // Prioritize: Core memories > High intensity (8+) > Recent memories > Others
    const coreMemories = availableMemories.filter(m => m.isCore)
    const highIntensityMemories = availableMemories.filter(m => m.intensity >= 8)
    const recentMemories = availableMemories.filter(m => {
      const memoryDate = new Date(m.date)
      const daysSince = (Date.now() - memoryDate.getTime()) / (1000 * 60 * 60 * 24)
      return daysSince <= 30 // Last 30 days
    })

    // Weighted selection: 40% core, 30% high intensity, 20% recent, 10% random
    let selectedMemory: Memory | null = null
    const rand = Math.random()

    if (coreMemories.length > 0 && rand < 0.4) {
      selectedMemory = coreMemories[Math.floor(Math.random() * coreMemories.length)]
    } else if (highIntensityMemories.length > 0 && rand < 0.7) {
      selectedMemory = highIntensityMemories[Math.floor(Math.random() * highIntensityMemories.length)]
    } else if (recentMemories.length > 0 && rand < 0.9) {
      selectedMemory = recentMemories[Math.floor(Math.random() * recentMemories.length)]
    } else {
      selectedMemory = availableMemories[Math.floor(Math.random() * availableMemories.length)]
    }

    return selectedMemory
  }, [lastShownMemoryId])

  const handleNeedSupport = useCallback(async (skipBreathing: boolean = false) => {
    if (memories.length === 0) {
      showError(t('noMemories'))
      return
    }

    hapticFeedback('medium')
    setIsBreathing(true)
    setRandomMemory(null)

    if (!skipBreathing) {
      const durationMs = prefersReducedMotion ? 600 : 2200
      await new Promise<void>((resolve) => {
        let resolved = false
        const breathTimer = window.setTimeout(() => {
          if (resolved) return
          resolved = true
          resolve()
        }, durationMs)
        skipBreathingRef.current = () => {
          if (resolved) return
          resolved = true
          window.clearTimeout(breathTimer)
          resolve()
        }
      })
    }

    const selectedMemory = selectRandomMemory(memories, skipBreathing)
    if (selectedMemory) {
      setRandomMemory(selectedMemory)
      setLastShownMemoryId(selectedMemory.id)
    }
    setIsBreathing(false)
    hapticFeedback('success')
    showSuccess(t('foundBeautifulMemory'))
    skipBreathingRef.current = null
  }, [memories, showError, showSuccess, hapticFeedback, t, prefersReducedMotion, selectRandomMemory])

  // Daily question display text
  const dailyQuestionText = useMemo(() => {
    if (!dailyQuestion) return t('dailyPromptsDefault', { defaultValue: 'Bugün neye şükrettin?' })
    return dailyQuestionService.getLocalizedQuestion(dailyQuestion)
  }, [dailyQuestion, t])

  // Compute streak status message
  const streakStatusMessage = useMemo(() => {
    if (streak.currentStreak === 0 || !streak.lastMemoryDate) return null
    const lastDate = new Date(streak.lastMemoryDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    lastDate.setHours(0, 0, 0, 0)
    const daysSince = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSince === 0) {
      return (
        <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-semibold">
          {t('protectedToday')}
        </p>
      )
    } else if (daysSince === 1 && streak.currentStreak > 0) {
      return (
        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-semibold animate-pulse">
          {t('addMemoryToday')}
        </p>
      )
    }
    return null
  }, [streak.currentStreak, streak.lastMemoryDate, t])

  // "X Ay Önce Bugün" memories
  const memoriesOnThisDay = useMemo(() => {
    if (memories.length === 0) return []
    const today = new Date()
    const todayMonth = today.getMonth()
    const todayDay = today.getDate()

    return memories.filter(memory => {
      const memoryDate = new Date(memory.date)
      return memoryDate.getMonth() === todayMonth && memoryDate.getDate() === todayDay && memoryDate.getFullYear() !== today.getFullYear()
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [memories])

  const getTimeAgoText = useCallback((date: Date): string => {
    const today = new Date()
    const yearsDiff = today.getFullYear() - date.getFullYear()
    const monthsDiff = (today.getMonth() - date.getMonth()) + (yearsDiff * 12)

    if (yearsDiff > 0) {
      return yearsDiff === 1 
        ? t('oneYearAgo', { defaultValue: '1 yıl önce' })
        : t('yearsAgo', { count: yearsDiff, defaultValue: `${yearsDiff} yıl önce` })
    } else if (monthsDiff > 0) {
      return monthsDiff === 1
        ? t('oneMonthAgo', { defaultValue: '1 ay önce' })
        : t('monthsAgo', { count: monthsDiff, defaultValue: `${monthsDiff} ay önce` })
    }
    return t('thisYear', { defaultValue: 'Bu yıl' })
  }, [t])

  if (!hasCompletedOnboarding && !loading) {
    return <Onboarding onComplete={() => setHasCompletedOnboarding(true)} />
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8 py-8 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 sm:mb-10"
      >
        {/* Time-based greeting */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <greeting.Icon size={18} className="text-primary" />
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            {greeting.text}{user?.displayName ? `, ${user.displayName}` : ''}
          </p>
        </div>
        <h1 className="text-display bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent mb-2 sm:mb-3 tracking-tight">
          {t('appName')}
        </h1>
        <p className="text-body text-gray-700 dark:text-gray-300 font-medium">{t('tagline')}</p>
      </motion.div>

      {/* Daily Prompt */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onClick={handleDailyQuestionClick}
        whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
        className="gradient-primary text-white p-6 sm:p-8 rounded-3xl mb-6 sm:mb-7 cursor-pointer shadow-card-elevated hover:shadow-primary-glow transition-all duration-300 group relative overflow-hidden touch-manipulation"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <motion.div
          animate={prefersReducedMotion ? undefined : { rotate: [0, 8, -8, 0] }}
          transition={prefersReducedMotion ? undefined : { duration: 3, repeat: Infinity, repeatDelay: 2 }}
          className="absolute top-4 right-4 opacity-25"
        >
          <Sparkles className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2} />
        </motion.div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5" strokeWidth={2} />
              <p className="text-base sm:text-lg font-bold tracking-tight">{t('dailyPrompt')}</p>
            </div>
            {hasAnsweredToday && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1"
              >
                <CheckCircle size={13} />
                <span className="text-[11px] font-semibold">{t('answered', { defaultValue: 'Cevaplandı' })}</span>
              </motion.div>
            )}
          </div>
          <p className="text-white text-base sm:text-lg leading-relaxed line-clamp-3 mb-4 font-medium">{dailyQuestionText}</p>
          <div className="flex items-center gap-2 text-white/95 text-sm font-semibold">
            {hasAnsweredToday ? (
              <>
                <Plus size={16} strokeWidth={2} />
                <span>{t('answerAgain', { defaultValue: 'Tekrar cevapla veya yeni anı ekle' })}</span>
              </>
            ) : (
              <>
                <Plus size={16} strokeWidth={2} />
                <span>{t('tapToAddMemory')}</span>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Need Support Button - Enhanced */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full mb-6 sm:mb-7"
      >
        <motion.button
          onClick={() => handleNeedSupport(false)}
          disabled={isBreathing || memories.length === 0}
          whileHover={!prefersReducedMotion && !isBreathing && memories.length > 0 ? { scale: 1.01 } : {}}
          whileTap={!prefersReducedMotion && !isBreathing && memories.length > 0 ? { scale: 0.99 } : {}}
          className="w-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary/20 dark:via-primary/10 dark:to-transparent border-2 border-primary/30 dark:border-primary/40 p-6 sm:p-8 rounded-3xl hover:border-primary/50 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
        >
          {!isBreathing && memories.length > 0 && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              initial={false}
            />
          )}
          <div className="relative z-10 flex items-center gap-4 sm:gap-5">
            <motion.div
              animate={
                prefersReducedMotion
                  ? undefined
                  : isBreathing
                    ? { scale: [1, 1.12, 1], rotate: [0, 5, -5, 0] }
                    : { scale: [1, 1.05, 1] }
              }
              transition={prefersReducedMotion ? undefined : { duration: 2, repeat: isBreathing ? Infinity : 3, repeatDelay: 1 }}
              className="flex-shrink-0"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg">
                <Heart className="text-white fill-white" size={36} strokeWidth={2} />
              </div>
            </motion.div>
            <div className="flex-1 text-left">
              <h2 className="font-bold text-xl sm:text-2xl mb-1.5 text-gray-900 dark:text-gray-100">{t('needSupport')}</h2>
              {memories.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-300">{t('addFirstMemory')}</p>
              ) : (
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 font-medium">{t('tapToGetRandomMemory')}</p>
              )}
            </div>
            {memories.length > 0 && !isBreathing && (
              <motion.div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  hapticFeedback('light')
                  handleNeedSupport(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    hapticFeedback('light')
                    handleNeedSupport(true)
                  }
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/20 hover:bg-primary/30 dark:bg-primary/30 dark:hover:bg-primary/40 flex items-center justify-center transition-colors touch-manipulation cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label={t('showMemoryNow', { defaultValue: 'Şimdi göster' })}
              >
                <RefreshCw size={18} className="text-primary" strokeWidth={2.5} />
              </motion.div>
            )}
          </div>
          <AnimatePresence>
            {isBreathing && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 relative z-10"
              >
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="flex items-center justify-center gap-2 text-lg">
                    <LoadingSpinner size="sm" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{t('breathing')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      hapticFeedback('light')
                      skipBreathingRef.current?.()
                    }}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 text-sm font-semibold transition-colors touch-manipulation"
                  >
                    {t('skip', { defaultValue: 'Atla' })}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* Random Memory Display - Enhanced */}
      <AnimatePresence>
        {randomMemory && !isBreathing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-white dark:bg-gray-800 border-2 border-primary/30 dark:border-primary/40 rounded-3xl p-6 sm:p-8 mb-6 shadow-2xl relative overflow-hidden"
          >
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Heart className="text-primary" size={20} fill="currentColor" />
                  <h3 className="text-xl sm:text-2xl font-bold text-gradient">{t('randomMemory')}</h3>
                </div>
                <button
                  onClick={() => {
                    hapticFeedback('light')
                    setRandomMemory(null)
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors touch-manipulation"
                  aria-label={t('close')}
                >
                  <X size={16} className="text-gray-600 dark:text-gray-300" />
                </button>
              </div>

              {/* Photos */}
              {randomMemory.photos.length > 0 && (
                <div className="mb-5 rounded-2xl overflow-hidden">
                  <img
                    src={randomMemory.photos[0]}
                    alt={t('memory')}
                    className="w-full h-48 sm:h-64 object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget
                      target.style.display = 'none'
                    }}
                  />
                </div>
              )}

              <p className="text-gray-800 dark:text-gray-200 mb-6 sm:mb-8 text-base sm:text-lg leading-relaxed readable-text mx-auto font-medium">
                {randomMemory.text}
              </p>

              {/* Tags and metadata */}
              <div className="flex flex-wrap gap-2 mb-5">
                {randomMemory.isCore && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-full text-xs font-bold shadow-sm">
                    ⭐ {t('coreMemory')}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light rounded-full text-xs font-semibold">
                  <Flame size={12} />
                  {randomMemory.intensity}/10
                </span>
                {randomMemory.category !== 'uncategorized' && (
                  <span className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                    {t(`categories.${randomMemory.category}`)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                  {new Date(randomMemory.date).toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      hapticFeedback('light')
                      handleNeedSupport(true)
                    }}
                    className="px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 text-primary dark:text-primary-light text-sm font-semibold transition-colors touch-manipulation flex items-center gap-2"
                  >
                    <RefreshCw size={14} />
                    {t('showAnotherMemory', { defaultValue: 'Başka bir anı' })}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      hapticFeedback('success')
                      showSuccess(t('thankYouForReminding', { defaultValue: 'Bu anıyı hatırlattığın için teşekkürler! 💝' }), { duration: 3000 })
                    }}
                    className="px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all touch-manipulation"
                  >
                    {t('thankYou', { defaultValue: 'Teşekkürler' })}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Relationship Saver - Moved up for better visibility */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        onClick={() => {
          hapticFeedback('light')
          navigate('/relationship-saver')
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border-2 border-pink-200 dark:border-pink-800 rounded-2xl p-6 sm:p-7 mb-6 shadow-lg hover:shadow-xl hover:border-pink-300 dark:hover:border-pink-700 transition-all duration-300 touch-manipulation text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center flex-shrink-0 shadow-lg">
            <Heart className="text-white" size={28} strokeWidth={2} fill="white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-gray-100 mb-1">{t('relationshipSaver')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('onboardingRelationship')}</p>
          </div>
          <motion.div
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
            className="text-pink-500 dark:text-pink-400"
          >
            <ArrowRight size={20} />
          </motion.div>
        </div>
      </motion.button>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-6 mb-6"
      >
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 shadow-card hover:shadow-card-elevated hover:border-primary/40 transition-all duration-300 touch-manipulation"
        >
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-300 mb-1.5 font-semibold uppercase tracking-wider">{t('totalMemories')}</p>
          <div className="flex items-end gap-2">
            <motion.p
              key={memories.length}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight"
            >
              {memories.length}
            </motion.p>
            {memories.length > 0 && (
              <span className="text-xs text-gray-400 mb-1 font-medium">{t('memories', { defaultValue: 'anı' })}</span>
            )}
          </div>
        </motion.div>
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 shadow-card hover:shadow-card-elevated hover:border-primary/40 transition-all duration-300 touch-manipulation"
        >
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-300 mb-1.5 font-semibold uppercase tracking-wider">{t('coreMemories')}</p>
          <div className="flex items-end gap-2">
            <motion.p
              key={memories.filter(m => m.isCore).length}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight"
            >
              {memories.filter(m => m.isCore).length}
            </motion.p>
            <span className="text-yellow-500 mb-1">⭐</span>
          </div>
        </motion.div>
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
          onClick={() => {
            if (streak.currentStreak > 0) {
              hapticFeedback('light')
              const messages = [
                t('streakContinuesMessages.message1', { count: streak.currentStreak }),
                t('streakContinuesMessages.message2', { count: streak.currentStreak }),
                t('streakContinuesMessages.message3', { count: streak.currentStreak }),
              ]
              showSuccess(messages[Math.floor(Math.random() * messages.length)], { duration: 3000 })
            }
          }}
          className={`bg-gradient-to-br from-primary/10 via-primary/5 to-primary-dark/10 border-2 ${
            streak.currentStreak > 0
              ? 'border-primary/50 dark:border-primary/40 cursor-pointer shadow-lg shadow-primary/10'
              : 'border-primary/30 dark:border-primary/20'
          } rounded-2xl p-5 sm:p-6 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 relative overflow-hidden touch-manipulation col-span-2 sm:col-span-1`}
        >
          {streak.currentStreak > 0 && (
            <>
              <motion.div
                animate={
                  prefersReducedMotion
                    ? undefined
                    : { scale: [1, 1.08, 1], opacity: [0.2, 0.35, 0.2] }
                }
                transition={prefersReducedMotion ? undefined : { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 bg-primary/20 rounded-2xl"
              />
              <motion.div
                animate={
                  prefersReducedMotion
                    ? undefined
                    : { 
                        scale: [1, 1.15, 1],
                        opacity: [0.1, 0.25, 0.1],
                        rotate: [0, 5, -5, 0]
                      }
                }
                transition={prefersReducedMotion ? undefined : { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-400/20 rounded-2xl"
              />
            </>
          )}
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : streak.currentStreak > 0
                        ? { rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }
                        : {}
                  }
                  transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity, repeatDelay: 1 }}
                >
                  <Flame className="text-primary" size={20} strokeWidth={2.5} fill={streak.currentStreak > 0 ? 'currentColor' : 'none'} />
                </motion.div>
                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider">
                  {t('streak')}
                </p>
              </div>
              {streak.currentStreak > 0 && streak.longestStreak > streak.currentStreak && (
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                    {t('record', { defaultValue: 'Rekor' })}
                  </p>
                  <p className="text-xs font-bold text-primary">
                    {streak.longestStreak}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <motion.p
                key={streak.currentStreak}
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="text-4xl sm:text-5xl font-black text-primary tracking-tight"
              >
                {streak.currentStreak}
              </motion.p>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-semibold">
                {t('days', { count: streak.currentStreak })}
              </span>
            </div>
            {streak.currentStreak > 0 && (
              <>
                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-1.5 font-semibold">
                  {streakService.getStreakReward(streak.currentStreak, t)}
                </p>
                {streak.longestStreak > streak.currentStreak && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-300 mt-1">
                    {t('keepGoingToBreakRecord', { 
                      count: streak.longestStreak - streak.currentStreak,
                      longest: streak.longestStreak,
                      defaultValue: `${streak.longestStreak - streak.currentStreak} gün daha devam et, ${streak.longestStreak} günlük rekorunu kır!` 
                    })}
                  </p>
                )}
                {streakStatusMessage}
              </>
            )}
            {streak.currentStreak === 0 && memories.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1 font-medium">{t('startStreak')}</p>
            )}
            {streak.currentStreak === 0 && memories.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">{t('addFirstMemoryToStartStreak', { defaultValue: 'İlk anını ekle, seriyi başlat!' })}</p>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* "X Ay Önce Bugün" Card */}
      {memoriesOnThisDay.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-3xl p-6 sm:p-8 mb-6 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-500/20 dark:bg-blue-400/20 flex items-center justify-center flex-shrink-0">
              <Calendar className="text-blue-600 dark:text-blue-400" size={24} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-gray-100 mb-1">
                {getTimeAgoText(new Date(memoriesOnThisDay[0].date))} {t('onThisDay', { defaultValue: 'bugün' })}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t('memoriesOnThisDay', { count: memoriesOnThisDay.length, defaultValue: `${memoriesOnThisDay.length} anı` })}
              </p>
            </div>
          </div>
          <div className="space-y-3 mb-4">
            {memoriesOnThisDay.slice(0, 2).map((memory) => (
              <div
                key={memory.id}
                className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 border border-blue-100 dark:border-blue-900/40"
              >
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-2">
                  {memory.text}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{new Date(memory.date).getFullYear()}</span>
                  {memory.isCore && <span className="text-yellow-500">⭐</span>}
                  <span className="ml-auto">{memory.intensity}/10</span>
                </div>
              </div>
            ))}
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              hapticFeedback('light')
              navigate('/vault', { 
                state: { 
                  filterDate: new Date().toISOString().split('T')[0],
                  filterMonth: new Date().getMonth(),
                  filterDay: new Date().getDate()
                } 
              })
            }}
            className="w-full px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold transition-colors touch-manipulation flex items-center justify-center gap-2"
          >
            <span>{t('viewAllMemories', { defaultValue: 'Tüm anıları gör' })}</span>
            <ArrowRight size={16} />
          </motion.button>
        </motion.div>
      )}


      {/* FAB Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={prefersReducedMotion ? {} : { scale: 1.08 }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
        onClick={handleAddMemory}
        style={{ bottom: fabBottom }}
        className="fixed right-5 sm:right-6 z-50 w-14 h-14 sm:w-16 sm:h-16 min-w-[56px] min-h-[56px] rounded-full bg-primary shadow-lg hover:shadow-xl hover:shadow-primary/40 dark:shadow-primary/20 transition-all duration-200 touch-manipulation flex items-center justify-center group"
        aria-label={t('addMemoryAriaLabel')}
        title={t('addMemory')}
      >
        {!prefersReducedMotion && (
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 bg-white/30 rounded-full"
          />
        )}
        <Plus size={28} className="relative z-10 text-white" strokeWidth={2.5} />
      </motion.button>

      {/* Memory Form */}
      {showForm && (
        <MemoryForm
          memory={editingMemory}
          dailyQuestion={dailyQuestionForForm}
          onClose={() => {
            setShowForm(false)
            setEditingMemory(undefined)
            setDailyQuestionForForm(null)
          }}
          onSave={async () => {
            try {
              await refreshMemories()
              await loadStreak()
              // Refresh daily question answered state
              if (dailyQuestion?.id) {
                dailyQuestionService.hasAnsweredToday(userId, dailyQuestion.id).then(setHasAnsweredToday).catch(() => {})
              }
            } catch (error) {
              if (import.meta.env.DEV) {
                console.error('Error loading memories after save:', error)
              }
            }
          }}
          userId={userId}
        />
      )}

      {/* Conflict Resolution Dialog */}
      {showConflictDialog && conflictedMemory && (
        <ConflictResolutionDialog
          memory={conflictedMemory}
          onResolved={async () => {
            setShowConflictDialog(false)
            await refreshMemories()
          }}
          onClose={() => setShowConflictDialog(false)}
        />
      )}
    </div>
  )
}
