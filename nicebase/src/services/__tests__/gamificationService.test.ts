import { describe, it, expect, vi } from 'vitest'
import { Memory } from '../../types'

// Mock streakService
vi.mock('../streakService', () => ({
  streakService: {
    calculateStreak: vi.fn().mockResolvedValue({
      currentStreak: 0,
      longestStreak: 0,
      lastMemoryDate: null,
      streakStartDate: null,
    }),
  },
}))

// Mock memoryService
vi.mock('../memoryService', () => ({
  memoryService: { getAll: vi.fn().mockResolvedValue([]) },
}))

// Mock i18n
vi.mock('../../i18n', () => ({
  default: { t: (key: string) => key },
}))

import { gamificationService } from '../gamificationService'
import { streakService } from '../streakService'

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: crypto.randomUUID(),
    userId: 'test-user',
    text: 'Test memory text content',
    category: 'uncategorized',
    intensity: 5,
    date: '2024-01-01',
    connections: [],
    lifeArea: 'personal',
    isCore: false,
    photos: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    synced: false,
    ...overrides,
  }
}

describe('gamificationService.getBadges', () => {
  it('all badges locked with 0 memories', async () => {
    const badges = await gamificationService.getBadges('user1', [])
    expect(badges.every(b => !b.unlocked)).toBe(true)
  })

  it('first-memory badge unlocked with 1 memory', async () => {
    const badges = await gamificationService.getBadges('user1', [makeMemory()])
    const firstMemory = badges.find(b => b.id === 'first-memory')
    expect(firstMemory?.unlocked).toBe(true)
  })

  it('collector badge unlocked at 10 memories', async () => {
    const memories = Array.from({ length: 10 }, () => makeMemory())
    const badges = await gamificationService.getBadges('user1', memories)
    expect(badges.find(b => b.id === 'memory-collector')?.unlocked).toBe(true)
  })

  it('collector badge locked at 9 memories', async () => {
    const memories = Array.from({ length: 9 }, () => makeMemory())
    const badges = await gamificationService.getBadges('user1', memories)
    expect(badges.find(b => b.id === 'memory-collector')?.unlocked).toBe(false)
  })

  it('master badge unlocked at 50 memories', async () => {
    const memories = Array.from({ length: 50 }, () => makeMemory())
    const badges = await gamificationService.getBadges('user1', memories)
    expect(badges.find(b => b.id === 'memory-master')?.unlocked).toBe(true)
  })

  it('core-creator badge unlocked at 5 core memories', async () => {
    const memories = Array.from({ length: 5 }, () => makeMemory({ isCore: true }))
    const badges = await gamificationService.getBadges('user1', memories)
    expect(badges.find(b => b.id === 'core-creator')?.unlocked).toBe(true)
  })

  it('core-creator badge locked at 4 core memories', async () => {
    const memories = Array.from({ length: 4 }, () => makeMemory({ isCore: true }))
    const badges = await gamificationService.getBadges('user1', memories)
    expect(badges.find(b => b.id === 'core-creator')?.unlocked).toBe(false)
  })

  it('category-explorer unlocked with 4+ categories', async () => {
    const categories = ['success', 'peace', 'fun', 'love'] as const
    const memories = categories.map(c => makeMemory({ category: c }))
    const badges = await gamificationService.getBadges('user1', memories)
    expect(badges.find(b => b.id === 'category-explorer')?.unlocked).toBe(true)
  })

  it('category-explorer locked with 3 categories', async () => {
    const categories = ['success', 'peace', 'fun'] as const
    const memories = categories.map(c => makeMemory({ category: c }))
    const badges = await gamificationService.getBadges('user1', memories)
    expect(badges.find(b => b.id === 'category-explorer')?.unlocked).toBe(false)
  })

  it('social-butterfly unlocked with 10 unique connections', async () => {
    const memories = Array.from({ length: 10 }, (_, i) =>
      makeMemory({ connections: [`Person${i}`] })
    )
    const badges = await gamificationService.getBadges('user1', memories)
    expect(badges.find(b => b.id === 'social-butterfly')?.unlocked).toBe(true)
  })

  it('social-butterfly normalizes connections (case-insensitive)', async () => {
    // "ali" and "Ali" are the same — only 2 unique connections
    const memories = [
      makeMemory({ connections: ['ali'] }),
      makeMemory({ connections: ['Ali'] }),
      makeMemory({ connections: ['veli'] }),
    ]
    const badges = await gamificationService.getBadges('user1', memories)
    expect(badges.find(b => b.id === 'social-butterfly')?.unlocked).toBe(false)
  })

  it('intensity-master unlocked with a 10/10 memory', async () => {
    const memories = [makeMemory({ intensity: 10 })]
    const badges = await gamificationService.getBadges('user1', memories)
    expect(badges.find(b => b.id === 'intensity-master')?.unlocked).toBe(true)
  })

  it('intensity-master locked if max intensity is 9', async () => {
    const memories = [makeMemory({ intensity: 9 })]
    const badges = await gamificationService.getBadges('user1', memories)
    expect(badges.find(b => b.id === 'intensity-master')?.unlocked).toBe(false)
  })

  it('streak-7 badge unlocked with 7+ day streak', async () => {
    vi.mocked(streakService.calculateStreak).mockResolvedValueOnce({
      currentStreak: 7,
      longestStreak: 7,
      lastMemoryDate: '2024-01-07',
      streakStartDate: '2024-01-01',
    })
    const badges = await gamificationService.getBadges('user1', [makeMemory()])
    expect(badges.find(b => b.id === 'streak-7')?.unlocked).toBe(true)
  })

  it('streak-30 badge locked with 29-day streak', async () => {
    vi.mocked(streakService.calculateStreak).mockResolvedValueOnce({
      currentStreak: 29,
      longestStreak: 29,
      lastMemoryDate: '2024-01-29',
      streakStartDate: '2024-01-01',
    })
    const badges = await gamificationService.getBadges('user1', [makeMemory()])
    expect(badges.find(b => b.id === 'streak-30')?.unlocked).toBe(false)
  })
})

describe('gamificationService.getAchievements', () => {
  it('memory-milestone-100 tracks progress', async () => {
    const memories = Array.from({ length: 42 }, () => makeMemory())
    const achievements = await gamificationService.getAchievements('user1', memories)
    const milestone = achievements.find(a => a.id === 'memory-milestone-100')
    expect(milestone?.progress).toBe(42)
    expect(milestone?.target).toBe(100)
    expect(milestone?.unlocked).toBe(false)
  })

  it('memory-milestone-100 unlocked at 100', async () => {
    const memories = Array.from({ length: 100 }, () => makeMemory())
    const achievements = await gamificationService.getAchievements('user1', memories)
    expect(achievements.find(a => a.id === 'memory-milestone-100')?.unlocked).toBe(true)
  })

  it('high-intensity tracks average', async () => {
    // 3 memories with intensity 9 → avg = 9 → progress = 90
    const memories = Array.from({ length: 3 }, () => makeMemory({ intensity: 9 }))
    const achievements = await gamificationService.getAchievements('user1', memories)
    const highEnergy = achievements.find(a => a.id === 'high-intensity')
    expect(highEnergy?.progress).toBe(90) // Math.round(9 * 10)
    expect(highEnergy?.unlocked).toBe(true) // avgIntensity >= 8
  })

  it('high-intensity locked with low average', async () => {
    const memories = Array.from({ length: 3 }, () => makeMemory({ intensity: 3 }))
    const achievements = await gamificationService.getAchievements('user1', memories)
    expect(achievements.find(a => a.id === 'high-intensity')?.unlocked).toBe(false)
  })

  it('core-milestone-20 tracks core memory count', async () => {
    const memories = Array.from({ length: 8 }, () => makeMemory({ isCore: true }))
    const achievements = await gamificationService.getAchievements('user1', memories)
    const coreMilestone = achievements.find(a => a.id === 'core-milestone-20')
    expect(coreMilestone?.progress).toBe(8)
    expect(coreMilestone?.unlocked).toBe(false)
  })
})
