import { User } from '../types'

// Map Supabase snake_case to camelCase
export function mapUserFromSupabase(data: any): User {
  return {
    id: data.id,
    email: data.email,
    isPremium: data.is_premium ?? data.isPremium ?? false,
    aiyaMessagesUsed: data.aiya_messages_used ?? data.aiyaMessagesUsed ?? 0,
    aiyaMessagesLimit: data.aiya_messages_limit ?? data.aiyaMessagesLimit ?? 30,
    weeklySummaryDay: data.weekly_summary_day ?? data.weeklySummaryDay ?? null,
    dailyReminderTime: data.daily_reminder_time ?? data.dailyReminderTime ?? null,
    language: data.language ?? 'tr',
    theme: data.theme ?? 'light',
    createdAt: data.created_at ?? data.createdAt ?? new Date().toISOString(),
  }
}











