import { Memory } from '../types'
import { memoryService } from './memoryService'
import i18n from '../i18n'
import { parseLocalDate } from '../utils/dateFormat'

export interface StreakData {
  currentStreak: number
  longestStreak: number
  lastMemoryDate: string | null
  streakStartDate: string | null
}

export const streakService = {
  /**
   * Calculate streak data.
   * @param userId - used to fetch memories when `existingMemories` is not provided
   * @param existingMemories - optional pre-loaded memories to avoid duplicate DB calls
   */
  async calculateStreak(userId: string, existingMemories?: Memory[]): Promise<StreakData> {
    const memories = existingMemories ?? await memoryService.getAll(userId)

    if (memories.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastMemoryDate: null,
        streakStartDate: null,
      }
    }

    // Local "today" at midnight — used both to drop future-dated entries below
    // and to decide whether the latest streak is still active.
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get unique dates sorted ascending (oldest first). Drop any entry whose
    // calendar date is in the FUTURE relative to local today (clock skew or
    // imported data), so a mistakenly future-dated memory can't keep a streak
    // flagged active.
    const uniqueDates = Array.from(
      new Set(memories.map((m: Memory) => m.date.split('T')[0]))
    )
      .filter((d) => parseLocalDate(d).getTime() <= today.getTime())
      .sort()

    if (uniqueDates.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastMemoryDate: null,
        streakStartDate: null,
      }
    }

    // Build streaks by walking forward through sorted dates
    const streaks: { start: string; end: string; length: number }[] = []
    let streakStart = uniqueDates[0]
    let streakEnd = uniqueDates[0]
    let streakLength = 1

    for (let i = 1; i < uniqueDates.length; i++) {
      // Parse calendar dates at LOCAL midnight so day-deltas don't shift in
      // negative-UTC timezones.
      const prev = parseLocalDate(uniqueDates[i - 1])
      const curr = parseLocalDate(uniqueDates[i])
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        streakLength++
        streakEnd = uniqueDates[i]
      } else if (diffDays > 1) {
        streaks.push({ start: streakStart, end: streakEnd, length: streakLength })
        streakStart = uniqueDates[i]
        streakEnd = uniqueDates[i]
        streakLength = 1
      }
      // diffDays === 0 means duplicate date (shouldn't happen with Set), skip
    }
    // Push the final streak
    streaks.push({ start: streakStart, end: streakEnd, length: streakLength })

    // Longest streak
    const longestStreak = Math.max(...streaks.map((s) => s.length))

    // Current streak: the last streak segment, but only if it includes today or yesterday
    const lastStreak = streaks[streaks.length - 1]
    // Parse the stored calendar date at LOCAL midnight to match `today`.
    const lastStreakEnd = parseLocalDate(lastStreak.end)
    const daysSinceEnd = Math.round((today.getTime() - lastStreakEnd.getTime()) / (1000 * 60 * 60 * 24))

    // Active only when the last entry is today or yesterday. Guard the negative
    // side too: future-dated entries are already filtered out above, but this
    // keeps the check correct if a future date ever slips through.
    const isActive = daysSinceEnd >= 0 && daysSinceEnd <= 1
    const currentStreak = isActive ? lastStreak.length : 0
    const streakStartDate = isActive ? lastStreak.start : null

    const lastMemoryDate = uniqueDates[uniqueDates.length - 1] || null

    return {
      currentStreak,
      longestStreak,
      lastMemoryDate,
      streakStartDate,
    }
  },

  getStreakReward(streak: number, t?: (key: string) => string): string {
    const translate = t || ((key: string) => i18n.t(key))
    
    if (streak >= 100) return `${translate('legendary')} 🏆`
    if (streak >= 50) return `${translate('amazing')} 🌟`
    if (streak >= 30) return `${translate('magnificent')} 🔥`
    if (streak >= 14) return `${translate('twoWeeks')} 💪`
    if (streak >= 7) return `${translate('oneWeek')} ⭐`
    if (streak >= 3) return `${translate('gettingStarted')} ✨`
    return ''
  },

  async checkStreakMilestone(userId: string, newStreak: number, t?: (key: string) => string): Promise<string | null> {
    const milestones = [3, 7, 14, 30, 50, 100]
    const translate = t || ((key: string) => i18n.t(key))
    
    if (milestones.includes(newStreak)) {
      const reward = this.getStreakReward(newStreak, t)
      const dayText = translate('dayStreak')
      return `${reward} ${newStreak} ${dayText}!`
    }

    return null
  },
}

