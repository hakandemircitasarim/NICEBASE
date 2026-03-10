import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Memory } from '../../types'

// Mock memoryService (not needed when we pass existingMemories)
vi.mock('../memoryService', () => ({
  memoryService: { getAll: vi.fn().mockResolvedValue([]) },
}))

// Mock i18n
vi.mock('../../i18n', () => ({
  default: { t: (key: string) => key },
}))

import { streakService } from '../streakService'

/** Helper: create a minimal Memory with the given ISO date string */
function makeMemory(date: string): Memory {
  return {
    id: crypto.randomUUID(),
    userId: 'test-user',
    text: 'Test memory text content',
    category: 'uncategorized',
    intensity: 5,
    date,
    connections: [],
    lifeArea: 'personal',
    isCore: false,
    photos: [],
    createdAt: date,
    updatedAt: date,
    synced: false,
  }
}

/** Helper: produce an ISO date string N days ago from today */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

describe('streakService.calculateStreak', () => {
  it('returns zeros for no memories', async () => {
    const result = await streakService.calculateStreak('user1', [])
    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastMemoryDate: null,
      streakStartDate: null,
    })
  })

  it('returns streak of 1 for a single memory today', async () => {
    const today = daysAgo(0)
    const result = await streakService.calculateStreak('user1', [makeMemory(today)])
    expect(result.currentStreak).toBe(1)
    expect(result.longestStreak).toBe(1)
    expect(result.lastMemoryDate).toBe(today)
  })

  it('returns streak of 1 for a single memory yesterday', async () => {
    const yesterday = daysAgo(1)
    const result = await streakService.calculateStreak('user1', [makeMemory(yesterday)])
    expect(result.currentStreak).toBe(1)
    expect(result.longestStreak).toBe(1)
  })

  it('returns 0 current streak for memory 2 days ago', async () => {
    const twoDaysAgo = daysAgo(2)
    const result = await streakService.calculateStreak('user1', [makeMemory(twoDaysAgo)])
    expect(result.currentStreak).toBe(0)
    expect(result.longestStreak).toBe(1)
  })

  it('calculates consecutive day streak correctly', async () => {
    const memories = [
      makeMemory(daysAgo(0)),
      makeMemory(daysAgo(1)),
      makeMemory(daysAgo(2)),
      makeMemory(daysAgo(3)),
      makeMemory(daysAgo(4)),
    ]
    const result = await streakService.calculateStreak('user1', memories)
    expect(result.currentStreak).toBe(5)
    expect(result.longestStreak).toBe(5)
  })

  it('handles gaps between streaks', async () => {
    // Current streak: today + yesterday (2 days)
    // Old streak: 5 days ago through 8 days ago (4 days)
    const memories = [
      makeMemory(daysAgo(0)),
      makeMemory(daysAgo(1)),
      // gap at daysAgo(2), daysAgo(3), daysAgo(4)
      makeMemory(daysAgo(5)),
      makeMemory(daysAgo(6)),
      makeMemory(daysAgo(7)),
      makeMemory(daysAgo(8)),
    ]
    const result = await streakService.calculateStreak('user1', memories)
    expect(result.currentStreak).toBe(2)
    expect(result.longestStreak).toBe(4) // the old streak was longer
  })

  it('deduplicates same-day memories', async () => {
    const today = daysAgo(0)
    const memories = [
      makeMemory(today),
      makeMemory(today),
      makeMemory(today),
    ]
    const result = await streakService.calculateStreak('user1', memories)
    expect(result.currentStreak).toBe(1)
  })

  it('handles 7-day streak (weekly milestone)', async () => {
    const memories = Array.from({ length: 7 }, (_, i) => makeMemory(daysAgo(i)))
    const result = await streakService.calculateStreak('user1', memories)
    expect(result.currentStreak).toBe(7)
    expect(result.longestStreak).toBe(7)
  })

  it('handles 30-day streak (monthly milestone)', async () => {
    const memories = Array.from({ length: 30 }, (_, i) => makeMemory(daysAgo(i)))
    const result = await streakService.calculateStreak('user1', memories)
    expect(result.currentStreak).toBe(30)
    expect(result.longestStreak).toBe(30)
  })
})

describe('streakService.getStreakReward', () => {
  const t = (key: string) => key

  it('returns empty for streak < 3', () => {
    expect(streakService.getStreakReward(0, t)).toBe('')
    expect(streakService.getStreakReward(2, t)).toBe('')
  })

  it('returns gettingStarted for 3-6', () => {
    expect(streakService.getStreakReward(3, t)).toContain('gettingStarted')
    expect(streakService.getStreakReward(6, t)).toContain('gettingStarted')
  })

  it('returns oneWeek for 7-13', () => {
    expect(streakService.getStreakReward(7, t)).toContain('oneWeek')
  })

  it('returns twoWeeks for 14-29', () => {
    expect(streakService.getStreakReward(14, t)).toContain('twoWeeks')
  })

  it('returns magnificent for 30-49', () => {
    expect(streakService.getStreakReward(30, t)).toContain('magnificent')
  })

  it('returns amazing for 50-99', () => {
    expect(streakService.getStreakReward(50, t)).toContain('amazing')
  })

  it('returns legendary for 100+', () => {
    expect(streakService.getStreakReward(100, t)).toContain('legendary')
    expect(streakService.getStreakReward(200, t)).toContain('legendary')
  })
})

describe('streakService.checkStreakMilestone', () => {
  const t = (key: string) => key

  it('returns message for milestone values', async () => {
    for (const milestone of [3, 7, 14, 30, 50, 100]) {
      const result = await streakService.checkStreakMilestone('user1', milestone, t)
      expect(result).toBeTruthy()
    }
  })

  it('returns null for non-milestone values', async () => {
    expect(await streakService.checkStreakMilestone('user1', 5, t)).toBeNull()
    expect(await streakService.checkStreakMilestone('user1', 10, t)).toBeNull()
    expect(await streakService.checkStreakMilestone('user1', 25, t)).toBeNull()
  })
})
