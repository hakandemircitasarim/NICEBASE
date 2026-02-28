import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Award, Sparkles, CheckCircle2, Circle } from 'lucide-react'
import { gamificationService, Badge, Achievement } from '../services/gamificationService'
import LoadingSpinner from '../components/LoadingSpinner'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import { useNotifications } from '../hooks/useNotifications'

export default function Achievements() {
  const { t, i18n } = useTranslation()
  const userId = useUserId()
  const { memories, loading } = useMemories(userId)
  const { showError, hapticFeedback } = useNotifications()
  const [badges, setBadges] = useState<Badge[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [activeTab, setActiveTab] = useState<'badges' | 'achievements'>('badges')

  useEffect(() => {
    const loadData = async () => {
      try {
        const [badgesData, achievementsData] = await Promise.all([
          gamificationService.getBadges(userId, memories),
          gamificationService.getAchievements(userId, memories),
        ])
        setBadges(badgesData)
        setAchievements(achievementsData)
      } catch (error) {
        showError(t('loadError'))
      }
    }
    if (memories.length > 0 || !loading) {
      loadData()
    }
  }, [userId, memories, loading, t, showError])

  const unlockedBadges = badges.filter(b => b.unlocked).length
  const totalBadges = badges.length
  const unlockedAchievements = achievements.filter(a => a.unlocked).length
  const totalAchievements = achievements.length

  const lang = (i18n?.language || 'tr').startsWith('tr') ? 'tr' : 'en'

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
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
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 rounded-full bg-primary/10 border-2 border-primary">
            <Trophy className="text-primary" size={32} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            {t('badgesAndAchievements') || 'Rozetler ve Başarımlar'}
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg">
          {t('badgesAndAchievementsDescription') || 'Başarılarınızı keşfedin ve yeni hedefler belirleyin'}
        </p>
      </motion.div>

      {/* Progress Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-4 sm:gap-6 mb-8"
      >
        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 hover:border-primary/30 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3 mb-3">
            <Award className="text-primary" size={24} />
            <h3 className="font-bold text-lg">{t('badges') || 'Rozetler'}</h3>
          </div>
          <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {unlockedBadges}/{totalBadges}
          </p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${totalBadges > 0 ? (unlockedBadges / totalBadges) * 100 : 0}%` }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-r from-primary to-primary-dark h-2 rounded-full"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 hover:border-primary/30 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="text-primary" size={24} />
            <h3 className="font-bold text-lg">{t('achievements') || 'Başarımlar'}</h3>
          </div>
          <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {unlockedAchievements}/{totalAchievements}
          </p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${totalAchievements > 0 ? (unlockedAchievements / totalAchievements) * 100 : 0}%` }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-r from-primary to-primary-dark h-2 rounded-full"
            />
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        <button
          onClick={() => {
            setActiveTab('badges')
            hapticFeedback('light')
          }}
          className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all touch-manipulation ${
            activeTab === 'badges'
              ? 'bg-white dark:bg-gray-700 text-primary shadow-md'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {t('badges') || 'Rozetler'}
        </button>
        <button
          onClick={() => {
            setActiveTab('achievements')
            hapticFeedback('light')
          }}
          className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all touch-manipulation ${
            activeTab === 'achievements'
              ? 'bg-white dark:bg-gray-700 text-primary shadow-md'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {t('achievements') || 'Başarımlar'}
        </button>
      </div>

      {/* Badges Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'badges' && (
          <motion.div
            key="badges"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            {badges.map((badge, index) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`relative bg-white dark:bg-gray-800 border-2 rounded-2xl p-4 sm:p-6 text-center transition-all touch-manipulation ${
                  badge.unlocked
                    ? 'border-primary/50 shadow-lg hover:shadow-xl hover:scale-105'
                    : 'border-gray-200 dark:border-gray-700 opacity-60'
                }`}
              >
                {badge.unlocked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-primary text-white rounded-full p-1"
                  >
                    <CheckCircle2 size={20} />
                  </motion.div>
                )}
                <div className="text-5xl sm:text-6xl mb-3">{badge.icon}</div>
                <h3 className="font-bold text-sm sm:text-base mb-2 text-gray-900 dark:text-gray-100">
                  {lang === 'tr' ? badge.name : badge.nameEn}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {lang === 'tr' ? badge.description : badge.descriptionEn}
                </p>
                {badge.unlocked && badge.unlockedAt && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {new Date(badge.unlockedAt).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US')}
                  </p>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <motion.div
            key="achievements"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4 sm:space-y-6"
          >
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white dark:bg-gray-800 border-2 rounded-2xl p-5 sm:p-6 transition-all ${
                  achievement.unlocked
                    ? 'border-primary/50 shadow-lg'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl sm:text-5xl flex-shrink-0">
                    {achievement.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                        {lang === 'tr' ? achievement.name : achievement.nameEn}
                      </h3>
                      {achievement.unlocked && (
                        <CheckCircle2 className="text-primary flex-shrink-0" size={20} />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {lang === 'tr' ? achievement.description : achievement.descriptionEn}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t('progress') || 'İlerleme'}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {achievement.progress} / {achievement.target}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${achievement.target > 0 ? Math.min((achievement.progress / achievement.target) * 100, 100) : 0}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className={`h-full rounded-full ${
                            achievement.unlocked
                              ? 'bg-gradient-to-r from-primary to-primary-dark'
                              : 'bg-gradient-to-r from-gray-400 to-gray-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
