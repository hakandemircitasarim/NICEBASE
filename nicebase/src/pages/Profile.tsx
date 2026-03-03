import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings as SettingsIcon,
  Users,
  BarChart3,
  Trophy,
  ChevronRight,
  Heart,
  Flame,
  Crown,
  LogIn,
  Pencil,
  MapPin,
  Cake,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../store/useStore'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import { hapticFeedback } from '../utils/haptic'
import { normalizeConnectionKey } from '../utils/connections'
import SettingsSheet from '../components/SettingsSheet'
import EditProfileSheet from '../components/EditProfileSheet'

export default function Profile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const userId = useUserId()
  const { memories } = useMemories(userId)
  const [showSettings, setShowSettings] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)

  // Load profile data from localStorage fallback on mount
  useEffect(() => {
    if (user && !user.displayName && !user.bio && !user.avatarUrl) {
      try {
        const saved = localStorage.getItem(`profile_${user.id}`)
        if (saved) {
          const data = JSON.parse(saved)
          if (data.displayName || data.bio || data.avatarUrl || data.birthday || data.location) {
            setUser({
              ...user,
              displayName: data.displayName || null,
              bio: data.bio || null,
              avatarUrl: data.avatarUrl || null,
              birthday: data.birthday || null,
              location: data.location || null,
            })
          }
        }
      } catch {
        // ignore
      }
    }
  }, [user, setUser])

  // Quick stats
  const stats = useMemo(() => {
    const totalMemories = memories.length
    const coreMemories = memories.filter((m) => m.isCore).length
    const totalConnections = new Set(
      memories.flatMap((m) => m.connections).map(normalizeConnectionKey)
    ).size

    // Simple streak calculation
    let currentStreak = 0
    if (memories.length > 0) {
      const sorted = [...memories].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const dates = new Set(
        sorted.map((m) => {
          const d = new Date(m.date)
          d.setHours(0, 0, 0, 0)
          return d.getTime()
        })
      )

      let checkDate = new Date(today)
      if (!dates.has(checkDate.getTime())) {
        checkDate.setDate(checkDate.getDate() - 1)
      }

      while (dates.has(checkDate.getTime())) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      }
    }

    return { totalMemories, coreMemories, totalConnections, currentStreak }
  }, [memories])

  // Top connections
  const topConnections = useMemo(() => {
    const connMap = new Map<string, number>()
    for (const memory of memories) {
      for (const conn of memory.connections) {
        const key = normalizeConnectionKey(conn)
        connMap.set(key, (connMap.get(key) || 0) + 1)
      }
    }
    return Array.from(connMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }, [memories])

  // Avatar
  const avatarLetter = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : '?'

  // Birthday display
  const birthdayDisplay = useMemo(() => {
    if (!user?.birthday) return null
    const bd = new Date(user.birthday)
    return bd.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
  }, [user?.birthday])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-8">
      {/* Profile Header */}
      <div className="relative pt-8 pb-6">
        {/* Background gradient */}
        <div className="absolute inset-0 -mx-4 sm:-mx-6 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent rounded-b-3xl" />

        <div className="relative flex flex-col items-center">
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="relative mb-4"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover shadow-lg shadow-primary/20 border-4 border-white dark:border-gray-800"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-white dark:border-gray-800">
                <span className="text-3xl font-bold text-white">
                  {avatarLetter}
                </span>
              </div>
            )}
            {user?.isPremium && (
              <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center shadow-md">
                <Crown size={16} className="text-yellow-800" />
              </div>
            )}
          </motion.div>

          {/* User info */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center w-full max-w-sm"
          >
            {user ? (
              <div className="space-y-1.5">
                {/* Display name or email */}
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {user.displayName || user.email}
                </h2>

                {/* Bio */}
                {user.bio && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed px-4">
                    {user.bio}
                  </p>
                )}

                {/* Info chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {user.location && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                      <MapPin size={12} />
                      {user.location}
                    </span>
                  )}
                  {birthdayDisplay && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                      <Cake size={12} />
                      {birthdayDisplay}
                    </span>
                  )}
                </div>

                {/* Show email small if name is displayed */}
                {user.displayName && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 pt-0.5">
                    {user.email}
                  </p>
                )}

                {/* If no personal info yet, prompt */}
                {!user.displayName && !user.bio && (
                  <button
                    onClick={() => {
                      hapticFeedback('light')
                      setShowEditProfile(true)
                    }}
                    className="inline-flex items-center gap-1.5 text-sm text-primary font-medium mt-2 touch-manipulation"
                  >
                    <Pencil size={14} />
                    {t('completeYourProfile')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xs mx-auto">
                  {t('profileLoginPrompt')}
                </p>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    hapticFeedback('light')
                    navigate('/login')
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors touch-manipulation shadow-md"
                >
                  <LogIn size={18} />
                  {t('login')}
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Quick Stats */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        <button
          onClick={() => {
            hapticFeedback('light')
            navigate('/vault')
          }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-center hover:border-primary/40 transition-all touch-manipulation"
        >
          <div className="flex items-center justify-center mb-1.5">
            <Heart size={20} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalMemories}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {t('profileMemories')}
          </p>
        </button>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center mb-1.5">
            <Flame size={20} className="text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.currentStreak}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {t('profileStreak')}
          </p>
        </div>

        <button
          onClick={() => {
            hapticFeedback('light')
            navigate('/profile/connections')
          }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-center hover:border-primary/40 transition-all touch-manipulation"
        >
          <div className="flex items-center justify-center mb-1.5">
            <Users size={20} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalConnections}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {t('profileConnections')}
          </p>
        </button>
      </motion.div>

      {/* Sections */}
      <div className="space-y-3">
        {/* Edit Profile - only if logged in and already has some info */}
        {user && (user.displayName || user.bio) && (
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.18 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              hapticFeedback('light')
              setShowEditProfile(true)
            }}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 hover:border-primary/40 transition-all touch-manipulation text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Pencil className="text-primary" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-gray-100">
                  {t('editProfile')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('editProfileDescription')}
                </p>
              </div>
              <ChevronRight
                size={20}
                className="text-gray-400 dark:text-gray-500 flex-shrink-0"
              />
            </div>
          </motion.button>
        )}

        {/* Connections Section */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            hapticFeedback('light')
            navigate('/profile/connections')
          }}
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 hover:border-primary/40 transition-all touch-manipulation text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Users className="text-blue-600 dark:text-blue-400" size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-gray-100">
                {t('connections')}
              </p>
              {topConnections.length > 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {topConnections.map((c) => c.name).join(', ')}
                </p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {t('noConnectionsYet')}
                </p>
              )}
            </div>
            <ChevronRight
              size={20}
              className="text-gray-400 dark:text-gray-500 flex-shrink-0"
            />
          </div>
        </motion.button>

        {/* Statistics Section */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            hapticFeedback('light')
            navigate('/statistics')
          }}
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 hover:border-primary/40 transition-all touch-manipulation text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <BarChart3
                className="text-green-600 dark:text-green-400"
                size={22}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-gray-100">
                {t('statistics')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('profileStatisticsDescription')}
              </p>
            </div>
            <ChevronRight
              size={20}
              className="text-gray-400 dark:text-gray-500 flex-shrink-0"
            />
          </div>
        </motion.button>

        {/* Achievements Section */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            hapticFeedback('light')
            navigate('/achievements')
          }}
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 hover:border-primary/40 transition-all touch-manipulation text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
              <Trophy
                className="text-yellow-600 dark:text-yellow-400"
                size={22}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-gray-100">
                {t('achievements')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('profileAchievementsDescription')}
              </p>
            </div>
            <ChevronRight
              size={20}
              className="text-gray-400 dark:text-gray-500 flex-shrink-0"
            />
          </div>
        </motion.button>

        {/* Premium Section */}
        {user && !user.isPremium && (
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              hapticFeedback('light')
              toast(t('premiumComingSoon'))
            }}
            className="w-full bg-gradient-to-r from-primary/10 to-yellow-500/10 dark:from-primary/20 dark:to-yellow-500/20 border border-primary/30 rounded-2xl p-4 sm:p-5 hover:border-primary/50 transition-all touch-manipulation text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-md">
                <Crown className="text-white" size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-gray-100">
                  {t('premium')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('profilePremiumDescription')}
                </p>
              </div>
              <ChevronRight
                size={20}
                className="text-primary flex-shrink-0"
              />
            </div>
          </motion.button>
        )}

        {/* Settings Section */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            hapticFeedback('light')
            setShowSettings(true)
          }}
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 hover:border-primary/40 transition-all touch-manipulation text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <SettingsIcon
                className="text-gray-600 dark:text-gray-400"
                size={22}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-gray-100">
                {t('settings')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('profileSettingsDescription')}
              </p>
            </div>
            <ChevronRight
              size={20}
              className="text-gray-400 dark:text-gray-500 flex-shrink-0"
            />
          </div>
        </motion.button>
      </div>

      {/* App version */}
      <div className="text-center mt-8 mb-4">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          NICEBASE v1.0
        </p>
      </div>

      {/* Settings Sheet */}
      <AnimatePresence>
        {showSettings && (
          <SettingsSheet onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>

      {/* Edit Profile Sheet */}
      <AnimatePresence>
        {showEditProfile && (
          <EditProfileSheet onClose={() => setShowEditProfile(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
