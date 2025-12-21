import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Download, Calendar, BarChart3, Trophy, User, Users, Palette, Globe, Bell, Database, Shield, Trash2, LogOut, Lock, ArrowLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { memoryService } from '../services/memoryService'
import { mapUserFromSupabase } from '../lib/userMapper'
import { notificationService } from '../services/notificationService'
import { exportService } from '../services/exportService'
import { hapticFeedback } from '../utils/haptic'
import { errorLoggingService } from '../services/errorLoggingService'
import { performanceService } from '../services/performanceService'
import ConfirmationDialog from '../components/ConfirmationDialog'
import Select from '../components/Select'
import TimePicker from '../components/TimePicker'
import { motion } from 'framer-motion'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useNotifications } from '../hooks/useNotifications'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = (searchParams.get('section') || '') as
    | ''
    | 'account'
    | 'appearance'
    | 'notifications'
    | 'data'
    | 'security'
    | 'about'
  const { user, setUser, setTheme, setLanguage, theme, language } = useStore()
  const { showLoading, showSuccess, showError } = useNotifications()
  const [dailyReminderTime, setDailyReminderTime] = useState(user?.dailyReminderTime || '')
  const [weeklySummaryDay, setWeeklySummaryDay] = useState(user?.weeklySummaryDay?.toString() || '')
  const { openConfirm, confirmDialogProps } = useConfirmDialog()
  const [syncStatus, setSyncStatus] = useState<null | {
    pending: number
    failed: number
    inProgress: number
    lastError: string | null
    conflicts: number
  }>(null)

  const [supabaseDiag, setSupabaseDiag] = useState<{
    running: boolean
    ok: boolean | null
    httpStatus?: number
    message?: string
    details?: string
    testedAt?: string
  }>({ running: false, ok: null })

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  const supabaseEnabled = isSupabaseConfigured()

  const goBackToList = () => {
    setSearchParams({})
  }

  const openSection = (section: Exclude<typeof activeSection, ''>) => {
    hapticFeedback('light')
    setSearchParams({ section })
  }

  const sectionTitle = (() => {
    switch (activeSection) {
      case 'account':
        return t('account')
      case 'appearance':
        return t('appearance', { defaultValue: t('theme') })
      case 'notifications':
        return t('notifications')
      case 'data':
        return t('dataManagement')
      case 'security':
        return t('security')
      default:
        return t('settings')
    }
  })()

  useEffect(() => {
    if (user) {
      setDailyReminderTime(user.dailyReminderTime || '')
      setWeeklySummaryDay(user.weeklySummaryDay?.toString() || '')
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    // Load sync status opportunistically (used in Data section)
    memoryService.getSyncStatus(user.id)
      .then(setSyncStatus)
      .catch(() => {
        // ignore
      })
  }, [user?.id])

  const handleTestSupabase = async () => {
    setSupabaseDiag({ running: true, ok: null })

    if (!supabaseEnabled) {
      setSupabaseDiag({
        running: false,
        ok: false,
        message: 'Supabase env eksik: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY',
        testedAt: new Date().toISOString(),
      })
      return
    }

    // 10s timeout to avoid hanging UI on network issues
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000)

    try {
      // 1) Raw HTTP reachability + API key validity (most direct signal)
      const healthUrl = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/health`
      const res = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        signal: controller.signal,
      })

      const bodyText = await res.text().catch(() => '')

      // 2) SDK-level check (some environments fail here)
      let sessionErrMsg = ''
      try {
        const sessionRes = await supabase.auth.getSession()
        if ((sessionRes as any)?.error?.message) {
          sessionErrMsg = String((sessionRes as any).error.message)
        }
      } catch (e) {
        sessionErrMsg = e instanceof Error ? e.message : String(e)
      }

      const ok = res.ok
      setSupabaseDiag({
        running: false,
        ok,
        httpStatus: res.status,
        message: ok ? 'Supabase erişilebilir (health OK)' : `Supabase health hata: HTTP ${res.status}`,
        details: [
          bodyText ? `health body: ${bodyText.slice(0, 500)}` : '',
          sessionErrMsg ? `auth.getSession error: ${sessionErrMsg}` : '',
          `online: ${String(navigator.onLine)}`,
          `url: ${supabaseUrl}`,
        ].filter(Boolean).join('\n'),
        testedAt: new Date().toISOString(),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSupabaseDiag({
        running: false,
        ok: false,
        message: 'Supabase erişilemedi (fetch hatası)',
        details: [
          `error: ${msg}`,
          `online: ${String(navigator.onLine)}`,
          `url: ${supabaseUrl}`,
          // SW cache issues are common during preview; surface it explicitly.
          `serviceWorker: ${String(Boolean(navigator.serviceWorker?.controller))}`,
        ].join('\n'),
        testedAt: new Date().toISOString(),
      })
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  // System theme listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const storedTheme = localStorage.getItem('theme')
      if (!storedTheme || storedTheme === 'system') {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    
    const prefersDark = mediaQuery.matches
    const storedTheme = localStorage.getItem('theme')
    if (!storedTheme || storedTheme === 'system') {
      setTheme(prefersDark ? 'dark' : 'light')
    }
    
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [setTheme])

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    if (user) {
      const { error } = await supabase
        .from('users')
        .update({ theme: newTheme })
        .eq('id', user.id)
      
      if (!error) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        
        if (userData) {
          setUser(mapUserFromSupabase(userData))
        }
      }
    }
  }

  const handleLanguageChange = async (newLang: 'tr' | 'en') => {
    setLanguage(newLang)
    if (user) {
      const { error } = await supabase
        .from('users')
        .update({ language: newLang })
        .eq('id', user.id)
      
      if (!error) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        
        if (userData) {
          setUser(mapUserFromSupabase(userData))
        }
      }
    }
  }

  const handleSaveReminders = async () => {
    if (!user) return

    const updates: Partial<{ daily_reminder_time: string | null; weekly_summary_day: number | null }> = {}
    if (dailyReminderTime) {
      updates.daily_reminder_time = dailyReminderTime
      notificationService.cancelReminder(user.id)
      await notificationService.requestPermission()
      notificationService.scheduleDailyReminder(dailyReminderTime, user.id)
    }
    if (weeklySummaryDay) updates.weekly_summary_day = parseInt(weeklySummaryDay)

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)

    if (!error) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      
      if (data) {
        setUser(mapUserFromSupabase(data))
        toast.success(t('settingsSaved'))
      }
    } else {
      toast.error(t('settingsSaveError'))
    }
  }

  const handleEnableNotifications = async () => {
    const granted = await notificationService.requestPermission()
    if (granted) {
      toast.success(t('notificationsEnabled'))
    } else {
      toast.error(t('notificationPermissionDenied'))
    }
  }

  const handleSync = async () => {
    if (!user) {
      toast.error(t('loginRequiredForSync'))
      return
    }
    try {
      hapticFeedback('light')
      showLoading(t('syncing'), { id: 'sync' })
      await memoryService.syncAll(user.id)
      hapticFeedback('success')
      showSuccess(t('syncComplete'), { id: 'sync' })
      // Refresh sync stats
      try {
        const status = await memoryService.getSyncStatus(user.id)
        setSyncStatus(status)
      } catch {
        // ignore
      }
    } catch (error) {
      hapticFeedback('error')
      showError(t('syncError'), { id: 'sync' })
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Sync error'),
        'error',
        user?.id
      )
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      hapticFeedback('light')
      toast.success(t('loggedOut'))
    } catch (error) {
      hapticFeedback('error')
      toast.error(t('logoutError'))
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Logout error'),
        'error'
      )
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    
    try {
      hapticFeedback('error')
      
      const { error: memoriesError } = await supabase
        .from('memories')
        .delete()
        .eq('user_id', user.id)
      
      if (memoriesError) {
        errorLoggingService.logError(
          new Error(`Failed to delete memories: ${memoriesError.message}`),
          'error',
          user.id
        )
      }

      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id)
      
      if (userError) {
        errorLoggingService.logError(
          new Error(`Failed to delete user: ${userError.message}`),
          'error',
          user.id
        )
      }

      localStorage.clear()
      await supabase.auth.signOut()
      setUser(null)
      
      toast.success(t('accountDeletedSuccessfully'), { duration: 3000 })
      navigate('/login')
    } catch (error) {
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Account deletion error'),
        'error',
        user?.id
      )
      toast.error(t('accountDeletionFailed'))
    }
  }

  const handleExport = async (format: 'json' | 'pdf' | 'csv') => {
    if (!user) return
    try {
      showLoading(t('exporting'), { id: 'export' })
      const memories = await memoryService.getAll(user.id)
      const filename = `nicebase-export-${new Date().toISOString().split('T')[0]}`
      
      if (format === 'json') {
        await exportService.exportToJSON(memories, filename)
      } else if (format === 'pdf') {
        await exportService.exportToPDF(memories, filename)
      } else if (format === 'csv') {
        await exportService.exportToCSV(memories, filename)
      }
      
      hapticFeedback('success')
      showSuccess(t('exportedAs', { format: format.toUpperCase() }), { id: 'export' })
    } catch (error) {
      hapticFeedback('error')
      showError(t('exportError'), { id: 'export' })
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Export error'),
        'error',
        user?.id
      )
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        {activeSection !== '' && (
          <button
            type="button"
            onClick={goBackToList}
            className="touch-target flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800 transition-colors"
            aria-label={t('back')}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-title"
        >
          {sectionTitle}
        </motion.h1>
      </div>

      {activeSection === '' ? (
        <div className="space-y-4">
          {/* Settings list (mobile-first) */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => openSection('account')}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-primary/40 shadow-card transition-all touch-manipulation text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <User className="text-primary" size={22} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{t('account')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {user ? user.email : t('loginOptional')}
                  </p>
                </div>
                <ChevronRight className="text-gray-400 flex-shrink-0" size={20} />
              </div>
            </button>

            <button
              type="button"
              onClick={() => openSection('appearance')}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-primary/40 shadow-card transition-all touch-manipulation text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Palette className="text-primary" size={22} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{t('appearance', { defaultValue: t('theme') })}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {t('theme')}: {theme} • {t('language')}: {language.toUpperCase()}
                  </p>
                </div>
                <ChevronRight className="text-gray-400 flex-shrink-0" size={20} />
              </div>
            </button>

            <button
              type="button"
              onClick={() => openSection('notifications')}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-primary/40 shadow-card transition-all touch-manipulation text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bell className="text-primary" size={22} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{t('notifications')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {t('dailyReminderTime')}: {dailyReminderTime || t('select', { defaultValue: 'Seçin' })}
                  </p>
                </div>
                <ChevronRight className="text-gray-400 flex-shrink-0" size={20} />
              </div>
            </button>

            <button
              type="button"
              onClick={() => openSection('data')}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-primary/40 shadow-card transition-all touch-manipulation text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Database className="text-primary" size={22} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{t('dataManagement')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{t('sync')} • {t('export')}</p>
                </div>
                <ChevronRight className="text-gray-400 flex-shrink-0" size={20} />
              </div>
            </button>

            <button
              type="button"
              onClick={() => openSection('security')}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-primary/40 shadow-card transition-all touch-manipulation text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="text-primary" size={22} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{t('security')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{t('changePassword')} • {t('logout')}</p>
                </div>
                <ChevronRight className="text-gray-400 flex-shrink-0" size={20} />
              </div>
            </button>
          </div>

          {/* Shortcuts (not settings) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <button
              onClick={() => {
                hapticFeedback('light')
                navigate('/statistics')
              }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-primary/40 shadow-card hover:shadow-card-elevated transition-all duration-300 touch-manipulation text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <BarChart3 className="text-primary" size={24} strokeWidth={2} />
                </div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t('statistics')}</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('onboardingStatistics')}</p>
            </button>

            <button
              onClick={() => {
                hapticFeedback('light')
                navigate('/achievements')
              }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-primary/40 shadow-card hover:shadow-card-elevated transition-all duration-300 touch-manipulation text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <Trophy className="text-primary" size={24} strokeWidth={2} />
                </div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t('badgesAndAchievements')}</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('onboardingAchievements')}</p>
            </button>

            <button
              onClick={() => {
                hapticFeedback('light')
                navigate('/connections')
              }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-primary/40 shadow-card hover:shadow-card-elevated transition-all duration-300 touch-manipulation text-left sm:col-span-2"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <Users className="text-primary" size={24} strokeWidth={2} />
                </div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t('connections')}</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('onboardingRelationship')}</p>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Account Section */}
          {activeSection === 'account' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <User className="text-primary" size={24} strokeWidth={2} />
                <h2 className="text-xl font-semibold">{t('account')}</h2>
              </div>

              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{user.email}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('loggedIn')}</p>
                    </div>
                    <button
                      onClick={() => {
                        hapticFeedback('warning')
                        openConfirm({
                          title: t('logout'),
                          message: t('logoutConfirm'),
                          type: 'warning',
                          onConfirm: async () => {
                            await handleLogout()
                          },
                        })
                      }}
                      className="px-4 py-2 bg-warning text-white rounded-lg hover:bg-warning-dark transition-colors touch-manipulation font-semibold"
                    >
                      {t('logout')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600 dark:text-gray-400">{t('loginOptional')}</p>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors touch-manipulation font-semibold"
                  >
                    {t('login')}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Appearance Section */}
          {activeSection === 'appearance' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Palette className="text-primary" size={24} strokeWidth={2} />
                <h2 className="text-xl font-semibold">{t('theme')}</h2>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`px-4 py-3 rounded-xl border-2 transition-all touch-manipulation ${
                    theme === 'light'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-1">☀️</div>
                  <div className="text-sm font-medium">{t('light')}</div>
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`px-4 py-3 rounded-xl border-2 transition-all touch-manipulation ${
                    theme === 'dark'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-1">🌙</div>
                  <div className="text-sm font-medium">{t('dark')}</div>
                </button>
                <button
                  onClick={() => {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
                    const systemTheme = prefersDark ? 'dark' : 'light'
                    localStorage.setItem('theme', 'system')
                    handleThemeChange(systemTheme)
                  }}
                  className={`px-4 py-3 rounded-xl border-2 transition-all touch-manipulation ${
                    localStorage.getItem('theme') === 'system' ||
                    (!localStorage.getItem('theme') &&
                      window.matchMedia('(prefers-color-scheme: dark)').matches === (theme === 'dark'))
                      ? 'bg-primary text-white border-primary'
                      : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-1">💻</div>
                  <div className="text-sm font-medium">{t('system')}</div>
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Globe className="text-primary" size={24} strokeWidth={2} />
                <h2 className="text-xl font-semibold">{t('language')}</h2>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleLanguageChange('tr')}
                  className={`px-4 py-2 rounded-lg transition-colors touch-manipulation ${
                    language === 'tr'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('turkish')}
                </button>
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`px-4 py-2 rounded-lg transition-colors touch-manipulation ${
                    language === 'en'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('english')}
                </button>
              </div>
            </motion.div>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Bell className="text-primary" size={24} strokeWidth={2} />
                <h2 className="text-xl font-semibold">{t('notifications')}</h2>
              </div>
              <div className="space-y-4">
                <button
                  onClick={handleEnableNotifications}
                  className="w-full px-4 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors touch-manipulation"
                >
                  {t('grantNotificationPermission')}
                </button>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    {t('dailyReminderTime')}
                  </label>
                  <TimePicker value={dailyReminderTime} onChange={setDailyReminderTime} placeholder={t('dailyReminderTime')} />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('dailyReminderDescription')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    {t('weeklySummaryDay')}
                  </label>
                  <Select
                    value={weeklySummaryDay || ''}
                    onChange={(val) => setWeeklySummaryDay(val.toString())}
                    placeholder={t('select')}
                    options={[
                      { value: '0', label: t('sunday'), icon: <Calendar size={18} /> },
                      { value: '1', label: t('monday'), icon: <Calendar size={18} /> },
                      { value: '2', label: t('tuesday'), icon: <Calendar size={18} /> },
                      { value: '3', label: t('wednesday'), icon: <Calendar size={18} /> },
                      { value: '4', label: t('thursday'), icon: <Calendar size={18} /> },
                      { value: '5', label: t('friday'), icon: <Calendar size={18} /> },
                      { value: '6', label: t('saturday'), icon: <Calendar size={18} /> },
                    ]}
                  />
                </div>
                <button
                  onClick={handleSaveReminders}
                  className="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors touch-manipulation font-semibold"
                >
                  {t('save')}
                </button>
              </div>
            </motion.div>
          )}

          {/* Data Management */}
          {activeSection === 'data' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Database className="text-primary" size={24} strokeWidth={2} />
                <h2 className="text-xl font-semibold">{t('dataManagement')}</h2>
              </div>

              <div className="space-y-4">
                {/* Supabase diagnostics */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {t('supabaseConnection', { defaultValue: 'Supabase Bağlantısı' })}
                    </h3>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      supabaseEnabled
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                    }`}>
                      {supabaseEnabled
                        ? t('configured', { defaultValue: 'Configured' })
                        : t('notConfigured', { defaultValue: 'Not configured' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 break-words">
                    URL: {supabaseUrl || '(empty)'}
                  </p>

                  {supabaseDiag.ok !== null && (
                    <div className={`mb-3 rounded-lg border px-3 py-2 ${
                      supabaseDiag.ok
                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                        : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                    }`}>
                      <p className={`text-xs font-semibold ${
                        supabaseDiag.ok ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                      }`}>
                        {supabaseDiag.message}
                        {typeof supabaseDiag.httpStatus === 'number' ? ` (HTTP ${supabaseDiag.httpStatus})` : ''}
                      </p>
                      {supabaseDiag.details && (
                        <details className="mt-2">
                          <summary className={`cursor-pointer text-xs ${
                            supabaseDiag.ok ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                          }`}>
                            {t('details', { defaultValue: 'Detay' })}
                          </summary>
                          <pre className="mt-2 text-[11px] whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                            {supabaseDiag.details}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      hapticFeedback('light')
                      handleTestSupabase()
                    }}
                    disabled={supabaseDiag.running}
                    className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors touch-manipulation ${
                      supabaseDiag.running
                        ? 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300 cursor-not-allowed'
                        : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
                  >
                    {supabaseDiag.running
                      ? t('testing', { defaultValue: 'Test ediliyor...' })
                      : t('testConnection', { defaultValue: 'Bağlantıyı Test Et' })}
                  </button>
                </div>

                {/* Sync */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('sync')}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('syncDescription')}</p>
                  {syncStatus && (
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('pending', { defaultValue: 'Bekleyen' })}</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{syncStatus.pending}</p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('failed', { defaultValue: 'Hatalı' })}</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{syncStatus.failed}</p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('inProgress', { defaultValue: 'Devam ediyor' })}</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{syncStatus.inProgress}</p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('conflicts', { defaultValue: 'Çakışma' })}</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{syncStatus.conflicts}</p>
                      </div>
                      {syncStatus.lastError && (
                        <div className="col-span-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
                          <p className="text-xs text-red-700 dark:text-red-300 font-semibold">{t('lastSyncError', { defaultValue: 'Son senkron hatası' })}</p>
                          <p className="text-xs text-red-700 dark:text-red-300 break-words">{syncStatus.lastError}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleSync}
                    className="w-full bg-primary text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-dark transition-colors touch-manipulation"
                  >
                    {t('sync')}
                  </button>
                </div>

                {/* Export */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('export')}</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => {
                        hapticFeedback('light')
                        handleExport('json')
                      }}
                      className="flex flex-col items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary/40 transition-colors touch-manipulation"
                    >
                      <Download size={24} className="text-gray-700 dark:text-gray-300" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">JSON</span>
                    </button>
                    <button
                      onClick={() => {
                        hapticFeedback('light')
                        handleExport('pdf')
                      }}
                      className="flex flex-col items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl hover:border-red-400 dark:hover:border-red-600 transition-colors touch-manipulation"
                    >
                      <Download size={24} />
                      <span className="text-sm font-medium">PDF</span>
                    </button>
                    <button
                      onClick={() => {
                        hapticFeedback('light')
                        handleExport('csv')
                      }}
                      className="flex flex-col items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 rounded-xl hover:border-green-400 dark:hover:border-green-600 transition-colors touch-manipulation"
                    >
                      <Download size={24} />
                      <span className="text-sm font-medium">CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Security & Account Actions */}
          {activeSection === 'security' && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="text-primary" size={24} strokeWidth={2} />
                  <h2 className="text-xl font-semibold">{t('security')}</h2>
                </div>

                {user && (
                  <button
                    onClick={() => {
                      hapticFeedback('light')
                      openConfirm({
                        title: t('changePassword'),
                        message: t('changePasswordInstructions'),
                        type: 'info',
                        onConfirm: async () => {
                          try {
                            if (!user?.email) return
                            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                              redirectTo: `${window.location.origin}/reset-password`,
                            })
                            if (error) throw error
                            toast.success(t('passwordResetEmailSent'))
                          } catch (error) {
                            errorLoggingService.logError(
                              error instanceof Error ? error : new Error('Password reset error'),
                              'error',
                              user?.id
                            )
                            toast.error(t('failedToSendEmail'))
                          }
                        },
                      })
                    }}
                    className="w-full flex items-center gap-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-4 py-3 rounded-xl font-semibold transition-colors touch-manipulation border-2 border-blue-200 dark:border-blue-800"
                  >
                    <Lock size={20} strokeWidth={2} />
                    {t('changePassword')}
                  </button>
                )}

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <button
                    onClick={() => {
                      hapticFeedback('warning')
                      openConfirm({
                        title: t('logout'),
                        message: t('logoutConfirm'),
                        type: 'warning',
                        onConfirm: async () => {
                          await handleLogout()
                        },
                      })
                    }}
                    className="w-full flex items-center gap-3 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-4 py-3 rounded-xl font-semibold transition-colors touch-manipulation border-2 border-orange-200 dark:border-orange-800"
                  >
                    <LogOut size={20} strokeWidth={2} />
                    {t('logout')}
                  </button>

                  <button
                    onClick={() => {
                      hapticFeedback('error')
                      openConfirm({
                        title: t('deleteAccount'),
                        message: t('deleteAccountConfirm'),
                        type: 'danger',
                        onConfirm: async () => {
                          await handleDeleteAccount()
                        },
                      })
                    }}
                    className="w-full flex items-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-3 rounded-xl font-semibold transition-colors touch-manipulation border-2 border-red-200 dark:border-red-800"
                  >
                    <Trash2 size={20} strokeWidth={2} />
                    {t('deleteAccount')}
                  </button>
                </div>
              </motion.div>

              {/* Developer Tools */}
              {import.meta.env.DEV && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6"
                >
                  <h2 className="text-xl font-semibold mb-4">{t('developerTools')}</h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        hapticFeedback('light')
                        const logs = errorLoggingService.exportLogs()
                        const blob = new Blob([logs], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `error-logs-${new Date().toISOString()}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                        toast.success(t('logsExported'))
                      }}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation text-left"
                    >
                      {t('exportErrorLogs')}
                    </button>
                    <button
                      onClick={() => {
                        hapticFeedback('light')
                        const metrics = performanceService.getMetrics()
                        const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `performance-metrics-${new Date().toISOString()}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                        toast.success(t('metricsExported'))
                      }}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation text-left"
                    >
                      {t('exportPerformanceMetrics')}
                    </button>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmationDialog {...confirmDialogProps} />
    </div>
  )
}
