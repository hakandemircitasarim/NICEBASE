// Web Push Notification Service with Native Android Support
import i18n from '../i18n'
import { PushNotifications, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications'
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications'
import { isNativePlatform } from '../utils/platform'
import { errorLoggingService } from './errorLoggingService'

export const notificationService = {
  async requestPermission(): Promise<boolean> {
    // Native platform (Android/iOS)
    if (isNativePlatform()) {
      try {
        const { receive } = await PushNotifications.requestPermissions()
        return receive === 'granted'
      } catch (error) {
        errorLoggingService.logError(
          error instanceof Error ? error : new Error('Failed to request push notification permissions'),
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
              id: parseInt(`1${userId.slice(-6)}`, 10) % 2147483647, // Unique ID based on userId
              schedule: {
                at: reminderTime,
                repeats: true,
                every: 'day',
              },
              sound: 'default',
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
        // Schedule 4 notifications per day (every 6 hours: 00:00, 06:00, 12:00, 18:00)
        const now = new Date()
        const today = new Date(now)
        today.setHours(0, 0, 0, 0)

        const notifications: LocalNotificationSchema[] = []
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
            id: (parseInt(`2${userId.slice(-6)}`, 10) + index) % 2147483647, // Unique ID per time
            schedule: {
              at: notificationTime,
              repeats: true,
              every: 'day',
            },
            sound: 'default',
            channelId: 'random-memory',
            actionTypeId: 'RANDOM_MEMORY',
            extra: { userId, type: 'random-memory' },
          })
        })

        await LocalNotifications.schedule({ notifications })
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
        const notificationId = parseInt(`1${userId.slice(-6)}`, 10) % 2147483647
        await LocalNotifications.cancel({
          notifications: [{ id: notificationId }],
        })
      } catch (error) {
        errorLoggingService.logError(
          error instanceof Error ? error : new Error('Failed to cancel reminder'),
          'warning',
          userId
        )
      }
    }

    // Web platform - clear timeout
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
          // Cancel existing streak protection for this user
          await this.cancelStreakProtection(userId)

          await LocalNotifications.schedule({
            notifications: [
              {
                title: 'NICEBASE',
                body: message,
                id: parseInt(`3${userId.slice(-6)}`, 10) % 2147483647, // Unique ID
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
        const notificationId = parseInt(`3${userId.slice(-6)}`, 10) % 2147483647
        await LocalNotifications.cancel({
          notifications: [{ id: notificationId }],
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

