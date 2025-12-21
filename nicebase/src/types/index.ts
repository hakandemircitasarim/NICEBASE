export type MemoryCategory = 'success' | 'peace' | 'fun' | 'love' | 'gratitude' | 'inspiration' | 'growth' | 'adventure'
export type LifeArea = 'personal' | 'work' | 'relationship' | 'family' | 'friends' | 'hobby' | 'travel' | 'health'

export interface Memory {
  id: string
  userId: string
  text: string
  category: MemoryCategory
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
  is_premium?: boolean
  isPremium: boolean
  aiya_messages_used?: number
  aiyaMessagesUsed: number
  aiya_messages_limit?: number
  aiyaMessagesLimit: number
  weekly_summary_day?: number | null
  weeklySummaryDay: number | null // 0-6, Sunday-Saturday
  daily_reminder_time?: string | null
  dailyReminderTime: string | null // HH:mm format
  language: 'tr' | 'en'
  theme: 'light' | 'dark' | 'auto'
  created_at?: string
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

export interface DailyPrompt {
  id: string
  question: string
  questionEn: string
  date: string
}

