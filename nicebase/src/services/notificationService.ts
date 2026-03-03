// Web Push Notification Service with Native Android Support
import i18n from '../i18n'
import { isNativePlatform } from '../utils/platform'
import { errorLoggingService } from './errorLoggingService'
import type { WindowWithCapacitor } from '../types/capacitor'

/**
 * Generate a stable numeric notification ID from a userId and prefix.
 * Uses a simple hash to avoid parseInt issues with non-numeric UUID chars.
 */
function notificationId(userId: string, prefix: number): number {
  let hash = prefix
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 2147483647 || 1 // Ensure non-zero positive int
}

// Load Capacitor notification plugins - in native they're available via window, in web they're not
async function loadPushNotifications() {
  if (!isNativePlatform()) return null
  
  try {
    if (typeof window !== 'undefined') {
      const plugins = (window as WindowWithCapacitor).CapacitorPlugins
      if (plugins?.PushNotifications) {
        return plugins.PushNotifications
      }
    }
    // Try dynamic import as fallback
    const module = await import('@capacitor/push-notifications')
    return module.PushNotifications
  } catch {
    return null
  }
}

async function loadLocalNotifications() {
  if (!isNativePlatform()) return null
  
  try {
    if (typeof window !== 'undefined') {
      const plugins = (window as WindowWithCapacitor).CapacitorPlugins
      if (plugins?.LocalNotifications) {
        return plugins.LocalNotifications
      }
    }
    // Try dynamic import as fallback
    const module = await import('@capacitor/local-notifications')
    return module.LocalNotifications
  } catch {
    return null
  }
}

export const notificationService = {
  async requestPermission(): Promise<boolean> {
    // Native platform (Android/iOS)
    if (isNativePlatform()) {
      // Try LocalNotifications first (more reliable on Android 13+)
      try {
        const LocalNotifications = await loadLocalNotifications()
        if (LocalNotifications) {
          const result = await (LocalNotifications as { requestPermissions: () => Promise<{ display: string }> }).requestPermissions()
          if (result.display === 'granted') return true
        }
      } catch {
        // LocalNotifications permission request failed — try PushNotifications
      }

      // Fallback to PushNotifications
      try {
        const PushNotifications = await loadPushNotifications()
        if (!PushNotifications) return false
        const result = await (PushNotifications as { requestPermissions: () => Promise<{ receive: string }> }).requestPermissions()
        return result.receive === 'granted'
      } catch (error) {
        errorLoggingService.logError(
          error instanceof Error ? error : new Error('Failed to request notification permissions'),
          'warning'
        )
        return false
      }
    }

    // Web platform
    if (!('Notification' in window)) {
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }

    return false
  },

  async showNotification(title: string, options?: NotificationOptions) {
    // Native platform (Android/iOS)
    if (isNativePlatform()) {
      try {
        const LocalNotifications = await loadLocalNotifications()
        if (!LocalNotifications) {
          // Fallback to web notifications
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
              icon: '/vite.svg',
              badge: '/vite.svg',
              ...options,
            })
          }
          return
        }
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body: options?.body || '',
              id: Date.now() % 2147483647, // Android max int
              sound: 'default',
              attachments: undefined,
              actionTypeId: options?.tag || 'DEFAULT',
              extra: options,
              channelId: this.getChannelIdForTag(options?.tag || 'DEFAULT'),
            },
          ],
        })
      } catch (error) {
        errorLoggingService.logError(
          error instanceof Error ? error : new Error('Failed to show native notification'),
          'warning'
        )
      }
      return
    }

    // Web platform
    if (!('Notification' in window)) {
      return
    }

    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/vite.svg',
        badge: '/vite.svg',
        ...options,
      })
    }
  },

  /**
   * Get Android notification channel ID based on tag
   */
  getChannelIdForTag(tag: string): string {
    if (tag.includes('daily-reminder')) return 'daily-reminder'
    if (tag.includes('streak-protection')) return 'streak-protection'
    if (tag.includes('random-memory')) return 'random-memory'
    return 'default'
  },

  async scheduleDailyReminder(time: string, userId: string, currentStreak?: number) {
    // Parse time (HH:mm format)
    const [hours, minutes] = time.split(':').map(Number)
    
    // Get today's date with the specified time
    const now = new Date()
    const reminderTime = new Date()
    reminderTime.setHours(hours, minutes, 0, 0)

    // If time has passed today, schedule for tomorrow
    if (reminderTime < now) {
      reminderTime.setDate(reminderTime.getDate() + 1)
    }

    // Get streak from localStorage if not provided
    let streak = currentStreak
    if (streak === undefined) {
      try {
        const streakData = localStorage.getItem(`streak_${userId}`)
        if (streakData) {
          const parsed = JSON.parse(streakData)
          streak = parsed.currentStreak || 0
        }
      } catch {
        streak = 0
      }
    }

    // Choose message based on streak
    const reminderBody = streak && streak > 0
      ? i18n.t('dailyReminderBodyWithStreak', { count: streak })
      : i18n.t('dailyReminderBody')

    // Store reminder in localStorage
    localStorage.setItem(`reminder_${userId}`, JSON.stringify({
      time,
      scheduledFor: reminderTime.toISOString(),
      streak,
    }))

    // Native platform - use scheduled local notifications
    if (isNativePlatform()) {
      try {
        const LocalNotifications = await loadLocalNotifications()
        if (!LocalNotifications) {
          // Fallback to web scheduling
          const timeUntilReminder = reminderTime.getTime() - now.getTime()
          const timeoutId = setTimeout(() => {
            notificationService.showNotification(i18n.t('dailyReminderTitle'), {
              body: reminderBody,
              tag: 'daily-reminder',
              requireInteraction: false,
            })
            scheduleNext()
          }, timeUntilReminder)
          localStorage.setItem(`reminder_timeout_${userId}`, timeoutId.toString())
          return
        }

        // Cancel existing daily reminders for this user
        await this.cancelReminder(userId)

        // Schedule daily notification (repeating)
        // Note: For repeating notifications, we can't dynamically change the body
        // So we'll use the default body, but the streak will be checked when notification is shown
        await LocalNotifications.schedule({
          notifications: [
            {
              title: i18n.t('dailyReminderTitle'),
              body: reminderBody,
              id: notificationId(userId, 1), // Stable unique ID based on userId
              schedule: {
                at: reminderTime,
                repeats: true,
                every: 'day',
              },
              channelId: 'daily-reminder',
              actionTypeId: 'DAILY_REMINDER',
              extra: { userId, type: 'daily-reminder', streak },
            },
          ],
        })
      } catch (error) {
        errorLoggingService.logError(
          error instanceof Error ? error : new Error('Failed to schedule daily reminder'),
          'warning',
          userId
        )
      }
      return
    }

    // Web platform - use setTimeout with dynamic message
    const scheduleNext = () => {
      const now = new Date()
      const nextReminderTime = new Date()
      nextReminderTime.setHours(hours, minutes, 0, 0)
      if (nextReminderTime < now) {
        nextReminderTime.setDate(nextReminderTime.getDate() + 1)
      }

      // Get current streak for next reminder
      let nextStreak = 0
      try {
        const streakData = localStorage.getItem(`streak_${userId}`)
        if (streakData) {
          const parsed = JSON.parse(streakData)
          nextStreak = parsed.currentStreak || 0
        }
      } catch {}

      const nextBody = nextStreak > 0
        ? i18n.t('dailyReminderBodyWithStreak', { count: nextStreak })
        : i18n.t('dailyReminderBody')

      const timeUntilNext = nextReminderTime.getTime() - now.getTime()

      const timeoutId = setTimeout(() => {
        notificationService.showNotification(i18n.t('dailyReminderTitle'), {
          body: nextBody,
          tag: 'daily-reminder',
          requireInteraction: false,
        })

        // Schedule next day
        scheduleNext()
      }, timeUntilNext)

      localStorage.setItem(`reminder_timeout_${userId}`, timeoutId.toString())
    }

    const timeUntilReminder = reminderTime.getTime() - now.getTime()
    const timeoutId = setTimeout(() => {
      notificationService.showNotification(i18n.t('dailyReminderTitle'), {
        body: reminderBody,
        tag: 'daily-reminder',
        requireInteraction: false,
      })

      // Schedule next day
      scheduleNext()
    }, timeUntilReminder)

    // Store timeout ID for cancellation
    localStorage.setItem(`reminder_timeout_${userId}`, timeoutId.toString())
  },

  async scheduleRandomMemoryReminder(userId: string) {
    // Native platform - use scheduled local notifications
    if (isNativePlatform()) {
      try {
        const LocalNotifications = await loadLocalNotifications()
        if (!LocalNotifications) {
          // Fallback to web scheduling
          const interval = 6 * 60 * 60 * 1000 // 6 hours in milliseconds
          const intervalId = setInterval(async () => {
            notificationService.showNotification(i18n.t('randomMemoryReminderTitle'), {
              body: i18n.t('randomMemoryReminderBody'),
              tag: 'random-memory',
              requireInteraction: false,
            })
          }, interval)
          localStorage.setItem(`random_memory_interval_${userId}`, intervalId.toString())
          return
        }

        // Schedule 4 notifications per day (every 6 hours: 00:00, 06:00, 12:00, 18:00)
        const now = new Date()
        const today = new Date(now)
        today.setHours(0, 0, 0, 0)

        interface ScheduledNotification {
          title: string
          body: string
          id: number
          schedule: {
            at: Date
            repeats: boolean
            every: 'day'
          }
          channelId?: string
          actionTypeId?: string
          extra?: unknown
        }
        const notifications: ScheduledNotification[] = []
        const times = [0, 6, 12, 18] // Hours: 00:00, 06:00, 12:00, 18:00

        times.forEach((hour, index) => {
          const notificationTime = new Date(today)
          notificationTime.setHours(hour, 0, 0, 0)

          // If time has passed today, schedule for tomorrow
          if (notificationTime < now) {
            notificationTime.setDate(notificationTime.getDate() + 1)
          }

          notifications.push({
            title: i18n.t('randomMemoryReminderTitle'),
            body: i18n.t('randomMemoryReminderBody'),
            id: (notificationId(userId, 2) + index) % 2147483647, // Unique ID per time
            schedule: {
              at: notificationTime,
              repeats: true,
              every: 'day',
            },
            channelId: 'random-memory',
            actionTypeId: 'RANDOM_MEMORY',
            extra: { userId, type: 'random-memory' },
          })
        })

        await LocalNotifications.schedule({ notifications: notifications as never })
      } catch (error) {
        errorLoggingService.logError(
          error instanceof Error ? error : new Error('Failed to schedule random memory reminder'),
          'warning',
          userId
        )
      }
      return
    }

    // Web platform - use setInterval
    // Clear any existing interval first to prevent leaks on repeated calls
    const existingIntervalId = localStorage.getItem(`random_memory_interval_${userId}`)
    if (existingIntervalId) {
      clearInterval(Number(existingIntervalId))
    }

    const interval = 6 * 60 * 60 * 1000 // 6 hours in milliseconds

    const intervalId = setInterval(async () => {
      // This would fetch a random memory from IndexedDB
      // For now, just show a generic reminder
      notificationService.showNotification(i18n.t('randomMemoryReminderTitle'), {
        body: i18n.t('randomMemoryReminderBody'),
        tag: 'random-memory',
        requireInteraction: false,
      })
    }, interval)

    // Store interval ID for cancellation
    localStorage.setItem(`random_memory_interval_${userId}`, intervalId.toString())
  },

  async cancelReminder(userId: string) {
    // Native platform - cancel scheduled notifications
    if (isNativePlatform()) {
      try {
        const LocalNotifications = await loadLocalNotifications()
        if (!LocalNotifications) {
          // Fallback to web cancellation
          const timeoutId = localStorage.getItem(`reminder_timeout_${userId}`)
          if (timeoutId) {
            clearTimeout(parseInt(timeoutId, 10))
            localStorage.removeItem(`reminder_timeout_${userId}`)
          }
          return
        }
        const nId = notificationId(userId, 1)
        await LocalNotifications.cancel({
          notifications: [{ id: nId }],
        })
      } catch (error) {
        errorLoggingService.logError(
          error instanceof Error ? error : new Error('Failed to cancel reminder'),
          'warning',
          userId
        )
      }
    }

    // Always clean up web timeout too (in case native fell back to web scheduling)
    localStorage.removeItem(`reminder_${userId}`)
    const timeoutId = localStorage.getItem(`reminder_timeout_${userId}`)
    if (timeoutId) {
      clearTimeout(Number(timeoutId))
      localStorage.removeItem(`reminder_timeout_${userId}`)
    }
  },

  // Streak koruma bildirimi - streak kırılma riski olduğunda
  async scheduleStreakProtection(userId: string, lastMemoryDate: string | null, currentStreak: number) {
    if (!lastMemoryDate || currentStreak === 0) return

    // Son anı tarihini kontrol et
    const lastDate = new Date(lastMemoryDate)
    lastDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const daysSinceLastMemory = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    // Eğer bugün anı eklenmemişse ve streak varsa, akşam saatlerinde hatırlat
    if (daysSinceLastMemory === 0) {
      // Bugün anı eklenmiş, streak korunuyor
      return
    }

    if (daysSinceLastMemory === 1 && currentStreak > 0) {
      // Dün anı eklenmiş, bugün eklenmemiş - streak kırılma riski!
      // Akşam 20:00'de hatırlat
      const now = new Date()
      const reminderTime = new Date()
      reminderTime.setHours(20, 0, 0, 0)

      // Eğer saat 20:00'yi geçtiyse, yarın 20:00'de hatırlat
      if (reminderTime < now) {
        reminderTime.setDate(reminderTime.getDate() + 1)
      }

      const messages = [
        i18n.t('streakProtectionMessages.message1', { count: currentStreak }),
        i18n.t('streakProtectionMessages.message2', { count: currentStreak }),
        i18n.t('streakProtectionMessages.message3', { count: currentStreak }),
      ]

      const message = messages[Math.floor(Math.random() * messages.length)]

      // Native platform - use scheduled local notifications
      if (isNativePlatform()) {
        try {
          const LocalNotifications = await loadLocalNotifications()
          if (!LocalNotifications) {
            // Fallback to web scheduling
            const timeUntilReminder = reminderTime.getTime() - now.getTime()
            const timeoutId = setTimeout(() => {
              notificationService.showNotification('NICEBASE', {
                body: message,
                tag: 'streak-protection',
                requireInteraction: false,
              })
            }, timeUntilReminder)
            localStorage.setItem(`streak_protection_${userId}`, timeoutId.toString())
            return
          }

          // Cancel existing streak protection for this user
          await this.cancelStreakProtection(userId)

          await LocalNotifications.schedule({
            notifications: [
              {
                title: 'NICEBASE',
                body: message,
                id: notificationId(userId, 3), // Unique ID
                schedule: {
                  at: reminderTime,
                },
                sound: 'default',
                channelId: 'streak-protection',
                actionTypeId: 'STREAK_PROTECTION',
                extra: { userId, type: 'streak-protection', currentStreak },
              },
            ],
          })
        } catch (error) {
          errorLoggingService.logError(
            error instanceof Error ? error : new Error('Failed to schedule streak protection'),
            'warning',
            userId
          )
        }
        return
      }

      // Web platform - use setTimeout
      const timeUntilReminder = reminderTime.getTime() - now.getTime()

      const timeoutId = setTimeout(() => {
        notificationService.showNotification('NICEBASE', {
          body: message,
          tag: `streak-protection-${userId}`,
          requireInteraction: false,
          badge: '/vite.svg',
        })

        // Ertesi gün için tekrar kontrol et
        notificationService.scheduleStreakProtection(userId, lastMemoryDate, currentStreak)
      }, timeUntilReminder)

      localStorage.setItem(`streak_protection_${userId}`, timeoutId.toString())
    }
  },

  async cancelStreakProtection(userId: string) {
    // Native platform - cancel scheduled notifications
    if (isNativePlatform()) {
      try {
        const LocalNotifications = await loadLocalNotifications()
        if (!LocalNotifications) {
          // Fallback to web cancellation
          const timeoutId = localStorage.getItem(`streak_protection_${userId}`)
          if (timeoutId) {
            clearTimeout(parseInt(timeoutId, 10))
            localStorage.removeItem(`streak_protection_${userId}`)
          }
          return
        }
        const streakNId = notificationId(userId, 3)
        await LocalNotifications.cancel({
          notifications: [{ id: streakNId }],
        })
      } catch (error) {
        errorLoggingService.logError(
          error instanceof Error ? error : new Error('Failed to cancel streak protection'),
          'warning',
          userId
        )
      }
    }

    // Web platform - clear timeout
    const timeoutId = localStorage.getItem(`streak_protection_${userId}`)
    if (timeoutId) {
      clearTimeout(Number(timeoutId))
      localStorage.removeItem(`streak_protection_${userId}`)
    }
  },
}

