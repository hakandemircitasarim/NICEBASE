import { Memory } from '../types'
import { memoryService } from './memoryService'
import { streakService } from './streakService'
import { normalizeConnectionKey } from '../utils/connections'

export interface Badge {
  id: string
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  icon: string // Emoji icon
  unlocked: boolean
  unlockedAt: string | null
}

export interface Achievement {
  id: string
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  icon: string
  progress: number
  target: number
  unlocked: boolean
}

export const gamificationService = {
  async getBadges(userId: string, memories: Memory[]): Promise<Badge[]> {
    const streak = await streakService.calculateStreak(userId)
    const totalMemories = memories.length
    const coreMemories = memories.filter(m => m.isCore).length
    const categories = new Set(memories.map(m => m.category)).size
    const lifeAreas = new Set(memories.map(m => m.lifeArea)).size
    const connections = new Set(memories.flatMap(m => m.connections).map(normalizeConnectionKey)).size

    const badges: Badge[] = [
      {
        id: 'first-memory',
        name: 'İlk Adım',
        nameEn: 'First Step',
        description: 'İlk anını kaydet',
        descriptionEn: 'Save your first memory',
        icon: '🎯',
        unlocked: totalMemories >= 1,
        unlockedAt: totalMemories >= 1 ? memories[0]?.createdAt || null : null,
      },
      {
        id: 'memory-collector',
        name: 'Koleksiyoncu',
        nameEn: 'Collector',
        description: '10 anı kaydet',
        descriptionEn: 'Save 10 memories',
        icon: '📚',
        unlocked: totalMemories >= 10,
        unlockedAt: totalMemories >= 10 ? memories[9]?.createdAt || null : null,
      },
      {
        id: 'memory-master',
        name: 'Usta',
        nameEn: 'Master',
        description: '50 anı kaydet',
        descriptionEn: 'Save 50 memories',
        icon: '👑',
        unlocked: totalMemories >= 50,
        unlockedAt: totalMemories >= 50 ? memories[49]?.createdAt || null : null,
      },
      {
        id: 'core-creator',
        name: 'Çekirdek Yaratıcı',
        nameEn: 'Core Creator',
        description: '5 çekirdek anı oluştur',
        descriptionEn: 'Create 5 core memories',
        icon: '⭐',
        unlocked: coreMemories >= 5,
        unlockedAt: null,
      },
      {
        id: 'streak-7',
        name: 'Haftalık Seri',
        nameEn: 'Weekly Streak',
        description: '7 gün üst üste anı kaydet',
        descriptionEn: 'Save memories for 7 days in a row',
        icon: '🔥',
        unlocked: streak.currentStreak >= 7,
        unlockedAt: null,
      },
      {
        id: 'streak-30',
        name: 'Aylık Seri',
        nameEn: 'Monthly Streak',
        description: '30 gün üst üste anı kaydet',
        descriptionEn: 'Save memories for 30 days in a row',
        icon: '💪',
        unlocked: streak.currentStreak >= 30,
        unlockedAt: null,
      },
      {
        id: 'category-explorer',
        name: 'Kategori Kaşifi',
        nameEn: 'Category Explorer',
        description: 'Tüm kategorilerde anı oluştur',
        descriptionEn: 'Create memories in all categories',
        icon: '🌈',
        unlocked: categories >= 4,
        unlockedAt: null,
      },
      {
        id: 'life-explorer',
        name: 'Yaşam Kaşifi',
        nameEn: 'Life Explorer',
        description: 'Tüm yaşam alanlarında anı oluştur',
        descriptionEn: 'Create memories in all life areas',
        icon: '🌍',
        unlocked: lifeAreas >= 8,
        unlockedAt: null,
      },
      {
        id: 'social-butterfly',
        name: 'Sosyal Kelebek',
        nameEn: 'Social Butterfly',
        description: '10 farklı bağlantı ile anı oluştur',
        descriptionEn: 'Create memories with 10 different connections',
        icon: '🦋',
        unlocked: connections >= 10,
        unlockedAt: null,
      },
      {
        id: 'intensity-master',
        name: 'Yoğunluk Ustası',
        nameEn: 'Intensity Master',
        description: '10/10 yoğunluğunda anı oluştur',
        descriptionEn: 'Create a memory with 10/10 intensity',
        icon: '⚡',
        unlocked: memories.some(m => m.intensity === 10),
        unlockedAt: memories.find(m => m.intensity === 10)?.createdAt || null,
      },
    ]

    return badges
  },

  async getAchievements(userId: string, memories: Memory[]): Promise<Achievement[]> {
    const streak = await streakService.calculateStreak(userId)
    const totalMemories = memories.length
    const coreMemories = memories.filter(m => m.isCore).length
    const avgIntensity = memories.length > 0
      ? memories.reduce((sum, m) => sum + m.intensity, 0) / memories.length
      : 0

    const achievements: Achievement[] = [
      {
        id: 'memory-milestone-100',
        name: 'Yüzlerce Anı',
        nameEn: 'Hundred Memories',
        description: '100 anı kaydet',
        descriptionEn: 'Save 100 memories',
        icon: '💯',
        progress: totalMemories,
        target: 100,
        unlocked: totalMemories >= 100,
      },
      {
        id: 'core-milestone-20',
        name: 'Çekirdek Koleksiyon',
        nameEn: 'Core Collection',
        description: '20 çekirdek anı oluştur',
        descriptionEn: 'Create 20 core memories',
        icon: '💎',
        progress: coreMemories,
        target: 20,
        unlocked: coreMemories >= 20,
      },
      {
        id: 'streak-milestone-100',
        name: 'Efsanevi Seri',
        nameEn: 'Legendary Streak',
        description: '100 gün üst üste anı kaydet',
        descriptionEn: 'Save memories for 100 days in a row',
        icon: '🏆',
        progress: streak.currentStreak,
        target: 100,
        unlocked: streak.currentStreak >= 100,
      },
      {
        id: 'high-intensity',
        name: 'Yüksek Enerji',
        nameEn: 'High Energy',
        description: 'Ortalama yoğunluk 8+ olsun',
        descriptionEn: 'Average intensity of 8+',
        icon: '🚀',
        progress: Math.round(avgIntensity * 10),
        target: 80,
        unlocked: avgIntensity >= 8,
      },
    ]

    return achievements
  },
}





