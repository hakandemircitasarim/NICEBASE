import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import PinPad from './PinPad'
import { appLockService } from '../services/appLockService'
import { errorLoggingService } from '../services/errorLoggingService'
import { supabase } from '../lib/supabase'
import { isNative } from '../utils/capacitor'
import { useBackButton } from '../hooks/useBackButton'

interface AppLockGateProps {
  children: ReactNode
}

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 30_000
// How long the app may sit in the background before it re-locks on resume.
const BACKGROUND_LOCK_MS = 30_000

/**
 * Auth / password-reset routes must never be gated — otherwise a password-reset
 * deep link would be unreachable behind the lock screen.
 */
function isAuthRoute(): boolean {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname
  return path.startsWith('/reset-password') || path.startsWith('/login')
}

/**
 * Wraps the app and renders a full-screen PIN lock when the app lock is enabled.
 * Renders children untouched when no PIN is set or on auth routes.
 */
export default function AppLockGate({ children }: AppLockGateProps) {
  const { t } = useTranslation()
  const [locked, setLocked] = useState<boolean>(
    () => !isAuthRoute() && appLockService.isEnabled()
  )
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [lockedOut, setLockedOut] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  const backgroundedAtRef = useRef<number | null>(null)
  const lockoutTimerRef = useRef<number | null>(null)

  // While locked, the Android hardware back button must do nothing (never exit
  // the app or navigate away from the lock screen).
  useBackButton(() => true, locked)

  // Re-lock on resume: when the app comes back to the foreground after being
  // backgrounded longer than BACKGROUND_LOCK_MS, re-engage the lock. Native only.
  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined

    const setup = async () => {
      if (!isNative()) return
      try {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            backgroundedAtRef.current = Date.now()
            return
          }
          const backgroundedAt = backgroundedAtRef.current
          backgroundedAtRef.current = null
          if (
            backgroundedAt != null &&
            Date.now() - backgroundedAt > BACKGROUND_LOCK_MS &&
            appLockService.isEnabled() &&
            !isAuthRoute()
          ) {
            setLocked(true)
          }
        })

        if (cancelled) {
          await handle.remove()
          return
        }
        cleanup = () => {
          void handle.remove()
        }
      } catch (err) {
        errorLoggingService.logError(
          err instanceof Error ? err : new Error('AppLockGate resume listener failed'),
          'warning'
        )
      }
    }

    void setup()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  // Clean up a pending lockout timer on unmount.
  useEffect(() => {
    return () => {
      if (lockoutTimerRef.current != null) {
        window.clearTimeout(lockoutTimerRef.current)
      }
    }
  }, [])

  // No PIN set (or on an auth route) → render the app directly, no gate.
  if (!locked) {
    return <>{children}</>
  }

  const handleComplete = async (pin: string) => {
    if (lockedOut) return
    try {
      const ok = await appLockService.verifyPin(pin)
      if (ok) {
        setError('')
        setAttempts(0)
        setLockedOut(false)
        setLocked(false)
        return
      }
    } catch (err) {
      errorLoggingService.logError(
        err instanceof Error ? err : new Error('AppLockGate verifyPin failed'),
        'error'
      )
    }

    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    if (nextAttempts >= MAX_ATTEMPTS) {
      setLockedOut(true)
      setError(t('tooManyAttempts'))
      lockoutTimerRef.current = window.setTimeout(() => {
        setLockedOut(false)
        setAttempts(0)
        setError('')
      }, LOCKOUT_MS)
    } else {
      // A distinct value each time ensures PinPad's effect re-triggers the shake.
      setError(`${t('incorrectPin')} (${nextAttempts})`)
    }
  }

  const handleForgotConfirm = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      errorLoggingService.logError(
        err instanceof Error ? err : new Error('AppLockGate signOut failed'),
        'warning'
      )
    }
    try {
      await appLockService.clearPin()
    } catch (err) {
      errorLoggingService.logError(
        err instanceof Error ? err : new Error('AppLockGate clearPin failed'),
        'warning'
      )
    }
    setLocked(false)
    // Send the user to the login flow after wiping the lock + session.
    window.location.assign('/login')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex flex-col items-center text-center mb-2">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="text-primary" size={32} aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('lockedTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          {t('lockedSubtitle')}
        </p>
      </div>

      {showForgot ? (
        <div className="w-full max-w-xs mt-6 flex flex-col items-center text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('forgotPinInstructions')}
          </p>
          <div className="mt-6 flex gap-3 w-full">
            <button
              type="button"
              onClick={() => setShowForgot(false)}
              className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleForgotConfirm}
              className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors touch-manipulation"
            >
              {t('logout')}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full mt-6 flex flex-col items-center">
          {lockedOut ? (
            <div className="w-full max-w-xs text-center py-10">
              <p className="text-sm font-medium text-red-500 dark:text-red-400">
                {t('tooManyAttempts')}
              </p>
            </div>
          ) : (
            <PinPad
              title={t('enterPin')}
              onComplete={handleComplete}
              error={error}
            />
          )}

          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="mt-6 text-sm font-medium text-primary hover:underline touch-manipulation"
          >
            {t('forgotPin')}
          </button>
        </div>
      )}
    </motion.div>
  )
}
