import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Heart, Plus, Sparkles, Flame } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useStore } from '../store/useStore'
import { Memory } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import { streakService } from '../services/streakService'
import { notificationService } from '../services/notificationService'
import Onboarding from '../components/Onboarding'
import MemoryForm from '../components/MemoryForm'
import QuickMemoryForm from '../components/QuickMemoryForm'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import { useNotifications } from '../hooks/useNotifications'
import { isNative } from '../utils/capacitor'

export default function Home() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, hasCompletedOnboarding, setHasCompletedOnboarding } = useStore()
  const userId = useUserId()
  const { showSuccess, showError, hapticFeedback } = useNotifications()
  const prefersReducedMotion = useReducedMotion()
  const locale = (i18n?.language || 'tr').startsWith('tr') ? 'tr-TR' : 'en-US'
  const [isBreathing, setIsBreathing] = useState(false)
  const [randomMemory, setRandomMemory] = useState<Memory | null>(null)
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0, lastMemoryDate: null as string | null, streakStartDate: null as string | null })
  const [showForm, setShowForm] = useState(false)
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [editingMemory, setEditingMemory] = useState<Memory | undefined>()
  const [draft, setDraft] = useState<{ text: string; category: Memory['category'] } | null>(null)
  const [fabBottom, setFabBottom] = useState('calc(88px + env(safe-area-inset-bottom, 0px))')
  const skipBreathingRef = useRef<null | (() => void)>(null)

  // Load streak function - must be defined before useMemories hook
  const loadStreak = useCallback(async () => {
    const streakData = await streakService.calculateStreak(userId)
    setStreak(streakData)
    
    // Check for milestone
    if (streakData.currentStreak > 0) {
      const milestone = await streakService.checkStreakMilestone(userId, streakData.currentStreak, t)
      if (milestone) {
        showSuccess(milestone, { duration: 5000 })
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
      // Load streak after memories are loaded
      await loadStreak()
    }
  })

  const showAddDetailsToast = useCallback((memory: Memory) => {
    toast.custom((tToast) => (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-4 max-w-sm w-full">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-bold text-gray-900 dark:text-gray-100">{t('memorySaved')}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('addDetailsPrompt')}</p>
          </div>
          <button
            onClick={() => toast.dismiss(tToast.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => {
              toast.dismiss(tToast.id)
              setEditingMemory(memory)
              setDraft(null)
              setShowForm(true)
            }}
            className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold transition-colors touch-manipulation"
          >
            {t('addDetails')}
          </button>
          <button
            onClick={() => toast.dismiss(tToast.id)}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
          >
            {t('done')}
          </button>
        </div>
      </div>
    ), { duration: 5000 })
  }, [t])
  const handleAddMemory = useCallback(() => {
    hapticFeedback('light')
    setEditingMemory(undefined)
    setDraft(null)
    if (isNative()) {
      navigate('/add-memory')
      return
    }
    setShowQuickForm(true)
  }, [hapticFeedback, navigate])

  // Setup notifications function - must be defined before useEffect that uses it
  const setupNotifications = useCallback(async () => {
    if (!user) return
    
    // Request notification permission
    await notificationService.requestPermission()
    
    // Setup daily reminder if set
    if (user.dailyReminderTime) {
      notificationService.scheduleDailyReminder(user.dailyReminderTime, userId)
    }
  }, [user, userId])

  // Dynamic FAB positioning based on bottom nav height
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null
    
    const updateFabPosition = () => {
      // Debounce to avoid excessive updates
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      
      debounceTimer = setTimeout(() => {
        const navBar = document.querySelector('nav[class*="fixed bottom-0"]')
        if (navBar) {
          const navHeight = navBar.getBoundingClientRect().height
          // Add more space: 1.5rem instead of 1rem for better visual separation
          setFabBottom(`calc(${navHeight}px + env(safe-area-inset-bottom, 0px) + 1.5rem)`)
        } else {
          // Fallback with more space
          setFabBottom('calc(88px + env(safe-area-inset-bottom, 0px) + 1.5rem)')
        }
      }, 100) // Debounce by 100ms
    }
    
    // Initial update
    const timer = setTimeout(updateFabPosition, 100)
    updateFabPosition()
    
    window.addEventListener('resize', updateFabPosition)
    window.addEventListener('load', updateFabPosition)
    
    // Only observe the navigation bar element, not the entire body
    const navBar = document.querySelector('nav[class*="fixed bottom-0"]')
    if (navBar) {
      const observer = new MutationObserver(updateFabPosition)
      // Only observe attributes and child list of the nav bar
      observer.observe(navBar, { 
        attributes: true, 
        attributeFilter: ['class', 'style'],
        childList: true,
        subtree: false // Don't observe deep children
      })
      
      return () => {
        clearTimeout(timer)
        if (debounceTimer) clearTimeout(debounceTimer)
        window.removeEventListener('resize', updateFabPosition)
        window.removeEventListener('load', updateFabPosition)
        observer.disconnect()
      }
    }
    
    return () => {
      clearTimeout(timer)
      if (debounceTimer) clearTimeout(debounceTimer)
      window.removeEventListener('resize', updateFabPosition)
      window.removeEventListener('load', updateFabPosition)
    }
  }, [])

  useEffect(() => {
    if (user) {
      setupNotifications()
    }
  }, [user, userId, setupNotifications])


  const handleNeedSupport = useCallback(async () => {
    if (memories.length === 0) {
      showError(t('noMemories'))
      return
    }

    hapticFeedback('medium')
    setIsBreathing(true)
    setRandomMemory(null)
    
    // Breathing animation
    const durationMs = prefersReducedMotion ? 600 : 2200
    await new Promise<void>((resolve) => {
      let resolved = false
      const timer = window.setTimeout(() => {
        if (resolved) return
        resolved = true
        resolve()
      }, durationMs)
      skipBreathingRef.current = () => {
        if (resolved) return
        resolved = true
        window.clearTimeout(timer)
        resolve()
      }
    })
    
    // Get random memory
    const random = memories[Math.floor(Math.random() * memories.length)]
    setRandomMemory(random)
    setIsBreathing(false)
    hapticFeedback('success')
    showSuccess(t('foundBeautifulMemory'))
    skipBreathingRef.current = null
  }, [memories, showError, showSuccess, hapticFeedback, t, prefersReducedMotion])

  const getDailyPrompt = useCallback(() => {
    const prompts = t('dailyPrompts', { returnObjects: true }) as string[]
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return t('dailyPromptsDefault', { defaultValue: 'Bugün neye şükrettin?' })
    }
    // Günün tarihine göre deterministik seçim (her gün aynı prompt)
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
    return prompts[dayOfYear % prompts.length]
  }, [t])

  // Compute streak status message - must be defined before conditional returns
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

  // Removed: if (!user) return null - user is now optional for offline usage

  if (!hasCompletedOnboarding && !loading) {
    return (
      <Onboarding onComplete={() => setHasCompletedOnboarding(true)} />
    )
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
    <div 
      className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8 py-8 sm:py-10"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 sm:mb-10"
      >
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
        onClick={() => {
          hapticFeedback('light')
          navigate('/vault?action=add')
        }}
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
          <div className="flex items-center gap-2.5 mb-3">
            <Sparkles className="w-5 h-5" strokeWidth={2} />
            <p className="text-base sm:text-lg font-bold tracking-tight">{t('dailyPrompt')}</p>
          </div>
          <p className="text-white text-base sm:text-lg leading-relaxed line-clamp-3 mb-4 font-medium">{getDailyPrompt()}</p>
          <div className="flex items-center gap-2 text-white/95 text-sm font-semibold">
            <Plus size={16} strokeWidth={2} />
            <span>{t('tapToAddMemory')}</span>
          </div>
        </div>
      </motion.div>

      {/* Need Support Button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onClick={handleNeedSupport}
        disabled={isBreathing || memories.length === 0}
        whileHover={!prefersReducedMotion && !isBreathing && memories.length > 0 ? { scale: 1.01 } : {}}
        whileTap={!prefersReducedMotion && !isBreathing && memories.length > 0 ? { scale: 0.99 } : {}}
        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 sm:p-7 rounded-2xl mb-6 sm:mb-7 hover:border-primary/40 shadow-card hover:shadow-card-elevated transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
      >
        {!isBreathing && memories.length > 0 && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
            initial={false}
          />
        )}
        <div className="relative z-10 flex items-center gap-4">
          <motion.div
            animate={
              prefersReducedMotion
                ? undefined
                : isBreathing
                  ? { scale: [1, 1.08, 1], rotate: [0, 4, -4, 0] }
                  : {}
            }
            transition={prefersReducedMotion ? undefined : { duration: 2, repeat: isBreathing ? Infinity : 0 }}
            className="flex-shrink-0"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
              <Heart className="text-primary group-hover:fill-primary transition-all" size={32} strokeWidth={2} />
            </div>
          </motion.div>
          <div className="flex-1 text-left">
            <h2 className="font-bold text-lg sm:text-xl mb-1 text-gray-900 dark:text-gray-100">{t('needSupport')}</h2>
            {memories.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('addFirstMemory')}
              </p>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('tapToGetRandomMemory')}
              </p>
            )}
          </div>
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
                  <span className="text-gray-700 dark:text-gray-300">{t('breathing')}</span>
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

      {/* Random Memory Display */}
      <AnimatePresence>
        {randomMemory && !isBreathing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-gray-800 border-2 border-primary/20 dark:border-primary/30 rounded-3xl p-6 sm:p-8 mb-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gradient">{t('randomMemory')}</h3>
              <button
                onClick={() => setRandomMemory(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6 sm:mb-8 text-base sm:text-lg leading-relaxed readable-text mx-auto">{randomMemory.text}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{new Date(randomMemory.date).toLocaleDateString(locale, { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
              <span className="px-4 py-2 bg-primary/10 text-primary rounded-full font-semibold">
                {randomMemory.intensity}/10
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-6 mb-6"
      >
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 shadow-card hover:shadow-card-elevated hover:border-primary/40 transition-all duration-300 touch-manipulation">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2 font-semibold uppercase tracking-wide">{t('totalMemories')}</p>
          <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{memories.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 shadow-card hover:shadow-card-elevated hover:border-primary/40 transition-all duration-300 touch-manipulation">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2 font-semibold uppercase tracking-wide">{t('coreMemories')}</p>
          <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            {memories.filter(m => m.isCore).length}
          </p>
        </div>
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
          className={`bg-gradient-to-br from-primary/10 to-primary-dark/10 border-2 ${
            streak.currentStreak > 0 
              ? 'border-primary/50 dark:border-primary/40 cursor-pointer' 
              : 'border-primary/30 dark:border-primary/20'
          } rounded-2xl p-5 sm:p-6 hover:shadow-lg transition-all duration-300 relative overflow-hidden touch-manipulation col-span-2 sm:col-span-1`}
        >
          {streak.currentStreak > 0 && (
            <motion.div
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      scale: [1, 1.06, 1],
                      opacity: [0.25, 0.4, 0.25],
                    }
              }
              transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 bg-primary/20 rounded-2xl"
            />
          )}
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <motion.div
                animate={
                  prefersReducedMotion
                    ? undefined
                    : streak.currentStreak > 0
                      ? { rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }
                      : {}
                }
                transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity, repeatDelay: 1 }}
              >
                <Flame className="text-primary" size={18} strokeWidth={2} />
              </motion.div>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-semibold uppercase tracking-wide">
                {t('streak')}
              </p>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-primary tracking-tight">
              {streak.currentStreak}
            </p>
            {streak.currentStreak > 0 && (
              <>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
                  {streakService.getStreakReward(streak.currentStreak, t)}
                </p>
                {streakStatusMessage}
              </>
            )}
            {streak.currentStreak === 0 && memories.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('startStreak')}
              </p>
            )}
            {streak.longestStreak > streak.currentStreak && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {t('longestStreak')}: {t('days', { count: streak.longestStreak })}
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Relationship Saver */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={() => {
          hapticFeedback('light')
          navigate('/relationship-saver')
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 sm:p-7 mb-6 shadow-card hover:shadow-card-elevated hover:border-primary/40 transition-all duration-300 touch-manipulation text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Heart className="text-primary" size={28} strokeWidth={2} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-gray-100 mb-1">{t('relationshipSaver')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('onboardingRelationship')}</p>
          </div>
        </div>
      </motion.button>

      {/* FAB Button - Opens MemoryForm */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={prefersReducedMotion ? {} : { scale: 1.08 }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
        onClick={handleAddMemory}
        style={{
          bottom: fabBottom
        }}
        className="fixed right-5 sm:right-6 z-50 w-14 h-14 sm:w-16 sm:h-16 min-w-[56px] min-h-[56px] rounded-full bg-primary shadow-lg hover:shadow-xl hover:shadow-primary/40 dark:shadow-primary/20 transition-all duration-200 touch-manipulation flex items-center justify-center group"
        aria-label={t('addMemoryAriaLabel')}
        title={t('addMemory')}
      >
        {/* Subtle pulse animation */}
        {!prefersReducedMotion && (
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 bg-white/30 rounded-full"
          />
        )}
        
        {/* Plus icon */}
        <Plus 
          size={28}
          className="relative z-10 text-white"
          strokeWidth={2.5}
        />
      </motion.button>

      {showForm && (
        <MemoryForm
          memory={editingMemory}
          initialValues={
            !editingMemory && draft
              ? {
                  text: draft.text,
                  category: draft.category,
                  intensity: 7,
                  date: new Date().toISOString(),
                }
              : undefined
          }
          initialMode={!editingMemory && draft ? 'advanced' : undefined}
          hideModeToggle={!editingMemory && !!draft}
          onClose={() => setShowForm(false)}
          onSave={async (newMemory?: Memory) => {
            try {
              await refreshMemories()
              await loadStreak()
            } catch (error) {
              // Error is handled silently - memories will sync on next load
              if (import.meta.env.DEV) {
                console.error('Error loading memories after save:', error)
              }
            }
          }}
          userId={userId}
        />
      )}

      {showQuickForm && (
        <QuickMemoryForm
          userId={userId}
          onClose={() => setShowQuickForm(false)}
          onSave={async (newMemory) => {
            try {
              await refreshMemories()
              await loadStreak()
              showAddDetailsToast(newMemory)
            } catch {
              // no-op; refresh happens next load
            }
          }}
        />
      )}
    </div>
  )
}

