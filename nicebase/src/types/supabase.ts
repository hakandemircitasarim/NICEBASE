/**
 * Type definitions for Supabase database rows and responses
 */

import { User, Memory } from './index'

/**
 * Supabase users table row format (snake_case)
 */
export interface SupabaseUserRow {
  id: string
  email: string
  display_name?: string | null
  displayName?: string | null // Support camelCase for backward compatibility
  bio?: string | null
  avatar_url?: string | null
  avatarUrl?: string | null // Support camelCase for backward compatibility
  birthday?: string | null
  location?: string | null
  is_premium?: boolean
  isPremium?: boolean // Support camelCase for backward compatibility
  aiya_messages_used?: number
  aiyaMessagesUsed?: number // Support camelCase for backward compatibility
  aiya_messages_limit?: number
  aiyaMessagesLimit?: number // Support camelCase for backward compatibility
  weekly_summary_day?: number | null
  weeklySummaryDay?: number | null // Support camelCase for backward compatibility
  daily_reminder_time?: string | null
  dailyReminderTime?: string | null // Support camelCase for backward compatibility
  language?: 'tr' | 'en'
  theme?: 'light' | 'dark' | 'auto'
  created_at?: string
  createdAt?: string // Support camelCase for backward compatibility
}

/**
 * Supabase memories table row format (snake_case)
 * This is already defined in memoryMapper.ts as SupabaseMemoryRow,
 * but we export it here for consistency
 */
export interface SupabaseMemoryRow {
  id: string
  user_id?: string
  userId?: string // Support camelCase for backward compatibility
  text: string
  category?: string
  intensity?: number
  date?: string
  connections?: string[]
  life_area?: string
  lifeArea?: string // Support camelCase for backward compatibility
  is_core?: boolean
  isCore?: boolean // Support camelCase for backward compatibility
  photos?: string[]
  created_at?: string
  createdAt?: string // Support camelCase for backward compatibility
  updated_at?: string
  updatedAt?: string // Support camelCase for backward compatibility
}

/**
 * Supabase error response structure
 */
export interface SupabaseError {
  message?: string
  code?: string
  details?: string
  hint?: string
  status?: number
}

/**
 * Supabase query response wrapper
 */
export interface SupabaseResponse<T> {
  data: T | null
  error: SupabaseError | null
}

/**
 * Supabase upsert options
 */
export interface SupabaseUpsertOptions {
  onConflict?: string
}
