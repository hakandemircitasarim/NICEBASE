import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  X,
  Download,
  Calendar,
  Sun,
  Moon,
  Monitor,
  Bell,
  RefreshCw,
  Shield,
  Trash2,
  LogOut,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { supabase, hasSupabaseConfig } from '../lib/supabase'
import { memoryService } from '../services/memoryService'
import { mapUserFromSupabase } from '../lib/userMapper'
import { notificationService } from '../services/notificationService'
import { exportService } from '../services/exportService'
import { hapticFeedback } from '../utils/haptic'
import { errorLoggingService } from '../services/errorLoggingService'
import { performanceService } from '../services/performanceService'
import ConfirmationDialog from './ConfirmationDialog'
import Select from './Select'
import TimePicker from './TimePicker'
import { useModalPresence } from '../hooks/useModalPresence'

interface SettingsSheetProps {
  onClose: () => void
}

export default function SettingsSheet({ onClose }: SettingsSheetProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, setUser, setTheme, setLanguage, theme, language } = useStore()
  const [dailyReminderTime, setDailyReminderTime] = useState(
    user?.dailyReminderTime || ''
  )
  const [weeklySummaryDay, setWeeklySummaryDay] = useState(
    user?.weeklySummaryDay?.toString() || ''
  )
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
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

  useModalPresence(true)

  useEffect(() => {
    if (user) {
      setDailyReminderTime(user.dailyReminderTime || '')
      setWeeklySummaryDay(user.weeklySummaryDay?.toString() || '')
    }
  }, [user])

  // Prevent body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    // Debounce cloud sync to prevent modal state issues
    setTimeout(async () => {
      // Persist to cloud only if config + network are available
      if (user && hasSupabaseConfig && navigator.onLine) {
        try {
          const { error } = await supabase
            .from('users')
            .update({ theme: newTheme })
            .eq('id', user.id)

          if (!error) {
            const { data: userData } = await supabase
              .from('users')
              .select('*')
              .eq('id', user.id)
              .single()

            if (userData) {
              setUser(mapUserFromSupabase(userData))
            }
          }
        } catch {
          // Non-blocking — local change still applies
        }
      }
    }, 300) // 300ms debounce
  }

  const handleLanguageChange = async (newLang: 'tr' | 'en') => {
    setLanguage(newLang)
    // Persist to cloud only if config + network are available
    if (user && hasSupabaseConfig && navigator.onLine) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ language: newLang })
          .eq('id', user.id)

        if (!error) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

          if (userData) {
            setUser(mapUserFromSupabase(userData))
          }
        }
      } catch {
        // Non-blocking — local change still applies
      }
    }
  }

  const handleSaveReminders = async () => {
    if (!user) return

    const updates: any = {}
    if (dailyReminderTime) {
      updates.daily_reminder_time = dailyReminderTime
      notificationService.cancelReminder(user.id)
      await notificationService.requestPermission()
      notificationService.scheduleDailyReminder(dailyReminderTime, user.id)
    }
    if (weeklySummaryDay)
      updates.weekly_summary_day = parseInt(weeklySummaryDay)

    // Only persist to cloud when Supabase is configured and online
    if (!hasSupabaseConfig || !navigator.onLine) {
      // Still save local notification schedule
      toast.success(t('settingsSaved'))
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)

      if (!error) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (data) {
          setUser(mapUserFromSupabase(data))
          toast.success(t('settingsSaved'))
        }
      } else {
        toast.error(t('settingsSaveError'))
      }
    } catch {
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
      toast.error(
        t('loginRequiredForSync') ||
          'Senkronizasyon için giriş yapmanız gerekiyor'
      )
      return
    }
    try {
      hapticFeedback('light')
      toast.loading(t('syncing'), { id: 'sync' })
      await memoryService.syncAll(user.id)
      hapticFeedback('success')
      toast.success(t('syncComplete'), { id: 'sync' })
    } catch (error) {
      hapticFeedback('error')
      toast.error(t('syncError'), { id: 'sync' })
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
      toast.success(t('loggedOut') || 'Çıkış yapıldı')
      onClose()
    } catch (error) {
      hapticFeedback('error')
      toast.error(t('logoutError') || 'Çıkış yapılırken hata oluştu')
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
          new Error(
            `Failed to delete memories: ${memoriesError.message}`
          ),
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
      onClose()
      navigate('/login')
    } catch (error) {
      errorLoggingService.logError(
        error instanceof Error
          ? error
          : new Error('Account deletion error'),
        'error',
        user?.id
      )
      toast.error(t('accountDeletionFailed'))
    }
  }

  const handleExport = async (format: 'json' | 'pdf' | 'csv') => {
    if (!user) return
    try {
      toast.loading(t('exporting'), { id: 'export' })
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
      toast.success(t('exportedAs', { format: format.toUpperCase() }), {
        id: 'export',
      })
    } catch (error) {
      hapticFeedback('error')
      toast.error(t('exportError'), { id: 'export' })
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Export error'),
        'error',
        user?.id
      )
    }
  }

  // Collapsible section component
  const Section = ({
    id,
    icon,
    iconBg,
    iconColor,
    title,
    children,
  }: {
    id: string
    icon: React.ReactNode
    iconBg: string
    iconColor: string
    title: string
    children: React.ReactNode
  }) => {
    const isExpanded = expandedSection === id
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center gap-3 p-4 touch-manipulation text-left"
        >
          <div
            className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}
          >
            {icon}
          </div>
          <span className="flex-1 font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </span>
          {isExpanded ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </button>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4"
          >
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              {children}
            </div>
          </motion.div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] flex flex-col bg-gray-50 dark:bg-gray-900 rounded-t-3xl shadow-2xl"
      >
        {/* Handle & Header */}
        <div className="flex-shrink-0 pt-3 pb-2 px-5">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t('settings')}
            </h2>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center touch-manipulation hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 space-y-3 pt-3">
          {/* Theme */}
          <Section
            id="theme"
            icon={<Sun size={18} className="text-yellow-600 dark:text-yellow-400" />}
            iconBg="bg-yellow-100 dark:bg-yellow-900/30"
            iconColor="text-yellow-600"
            title={t('theme')}
          >
            <div className="grid grid-cols-3 gap-2 mt-3">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all ${
                  theme === 'light'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-primary/50'
                }`}
              >
                <Sun size={22} />
                <span className="text-xs font-medium">{t('light')}</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all ${
                  theme === 'dark'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-primary/50'
                }`}
              >
                <Moon size={22} />
                <span className="text-xs font-medium">{t('dark')}</span>
              </button>
              <button
                onClick={() => {
                  const prefersDark = window.matchMedia(
                    '(prefers-color-scheme: dark)'
                  ).matches
                  handleThemeChange(prefersDark ? 'dark' : 'light')
                }}
                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-primary/50 transition-all"
              >
                <Monitor size={22} />
                <span className="text-xs font-medium">{t('system')}</span>
              </button>
            </div>
          </Section>

          {/* Language */}
          <Section
            id="language"
            icon={<span className="text-base">🌐</span>}
            iconBg="bg-indigo-100 dark:bg-indigo-900/30"
            iconColor="text-indigo-600"
            title={t('language')}
          >
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => handleLanguageChange('tr')}
                className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  language === 'tr'
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                🇹🇷 {t('turkish')}
              </button>
              <button
                onClick={() => handleLanguageChange('en')}
                className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  language === 'en'
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                🇬🇧 {t('english')}
              </button>
            </div>
          </Section>

          {/* Notifications */}
          <Section
            id="notifications"
            icon={<Bell size={18} className="text-purple-600 dark:text-purple-400" />}
            iconBg="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600"
            title={t('notifications')}
          >
            <div className="space-y-4 mt-3">
              <button
                onClick={handleEnableNotifications}
                className="w-full px-4 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors touch-manipulation text-sm"
              >
                {t('grantNotificationPermission')}
              </button>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('dailyReminderTime')}
                </label>
                <TimePicker
                  value={dailyReminderTime}
                  onChange={setDailyReminderTime}
                  placeholder={t('dailyReminderTime')}
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  {t('dailyReminderDescription')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('weeklySummaryDay')}
                </label>
                <Select
                  value={weeklySummaryDay || ''}
                  onChange={(val) => setWeeklySummaryDay(val.toString())}
                  placeholder={t('select')}
                  options={[
                    {
                      value: '0',
                      label: t('sunday'),
                      icon: <Calendar size={16} />,
                    },
                    {
                      value: '1',
                      label: t('monday'),
                      icon: <Calendar size={16} />,
                    },
                    {
                      value: '2',
                      label: t('tuesday'),
                      icon: <Calendar size={16} />,
                    },
                    {
                      value: '3',
                      label: t('wednesday'),
                      icon: <Calendar size={16} />,
                    },
                    {
                      value: '4',
                      label: t('thursday'),
                      icon: <Calendar size={16} />,
                    },
                    {
                      value: '5',
                      label: t('friday'),
                      icon: <Calendar size={16} />,
                    },
                    {
                      value: '6',
                      label: t('saturday'),
                      icon: <Calendar size={16} />,
                    },
                  ]}
                />
              </div>
              <button
                onClick={handleSaveReminders}
                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold"
              >
                {t('save')}
              </button>
            </div>
          </Section>

          {/* Sync */}
          <Section
            id="sync"
            icon={<RefreshCw size={18} className="text-cyan-600 dark:text-cyan-400" />}
            iconBg="bg-cyan-100 dark:bg-cyan-900/30"
            iconColor="text-cyan-600"
            title={t('sync')}
          >
            <div className="mt-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('syncDescription')}
              </p>
              <button
                onClick={handleSync}
                className="w-full bg-primary text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-primary-dark transition-colors touch-manipulation text-sm"
              >
                {t('sync')}
              </button>
            </div>
          </Section>

          {/* Export */}
          <Section
            id="export"
            icon={<Download size={18} className="text-emerald-600 dark:text-emerald-400" />}
            iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            iconColor="text-emerald-600"
            title={t('export')}
          >
            <div className="grid grid-cols-3 gap-2 mt-3">
              <button
                onClick={() => {
                  hapticFeedback('light')
                  handleExport('json')
                }}
                className="flex flex-col items-center gap-1.5 px-3 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation"
              >
                <Download size={20} />
                <span className="text-xs font-medium">JSON</span>
              </button>
              <button
                onClick={() => {
                  hapticFeedback('light')
                  handleExport('pdf')
                }}
                className="flex flex-col items-center gap-1.5 px-3 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors touch-manipulation"
              >
                <Download size={20} />
                <span className="text-xs font-medium">PDF</span>
              </button>
              <button
                onClick={() => {
                  hapticFeedback('light')
                  handleExport('csv')
                }}
                className="flex flex-col items-center gap-1.5 px-3 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors touch-manipulation"
              >
                <Download size={20} />
                <span className="text-xs font-medium">CSV</span>
              </button>
            </div>
          </Section>

          {/* Security */}
          {user && (
            <Section
              id="security"
              icon={<Shield size={18} className="text-blue-600 dark:text-blue-400" />}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600"
              title={t('security')}
            >
              <div className="mt-3">
                <button
                  onClick={() => {
                    hapticFeedback('light')
                    setConfirmDialog({
                      isOpen: true,
                      title: t('changePassword'),
                      message: t('changePasswordInstructions'),
                      type: 'info',
                      onConfirm: async () => {
                        try {
                          if (!user?.email) return
                          const { error } =
                            await supabase.auth.resetPasswordForEmail(
                              user.email,
                              {
                                redirectTo: `${window.location.origin}/reset-password`,
                              }
                            )
                          if (error) throw error
                          toast.success(t('passwordResetEmailSent'))
                        } catch (error) {
                          errorLoggingService.logError(
                            error instanceof Error
                              ? error
                              : new Error('Password reset error'),
                            'error',
                            user?.id
                          )
                          toast.error(t('failedToSendEmail'))
                        }
                      },
                    })
                  }}
                  className="w-full text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-4 py-2.5 rounded-xl font-semibold transition-colors touch-manipulation border-2 border-blue-200 dark:border-blue-800 text-sm"
                >
                  {t('changePassword')}
                </button>
              </div>
            </Section>
          )}

          {/* Account Actions */}
          {user && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                {t('accountActions')}
              </h3>
              <button
                onClick={() => {
                  hapticFeedback('warning')
                  setConfirmDialog({
                    isOpen: true,
                    title: t('logout'),
                    message: t('logoutConfirm'),
                    type: 'warning',
                    onConfirm: async () => {
                      await handleLogout()
                    },
                  })
                }}
                className="w-full flex items-center justify-center gap-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-4 py-2.5 rounded-xl font-semibold transition-colors touch-manipulation border border-orange-200 dark:border-orange-800 text-sm"
              >
                <LogOut size={16} />
                {t('logout')}
              </button>

              <button
                onClick={() => {
                  hapticFeedback('error')
                  setConfirmDialog({
                    isOpen: true,
                    title: t('deleteAccount'),
                    message: t('deleteAccountConfirm'),
                    type: 'danger',
                    onConfirm: async () => {
                      await handleDeleteAccount()
                    },
                  })
                }}
                className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2.5 rounded-xl font-semibold transition-colors touch-manipulation border border-red-200 dark:border-red-800 text-sm"
              >
                <Trash2 size={16} />
                {t('deleteAccount')}
              </button>
            </div>
          )}

          {/* Developer Tools */}
          {import.meta.env.DEV && (
            <Section
              id="dev"
              icon={<span className="text-base">🛠</span>}
              iconBg="bg-gray-100 dark:bg-gray-700"
              iconColor="text-gray-600"
              title={t('developerTools')}
            >
              <div className="space-y-2 mt-3">
                <button
                  onClick={() => {
                    hapticFeedback('light')
                    const logs = errorLoggingService.exportLogs()
                    const blob = new Blob([logs], {
                      type: 'application/json',
                    })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `error-logs-${new Date().toISOString()}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                    toast.success(t('logsExported'))
                  }}
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation text-left text-sm"
                >
                  {t('exportErrorLogs')}
                </button>
                <button
                  onClick={() => {
                    hapticFeedback('light')
                    const metrics = performanceService.getMetrics()
                    const blob = new Blob(
                      [JSON.stringify(metrics, null, 2)],
                      { type: 'application/json' }
                    )
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `performance-metrics-${new Date().toISOString()}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                    toast.success(t('metricsExported'))
                  }}
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation text-left text-sm"
                >
                  {t('exportPerformanceMetrics')}
                </button>
              </div>
            </Section>
          )}
        </div>
      </motion.div>

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() =>
          setConfirmDialog({ ...confirmDialog, isOpen: false })
        }
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />
    </>
  )
}
