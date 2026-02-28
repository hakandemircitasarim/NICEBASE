export type MemoryCategory = 'uncategorized' | 'success' | 'peace' | 'fun' | 'love' | 'gratitude' | 'inspiration' | 'growth' | 'adventure'
export type LifeArea = 'uncategorized' | 'personal' | 'work' | 'relationship' | 'family' | 'friends' | 'hobby' | 'travel' | 'health'

export interface Memory {
  id: string
  userId: string
  text: string
  category: MemoryCategory // Deprecated: use categories instead, kept for backward compatibility
  categories?: MemoryCategory[] // New: array of categories (multi-select)
  intensity: number // 1-10
  date: string // ISO date string
  connections: string[] // Array of connection names/ids
  lifeArea: LifeArea
  isCore: boolean
  photos: string[] // Array of photo URLs or base64
  createdAt: string
  updatedAt: string
  synced: boolean // Whether synced to cloud
  conflict?: boolean
  conflictCloud?: Memory
  conflictDetectedAt?: string
}

export interface Connection {
  id: string
  userId: string
  name: string
  type: 'person' | 'place' | 'thing' | 'project'
  createdAt: string
}

export interface User {
  id: string
  email: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null // base64 or URL
  birthday: string | null // ISO date string
  location: string | null
  isPremium: boolean
  aiyaMessagesUsed: number
  aiyaMessagesLimit: number
  weeklySummaryDay: number | null // 0-6, Sunday-Saturday
  dailyReminderTime: string | null // HH:mm format
  language: 'tr' | 'en'
  theme: 'light' | 'dark' | 'auto'
  createdAt: string
}

export interface AIAnalysis {
  id: string
  userId: string
  emotionalTrends: string
  standoutMemories: string[]
  patterns: string
  recommendations: string
  createdAt: string
}

export interface WeeklySummary {
  id: string
  userId: string
  weekStart: string
  weekEnd: string
  summary: string
  createdAt: string
}

export interface DailyQuestion {
  id: string
  questionTr: string
  questionEn: string
  date: string // ISO date string (YYYY-MM-DD)
  createdAt: string
}

export interface DailyQuestionAnswer {
  id: string
  userId: string
  questionId: string
  answerText: string
  memoryId: string | null
  isPublic: boolean
  createdAt: string
}
