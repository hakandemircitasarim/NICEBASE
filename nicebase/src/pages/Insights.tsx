import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Heart,
  Flame,
  TrendingUp,
  Gauge,
  Sparkles,
  Tag,
  Users,
  CalendarDays,
  Clock,
  Calendar,
  LayoutGrid,
  BarChart3,
  Target,
  Trophy,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { streakService } from '../services/streakService'
import { gamificationService, Badge, Achievement } from '../services/gamificationService'
import { MemoryCategory, LifeArea } from '../types'
import { useStore } from '../store/useStore'
import LoadingSpinner from '../components/LoadingSpinner'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import { useNotifications } from '../hooks/useNotifications'
import { normalizeConnectionKey, cleanConnectionName } from '../utils/connections'
import { parseLocalDate } from '../utils/dateFormat'
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
  ResponsiveContainer,
} from 'recharts'

type TabKey = 'overview' | 'trends' | 'goals'

// Type for Pie chart label entry. Recharts also passes SVG positioning props to
// a label render function, which we use to draw a theme-aware <text>.
type PieLabelEntry = {
  name?: string
  value?: number
  percent?: number
  x?: number
  y?: number
  textAnchor?: 'start' | 'middle' | 'end' | 'inherit'
}

const COLORS = ['#FF6B35', '#F7931E', '#FFD23F', '#06FFA5', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']

// Custom tooltip that shows clean labels instead of raw dataKey.
// `seriesLabel` names the metric (e.g. "Memories") so a bare number never shows
// without context; pie slices already carry their category name in payload.name.
function CustomTooltip({ active, payload, label, seriesLabel }: { active?: boolean; payload?: Array<{ value: number; name?: string }>; label?: string; seriesLabel?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-lg text-sm">
      {label && <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{label}</p>}
      {payload.map((entry, i) => {
        const name = entry.name || seriesLabel
        return (
          <p key={i} className="text-gray-600 dark:text-gray-400">
            {name ? <span className="font-medium text-gray-900 dark:text-gray-100">{name}: </span> : null}
            {entry.value}
          </p>
        )
      })}
    </div>
  )
}

export default function Insights() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const prefersReducedMotion = useReducedMotion()
  const userId = useUserId()
  const { memories, loading, error, refreshMemories } = useMemories(userId)
  const { showError, hapticFeedback } = useNotifications()
  const theme = useStore(state => state.theme)

  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab: TabKey = rawTab === 'trends' || rawTab === 'goals' ? rawTab : 'overview'
  const setTab = (tab: TabKey) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
    hapticFeedback('light')
  }

  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0, lastMemoryDate: null as string | null, streakStartDate: null as string | null })
  const [badges, setBadges] = useState<Badge[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])

  // Avoid flashing the empty/get-started screen before the first load commits
  // (useMemories starts loading=false and loads in an effect).
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false)
  useEffect(() => {
    if (loading || error || memories.length > 0) setHasAttemptedLoad(true)
  }, [loading, error, memories.length])

  const lang = (i18n?.language || 'tr').startsWith('tr') ? 'tr' : 'en'
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US'

  // Load streak from the already-loaded memories (avoids a duplicate Dexie read).
  useEffect(() => {
    let cancelled = false
    const loadStreak = async () => {
      try {
        const streakData = await streakService.calculateStreak(userId, memories)
        if (!cancelled) setStreak(streakData)
      } catch {
        if (!cancelled) showError(t('loadError'))
      }
    }
    loadStreak()
    return () => { cancelled = true }
  }, [userId, memories, t, showError])

  // Load badges + achievements (gamification) from the same memories.
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [badgesData, achievementsData] = await Promise.all([
          gamificationService.getBadges(userId, memories),
          gamificationService.getAchievements(userId, memories),
        ])
        if (cancelled) return
        setBadges(badgesData)
        setAchievements(achievementsData)
      } catch {
        if (!cancelled) showError(t('loadError'))
      }
    }
    if (!error && (memories.length > 0 || !loading)) {
      loadData()
    }
    return () => { cancelled = true }
  }, [userId, memories, loading, error, t, showError])

  // Recharts draws pie labels with a default mid-gray SVG fill that fails WCAG
  // contrast on dark cards. Render the label ourselves with a theme-aware fill.
  const pieLabelFill = theme === 'dark' ? '#d1d5db' : '#374151'
  const renderPieLabel = (entry: PieLabelEntry) => {
    if (!entry) return null
    const name = entry.name || ''
    const percent = typeof entry.percent === 'number' ? entry.percent : 0
    return (
      <text
        x={entry.x}
        y={entry.y}
        fill={pieLabelFill}
        textAnchor={entry.textAnchor}
        dominantBaseline="central"
        className="text-xs"
      >
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  // All aggregations derived from memories. Ported from Statistics.tsx and
  // extended with the overview highlights.
  const stats = useMemo(() => {
    if (memories.length === 0) {
      return {
        totalMemories: 0,
        coreMemories: 0,
        coreRatio: 0,
        avgIntensity: 0,
        categoryData: [] as { name: string; value: number }[],
        lifeAreaData: [] as { name: string; value: number }[],
        monthlyData: [] as { month: string; count: number }[],
        monthlyHasData: false,
        intensityDistribution: [] as { intensity: number; count: number }[],
        topCategoryKey: null as MemoryCategory | null,
        mostActiveMonth: null as string | null,
        daysSinceLastMemory: null as number | null,
      }
    }

    const totalMemories = memories.length
    const coreMemories = memories.filter(m => m.isCore).length
    const coreRatio = totalMemories > 0 ? Math.round((coreMemories / totalMemories) * 100) : 0

    // Guard against null/undefined/out-of-range intensity from legacy cloud rows
    // so averages and the distribution never render NaN. Default missing values
    // to 5 (the documented write-path default in mapMemoryToSupabase).
    const normalizeIntensity = (raw: number | null | undefined): number => {
      const n = Number(raw)
      if (!Number.isFinite(n)) return 5
      return Math.min(10, Math.max(1, Math.round(n)))
    }
    const avgIntensity = memories.reduce((sum, m) => sum + normalizeIntensity(m.intensity), 0) / totalMemories

    // Category distribution — count EVERY tagged category so multi-tagged
    // memories aren't under-counted; fall back to the deprecated single
    // `category` only when the array is empty/missing.
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
      const cats = m.categories && m.categories.length > 0 ? m.categories : [m.category]
      cats.forEach(c => {
        if (c in categoryCount) categoryCount[c]++
      })
    })
    const categoryData = Object.entries(categoryCount)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => ({
        name: t(`categories.${key}`) || key,
        value,
      }))

    // Most frequent category key (for the highlights row).
    let topCategoryKey: MemoryCategory | null = null
    let topCategoryCount = 0
    ;(Object.entries(categoryCount) as [MemoryCategory, number][]).forEach(([key, value]) => {
      if (value > topCategoryCount) {
        topCategoryCount = value
        topCategoryKey = key
      }
    })

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
      .filter(([, value]) => value > 0)
      .map(([key, value]) => ({
        name: t(`lifeAreas.${key}`) || key,
        value,
      }))

    // Monthly data (last 6 months)
    const monthlyData: { month: string; count: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = date.toLocaleDateString(locale, { month: 'short' })
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      const count = memories.filter(m => {
        // Parse the bare YYYY-MM-DD as a LOCAL date so boundary entries aren't
        // mis-bucketed (new Date('YYYY-MM-DD') parses as UTC midnight).
        const memoryDate = parseLocalDate(m.date)
        return memoryDate >= monthStart && memoryDate <= monthEnd
      }).length
      monthlyData.push({ month: monthKey, count })
    }
    // Every bucket is zero when all memories predate the last 6 months — the bar
    // chart would render empty, so flag it to show a friendly note instead.
    const monthlyHasData = monthlyData.some(d => d.count > 0)

    // Intensity distribution
    const intensityCount: Record<number, number> = {}
    for (let i = 1; i <= 10; i++) {
      intensityCount[i] = 0
    }
    memories.forEach(m => {
      intensityCount[normalizeIntensity(m.intensity)]++
    })
    const intensityDistribution = Object.entries(intensityCount).map(([key, value]) => ({
      intensity: parseInt(key),
      count: value,
    }))

    // Most active month across ALL memories (not just the last 6).
    const monthBuckets = new Map<string, number>()
    memories.forEach(m => {
      const d = parseLocalDate(m.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      monthBuckets.set(key, (monthBuckets.get(key) || 0) + 1)
    })
    let mostActiveMonth: string | null = null
    let mostActiveCount = 0
    monthBuckets.forEach((count, key) => {
      if (count > mostActiveCount) {
        mostActiveCount = count
        const [y, mo] = key.split('-').map(Number)
        mostActiveMonth = new Date(y, mo, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
      }
    })

    // Days since the most recent memory.
    let latestTime = 0
    memories.forEach(m => {
      const time = parseLocalDate(m.date).getTime()
      if (time > latestTime) latestTime = time
    })
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysSinceLastMemory = latestTime > 0
      ? Math.max(0, Math.round((today.getTime() - latestTime) / (1000 * 60 * 60 * 24)))
      : null

    return {
      totalMemories,
      coreMemories,
      coreRatio,
      avgIntensity: Math.round(avgIntensity * 10) / 10,
      categoryData,
      lifeAreaData,
      monthlyData,
      monthlyHasData,
      intensityDistribution,
      topCategoryKey,
      mostActiveMonth,
      daysSinceLastMemory,
    }
  }, [memories, t, locale])

  // Top connection — group by normalized key, display the original casing
  // (first occurrence wins). Mirrors Profile.tsx.
  const topConnection = useMemo(() => {
    const connMap = new Map<string, { name: string; count: number }>()
    for (const memory of memories) {
      for (const conn of memory.connections) {
        const key = normalizeConnectionKey(conn)
        const entry = connMap.get(key)
        if (entry) {
          entry.count += 1
        } else {
          connMap.set(key, { name: cleanConnectionName(conn), count: 1 })
        }
      }
    }
    let top: { name: string; count: number } | null = null
    connMap.forEach(entry => {
      if (!top || entry.count > top.count) top = entry
    })
    return top as { name: string; count: number } | null
  }, [memories])

  // Merge badges + achievements into a single goal list. Achievements carry
  // real progress/target; badges are all-or-nothing (target 1, full/empty).
  const goalItems = useMemo(() => {
    const fromAchievements = achievements.map(a => ({
      id: `achievement-${a.id}`,
      icon: a.icon,
      name: lang === 'tr' ? a.name : a.nameEn,
      description: lang === 'tr' ? a.description : a.descriptionEn,
      progress: a.progress,
      target: a.target,
      unlocked: a.unlocked,
    }))
    const fromBadges = badges.map(b => ({
      id: `badge-${b.id}`,
      icon: b.icon,
      name: lang === 'tr' ? b.name : b.nameEn,
      description: lang === 'tr' ? b.description : b.descriptionEn,
      progress: b.unlocked ? 1 : 0,
      target: 1,
      unlocked: b.unlocked,
    }))
    return [...fromAchievements, ...fromBadges]
  }, [achievements, badges, lang])

  const goalsTotal = badges.length + achievements.length
  const goalsUnlocked = badges.filter(b => b.unlocked).length + achievements.filter(a => a.unlocked).length

  const containerClass = 'max-w-4xl mx-auto px-5 sm:px-6 lg:px-8 py-8 sm:py-10'

  // Sticky compact header shared across all states.
  const Header = (
    <div className="sticky top-0 z-20 -mx-5 sm:-mx-6 lg:-mx-8 px-5 sm:px-6 lg:px-8 py-3 mb-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          aria-label={t('back')}
          className="p-2 -ml-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {t('insightsTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
            {t('insightsSubtitle')}
          </p>
        </div>
      </div>
    </div>
  )

  if (loading || !hasAttemptedLoad) {
    return (
      <div className={containerClass}>
        {Header}
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  // A failed load leaves memories empty too, so show a distinct error+retry
  // state BEFORE the empty state — otherwise the UI lies about the data state.
  if (error) {
    return (
      <div className={containerClass}>
        {Header}
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <div className="p-4 rounded-full bg-red-50 dark:bg-red-900/20 mb-4">
            <AlertCircle className="text-red-500 dark:text-red-400" size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            {t('loadError')}
          </h3>
          <button
            type="button"
            onClick={() => { void refreshMemories() }}
            className="inline-flex items-center gap-2 px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg transition-all touch-manipulation"
          >
            <RefreshCw size={18} />
            {t('tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  if (memories.length === 0) {
    return (
      <div className={containerClass}>
        {Header}
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <motion.div
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.1, 1] }}
            transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
            className="p-4 rounded-full bg-primary/10 border-2 border-primary mb-5"
          >
            <BarChart3 className="text-primary" size={40} />
          </motion.div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {t('insightsNoData')}
          </h3>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/vault?action=add')}
            className="mt-2 px-8 py-4 gradient-primary text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all touch-manipulation"
          >
            {t('addMemory')}
          </motion.button>
        </div>
      </div>
    )
  }

  const tabs: { key: TabKey; label: string; icon: typeof LayoutGrid }[] = [
    { key: 'overview', label: t('insightsTabOverview'), icon: LayoutGrid },
    { key: 'trends', label: t('insightsTabTrends'), icon: BarChart3 },
    { key: 'goals', label: t('insightsTabGoals'), icon: Target },
  ]

  const kpis = [
    { icon: Heart, label: t('totalMemories'), value: `${stats.totalMemories}` },
    { icon: Flame, label: t('streak'), value: `${streak.currentStreak}`, unit: t('daysUnit', { count: streak.currentStreak }) },
    { icon: TrendingUp, label: t('longestStreak'), value: `${streak.longestStreak}`, unit: t('daysUnit', { count: streak.longestStreak }) },
    { icon: Gauge, label: t('avgIntensity'), value: `${stats.avgIntensity}`, unit: '/10' },
    { icon: Sparkles, label: t('coreRatio'), value: `${stats.coreRatio}%` },
  ]

  const highlights = [
    {
      icon: Tag,
      label: t('topCategory'),
      value: stats.topCategoryKey ? (t(`categories.${stats.topCategoryKey}`) || '—') : '—',
    },
    {
      icon: Users,
      label: t('topConnection'),
      value: topConnection ? topConnection.name : '—',
    },
    {
      icon: CalendarDays,
      label: t('mostActiveMonth'),
      value: stats.mostActiveMonth || '—',
    },
    {
      icon: Clock,
      label: t('daysSinceLastMemory'),
      value: stats.daysSinceLastMemory !== null
        ? `${stats.daysSinceLastMemory} ${t('daysUnit', { count: stats.daysSinceLastMemory })}`
        : '—',
    },
  ]

  return (
    <div className={containerClass}>
      {Header}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all touch-manipulation ${
              activeTab === key
                ? 'bg-white dark:bg-gray-700 text-primary shadow-md'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Icon size={16} />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
              {kpis.map(({ icon: Icon, label, value, unit }, index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 hover:border-primary/30 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="text-primary" size={18} />
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium truncate">
                      {label}
                    </p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {value}
                    {unit && <span className="text-sm font-medium text-gray-400 dark:text-gray-500 ml-1">{unit}</span>}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Highlights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-3xl p-5 sm:p-6"
            >
              <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Sparkles className="text-primary" size={22} />
                {t('statsHighlights')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {highlights.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl p-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="text-primary" size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
                      <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* TRENDS */}
        {activeTab === 'trends' && (
          <motion.div
            key="trends"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 sm:space-y-8"
          >
            {/* Monthly Trend */}
            <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Calendar className="text-primary" size={22} />
                {t('monthlyTrend')}
              </h2>
              {stats.monthlyHasData ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" tick={{ className: 'fill-gray-500 dark:fill-gray-400 text-xs' }} />
                    <YAxis allowDecimals={false} tick={{ className: 'fill-gray-500 dark:fill-gray-400 text-xs' }} />
                    <Tooltip content={<CustomTooltip seriesLabel={t('memories')} />} />
                    <Bar dataKey="count" fill="#FF6B35" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center text-center text-gray-500 dark:text-gray-400 text-sm sm:text-base" style={{ height: 250 }}>
                  {t('noRecentMonthlyData')}
                </div>
              )}
            </div>

            {/* Category Distribution */}
            {stats.categoryData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <Heart className="text-primary" size={22} />
                  {t('categoryDistribution')}
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderPieLabel}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stats.categoryData.map((_entry: { name: string; value: number }, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Intensity Distribution */}
            <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <TrendingUp className="text-primary" size={22} />
                {t('intensityDistribution')}
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.intensityDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="intensity" tick={{ className: 'fill-gray-500 dark:fill-gray-400 text-xs' }} />
                  <YAxis allowDecimals={false} tick={{ className: 'fill-gray-500 dark:fill-gray-400 text-xs' }} />
                  <Tooltip content={<CustomTooltip seriesLabel={t('memories')} />} />
                  <Bar dataKey="count" fill="#FF6B35" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Life Area Distribution */}
            {stats.lifeAreaData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <Sparkles className="text-primary" size={22} />
                  {t('lifeAreaDistribution')}
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.lifeAreaData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderPieLabel}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stats.lifeAreaData.map((_entry: { name: string; value: number }, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        )}

        {/* GOALS */}
        {activeTab === 'goals' && (
          <motion.div
            key="goals"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Unlocked summary */}
            <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <Trophy className="text-primary" size={24} />
                <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  {t('goalsUnlocked', { count: goalsUnlocked, total: goalsTotal })}
                </h2>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${goalsTotal > 0 ? (goalsUnlocked / goalsTotal) * 100 : 0}%` }}
                  transition={{ duration: 0.5 }}
                  className="bg-gradient-to-r from-primary to-primary-dark h-2 rounded-full"
                />
              </div>
            </div>

            {/* Merged goal list */}
            <div className="space-y-4">
              {goalItems.map((goal, index) => (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.4) }}
                  className={`bg-white dark:bg-gray-800 border-2 rounded-2xl p-4 sm:p-5 transition-all ${
                    goal.unlocked
                      ? 'border-primary/50 shadow-lg'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`text-4xl sm:text-5xl flex-shrink-0 ${goal.unlocked ? '' : 'opacity-50 grayscale'}`}>
                      {goal.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">
                          {goal.name}
                        </h3>
                        {goal.unlocked && (
                          <CheckCircle2 className="text-primary flex-shrink-0" size={18} />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {goal.description}
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">
                            {goal.progress} / {goal.target}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${goal.target > 0 ? Math.min((goal.progress / goal.target) * 100, 100) : 0}%` }}
                            transition={{ duration: 0.5 }}
                            className={`h-full rounded-full ${
                              goal.unlocked
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
