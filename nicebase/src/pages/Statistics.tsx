import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Calendar, Heart, Sparkles, Flame } from 'lucide-react'
import { streakService } from '../services/streakService'
import { Memory, MemoryCategory, LifeArea } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import { useNotifications } from '../hooks/useNotifications'
import { normalizeConnectionKey } from '../utils/connections'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

// Type for Pie chart label entry
type PieLabelEntry = {
  name?: string
  value?: number
  percent?: number
}

const COLORS = ['#FF6B35', '#F7931E', '#FFD23F', '#06FFA5', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']

export default function Statistics() {
  const { t, i18n } = useTranslation()
  const userId = useUserId()
  const { memories, loading } = useMemories(userId)
  const { showError } = useNotifications()
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0, lastMemoryDate: null as string | null, streakStartDate: null as string | null })

  useEffect(() => {
    let cancelled = false
    const loadStreak = async () => {
      try {
        const streakData = await streakService.calculateStreak(userId)
        if (!cancelled) setStreak(streakData)
      } catch (error) {
        if (!cancelled) showError(t('loadError'))
      }
    }
    loadStreak()
    return () => { cancelled = true }
  }, [userId, t, showError])

  const lang = (i18n?.language || 'tr').startsWith('tr') ? 'tr' : 'en'

  // Calculate statistics
  const stats = useMemo(() => {
    if (memories.length === 0) {
      return {
        totalMemories: 0,
        coreMemories: 0,
        avgIntensity: 0,
        totalConnections: 0,
        categoryData: [],
        lifeAreaData: [],
        monthlyData: [],
        intensityDistribution: [],
      }
    }

    const totalMemories = memories.length
    const coreMemories = memories.filter(m => m.isCore).length
    const avgIntensity = memories.reduce((sum, m) => sum + m.intensity, 0) / totalMemories
    const totalConnections = new Set(memories.flatMap(m => m.connections).map(normalizeConnectionKey)).size

    // Category distribution
    const categoryCount: Record<MemoryCategory, number> = {
      uncategorized: 0,
      success: 0,
      peace: 0,
      fun: 0,
      love: 0,
      gratitude: 0,
      inspiration: 0,
      growth: 0,
      adventure: 0,
    }
    memories.forEach(m => {
      categoryCount[m.category]++
    })
    const categoryData = Object.entries(categoryCount).map(([key, value]) => ({
      name: t(`categories.${key}`) || key,
      value,
    }))

    // Life area distribution
    const lifeAreaCount: Record<LifeArea, number> = {
      uncategorized: 0,
      personal: 0,
      work: 0,
      relationship: 0,
      family: 0,
      friends: 0,
      hobby: 0,
      travel: 0,
      health: 0,
    }
    memories.forEach(m => {
      lifeAreaCount[m.lifeArea]++
    })
    const lifeAreaData = Object.entries(lifeAreaCount)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: t(`lifeAreas.${key}`) || key,
        value,
      }))

    // Monthly data (last 6 months)
    const monthlyData: { month: string; count: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { month: 'short' })
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      
      const count = memories.filter(m => {
        const memoryDate = new Date(m.date)
        return memoryDate >= monthStart && memoryDate <= monthEnd
      }).length
      
      monthlyData.push({ month: monthKey, count })
    }

    // Intensity distribution
    const intensityCount: Record<number, number> = {}
    for (let i = 1; i <= 10; i++) {
      intensityCount[i] = 0
    }
    memories.forEach(m => {
      intensityCount[m.intensity]++
    })
    const intensityDistribution = Object.entries(intensityCount).map(([key, value]) => ({
      intensity: parseInt(key),
      count: value,
    }))

    return {
      totalMemories,
      coreMemories,
      avgIntensity: Math.round(avgIntensity * 10) / 10,
      totalConnections,
      categoryData,
      lifeAreaData,
      monthlyData,
      intensityDistribution,
    }
  }, [memories, t, lang])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  if (memories.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8 py-8 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10 sm:mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-primary/10 border-2 border-primary">
              <BarChart3 className="text-primary" size={32} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
              {t('statistics') || 'İstatistikler'}
            </h1>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20 sm:py-24 px-4"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mb-6"
          >
            <BarChart3 className="mx-auto text-gray-400 dark:text-gray-500" size={80} />
          </motion.div>
          <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-xl sm:text-2xl">
            {t('noStatistics') || 'Henüz istatistik yok'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg mb-8 leading-relaxed">
            {t('addMemoriesToSeeStatistics') || 'İstatistikleri görmek için anı ekleyin'}
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div
      className="w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-8 sm:py-10"
    >

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 sm:mb-10"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 rounded-full bg-primary/10 border-2 border-primary">
            <BarChart3 className="text-primary" size={32} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            {t('statistics') || 'İstatistikler'}
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg">
          {t('statisticsDescription') || 'Anılarınızın detaylı analizi'}
        </p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 hover:border-primary/30 hover:shadow-lg transition-all"
        >
          <div className="flex items-center gap-2 mb-2">
            <Heart className="text-primary" size={20} />
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
              {t('totalMemories') || 'Toplam Anı'}
            </p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalMemories}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 hover:border-primary/30 hover:shadow-lg transition-all"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="text-primary" size={20} />
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
              {t('coreMemories') || 'Çekirdek'}
            </p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats.coreMemories}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 hover:border-primary/30 hover:shadow-lg transition-all"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-primary" size={20} />
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
              {t('avgIntensity') || 'Ort. Yoğunluk'}
            </p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats.avgIntensity}/10
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 hover:border-primary/30 hover:shadow-lg transition-all"
        >
          <div className="flex items-center gap-2 mb-2">
            <Flame className="text-primary" size={20} />
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
              {t('streak') || 'Seri'}
            </p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            {streak.currentStreak}
          </p>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="space-y-8 sm:space-y-10">
        {/* Monthly Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6"
        >
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
            <Calendar className="text-primary" size={24} />
            {t('monthlyTrend') || 'Aylık Trend'}
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" className="text-xs sm:text-sm" />
              <YAxis className="text-xs sm:text-sm" />
              <Tooltip />
              <Bar dataKey="count" fill="#FF6B35" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Category Distribution */}
        {stats.categoryData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6"
          >
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <Heart className="text-primary" size={24} />
              {t('categoryDistribution') || 'Kategori Dağılımı'}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: PieLabelEntry) => {
                    if (!entry) return ''
                    const name = entry.name || ''
                    const percent = typeof entry.percent === 'number' ? entry.percent : 0
                    return `${name} ${(percent * 100).toFixed(0)}%`
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.categoryData.map((entry: { name: string; value: number }, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Intensity Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6"
        >
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
            <TrendingUp className="text-primary" size={24} />
            {t('intensityDistribution') || 'Yoğunluk Dağılımı'}
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.intensityDistribution}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="intensity" className="text-xs sm:text-sm" />
              <YAxis className="text-xs sm:text-sm" />
              <Tooltip />
              <Bar dataKey="count" fill="#FF6B35" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Life Area Distribution */}
        {stats.lifeAreaData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6"
          >
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <Sparkles className="text-primary" size={24} />
              {t('lifeAreaDistribution') || 'Yaşam Alanı Dağılımı'}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.lifeAreaData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: PieLabelEntry) => {
                    if (!entry) return ''
                    const name = entry.name || ''
                    const percent = typeof entry.percent === 'number' ? entry.percent : 0
                    return `${name} ${(percent * 100).toFixed(0)}%`
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.lifeAreaData.map((entry: { name: string; value: number }, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>
    </div>
  )
}
