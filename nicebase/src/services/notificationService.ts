// Web Push Notification Service with Native Android Support
import i18n from '../i18n'
import { isNativePlatform } from '../utils/platform'
import { errorLoggingService } from './errorLoggingService'
import { parseLocalDate } from '../utils/dateFormat'
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

// Monotonic counter for transient (ad-hoc) notification ids, so two
// notifications fired within the same millisecond can't collide on
// `Date.now() % MAX`. Lives in a high sub-range that the stable per-user
// reminder hashes effectively never occupy.
const MAX_NOTIFICATION_ID = 2147483647
let transientNotificationCounter = 0

// Load Capacitor notification plugins - in native they're available via window, in web they're not
//
// IMPORTANT: These functions return plain wrapper objects, NOT the raw Capacitor plugin.
// Returning a Capacitor plugin directly from an async function triggers the "thenable trap":
// Promise.resolve(plugin) calls plugin.then(), causing "Plugin.then() is not implemented on android".
async function loadPushNotifications() {
  if (!isNativePlatform()) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let p: any
    if (typeof window !== 'undefined') {
      const plugins = (window as WindowWithCapacitor).CapacitorPlugins
      if (plugins?.PushNotifications) {
        p = plugins.PushNotifications
      }
    }
    if (!p) {
      const module = await import('@capacitor/push-notifications')
      p = module.PushNotifications
    }
    // Plain wrapper — no .then() property, safe to return from async function
    return { requestPermissions: () => p.requestPermissions() as Promise<{ receive: string }> }
  } catch {
    return null
  }
}

async function loadLocalNotifications() {
  if (!isNativePlatform()) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let p: any
    if (typeof window !== 'undefined') {
      const plugins = (window as WindowWithCapacitor).CapacitorPlugins
      if (plugins?.LocalNotifications) {
        p = plugins.LocalNotifications
      }
    }
    if (!p) {
      const module = await import('@capacitor/local-notifications')
      p = module.LocalNotifications
    }
    // Plain wrapper — no .then() property, safe to return from async function
    return {
      requestPermissions: () => p.requestPermissions() as Promise<{ display: string }>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      schedule: (opts: any) => p.schedule(opts) as Promise<void>,
      cancel: (opts: { notifications: { id: number }[] }) => p.cancel(opts) as Promise<void>,
    }
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
              id: (Date.now() + (transientNotificationCounter++)) % MAX_NOTIFICATION_ID, // Android max int; counter avoids same-ms collisions
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
    // Clear any previously scheduled WEB timer for this user before re-arming.
    // setupNotifications re-runs on every streak change, so without this each
    // call would leak a setTimeout and fire duplicate reminders. (The native
    // path cancels its own scheduled notification in its branch below.)
    const prevTimeoutId = localStorage.getItem(`reminder_timeout_${userId}`)
    if (prevTimeoutId) {
      clearTimeout(Number(prevTimeoutId))
      localStorage.removeItem(`reminder_timeout_${userId}`)
    }

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

        // Schedule daily notification (repeating). The body is baked in at
        // schedule time with the streak known now, and refreshed every time
        // scheduleDailyReminder re-runs (e.g. on app open / streak change), so
        // it stays reasonably current between reschedules.
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
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[notifications] Failed to read streak for reminder:', err)
      }

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

    // Son anı tarihini kontrol et. parseLocalDate builds the date at LOCAL
    // midnight (new Date('YYYY-MM-DD') would parse as UTC and shift the day in
    // negative-UTC zones, producing false "streak at risk" notifications).
    const lastDate = parseLocalDate(lastMemoryDate)
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
        // No self-reschedule here: re-arming would use this closure's now-stale
        // lastMemoryDate/currentStreak snapshot. Home re-schedules with fresh
        // streak data on each load instead.
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

