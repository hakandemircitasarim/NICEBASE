import { useCallback } from 'react'
import toast from 'react-hot-toast'
import { hapticFeedback } from '../utils/haptic'

interface NotificationOptions {
  duration?: number
  icon?: string
  style?: React.CSSProperties
  id?: string
}

/**
 * Hook for centralized notification and haptic feedback management
 * Provides consistent patterns for success, error, and info notifications
 */
export function useNotifications() {
  // No i18n subscription here on purpose: callers pass already-translated
  // messages, so subscribing to useTranslation() would re-render every consumer
  // on each language change for nothing.

  const showSuccess = useCallback(
    (message: string, options: NotificationOptions = {}) => {
      hapticFeedback('success')
      toast.success(message, {
        duration: options.duration || 3000,
        icon: options.icon || '✅',
        style: options.style,
        id: options.id,
      })
    },
    []
  )

  const showError = useCallback(
    (message: string, options: NotificationOptions = {}) => {
      hapticFeedback('error')
      toast.error(message, {
        duration: options.duration || 4000,
        icon: options.icon || '❌',
        style: options.style,
        id: options.id,
      })
    },
    []
  )

  const showInfo = useCallback(
    (message: string, options: NotificationOptions = {}) => {
      hapticFeedback('light')
      toast(message, {
        duration: options.duration || 3000,
        icon: options.icon || 'ℹ️',
        style: options.style,
        id: options.id,
      })
    },
    []
  )

  const showLoading = useCallback(
    (message: string, options: NotificationOptions = {}) => {
      hapticFeedback('light')
      return toast.loading(message, {
        duration: options.duration || Infinity,
        icon: options.icon || '⏳',
        style: options.style,
        id: options.id,
      })
    },
    []
  )

  const dismissToast = useCallback((toastId: string) => {
    toast.dismiss(toastId)
  }, [])

  return {
    showSuccess,
    showError,
    showInfo,
    showLoading,
    dismissToast,
    hapticFeedback,
  }
}







