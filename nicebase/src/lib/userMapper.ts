import { User } from '../types'
import { SupabaseUserRow } from '../types/supabase'

// Map Supabase snake_case to camelCase
export function mapUserFromSupabase(data: SupabaseUserRow): User {
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name ?? data.displayName ?? null,
    bio: data.bio ?? null,
    avatarUrl: data.avatar_url ?? data.avatarUrl ?? null,
    birthday: data.birthday ?? null,
    location: data.location ?? null,
    isPremium: data.is_premium ?? data.isPremium ?? false,
    aiyaMessagesUsed: data.aiya_messages_used ?? data.aiyaMessagesUsed ?? 0,
    aiyaMessagesLimit: data.aiya_messages_limit ?? data.aiyaMessagesLimit ?? 50,
    weeklySummaryDay: data.weekly_summary_day ?? data.weeklySummaryDay ?? null,
    dailyReminderTime: data.daily_reminder_time ?? data.dailyReminderTime ?? null,
    language: data.language ?? 'tr',
    theme: data.theme ?? 'light',
    createdAt: data.created_at ?? data.createdAt ?? new Date().toISOString(),
  }
}













