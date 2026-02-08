import { Memory } from '../types'
import { memoryService } from './memoryService'
import i18n from '../i18n'

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

    // Get unique dates
    const memoryDates = new Set(
      memories.map(m => m.date.split('T')[0]).sort().reverse()
    )

    const sortedDates = Array.from(memoryDates)
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    let lastDate: Date | null = null
    let streakStartDate: string | null = null
    let currentStreakStart: string | null = null

    for (const dateStr of sortedDates) {
      const date = new Date(dateStr)
      date.setHours(0, 0, 0, 0)

      if (lastDate === null) {
        lastDate = date
        tempStreak = 1
        currentStreak = 1
        longestStreak = 1
        currentStreakStart = dateStr
        streakStartDate = dateStr
        continue
      }

      const diffDays = Math.floor((lastDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        // Consecutive day
        tempStreak++
        if (currentStreakStart === null) {
          currentStreakStart = dateStr
        }
        longestStreak = Math.max(longestStreak, tempStreak)
      } else if (diffDays === 0) {
        // Same day, continue
        continue
      } else {
        // Gap in streak
        if (tempStreak > currentStreak) {
          currentStreak = tempStreak
          streakStartDate = currentStreakStart
        }
        tempStreak = 1
        currentStreakStart = dateStr
      }

      lastDate = date
    }

    // Check if current streak is active (last memory is today or yesterday)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const lastMemoryDate = new Date(sortedDates[0])
    lastMemoryDate.setHours(0, 0, 0, 0)
    const daysSinceLastMemory = Math.floor((today.getTime() - lastMemoryDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSinceLastMemory > 1) {
      // Streak broken
      currentStreak = 0
      streakStartDate = null
    } else {
      currentStreak = tempStreak
      if (streakStartDate === null) {
        streakStartDate = currentStreakStart
      }
    }

    return {
      currentStreak,
      longestStreak,
      lastMemoryDate: sortedDates[0] || null,
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

