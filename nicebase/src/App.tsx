import { useEffect, lazy, Suspense, useRef, useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { User } from './types'
import Layout from './components/Layout'
import Login from './pages/Login'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { fetchUserData, ensureUserExists } from './lib/userService'
import { currentLanguage } from './lib/userDefaults'
import { withTimeout } from './utils/timeout'
import { initializeNativeApp, updateStatusBar, setAppForegroundHandler } from './utils/capacitor'
import { memorySyncService } from './services/memorySyncService'
import { countLocalMemories, migrateLocalMemories, deleteLocalMemories } from './utils/localUserId'
import Toaster from './components/Toaster'
import OfflineIndicator from './components/OfflineIndicator'
import LoadingSpinner from './components/LoadingSpinner'
import MigrationPrompt from './components/MigrationPrompt'
import AppLockGate from './components/AppLockGate'
import toast from 'react-hot-toast'
import i18n from './i18n'

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home'))
const Vault = lazy(() => import('./pages/Vault'))
const RelationshipSaver = lazy(() => import('./pages/RelationshipSaver'))
const Aiya = lazy(() => import('./pages/Aiya'))
// Statistics + Achievements + Badges were three overlapping surfaces; they are
// merged into one "Progress" page (Insights). The old routes redirect here.
const Insights = lazy(() => import('./pages/Insights'))
const Profile = lazy(() => import('./pages/Profile'))
const Connections = lazy(() => import('./pages/Connections'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AddMemory = lazy(() => import('./pages/AddMemory'))

// Build a minimal, usable User from an authenticated Supabase session. Used as a
// fallback when the user-record fetch times out (slow/quiet network) so a
// genuinely-authenticated user keeps the logged-in shell instead of being
// silently downgraded to the logged-out UI. Real data overwrites this once the
// fetch (or a later auth event) succeeds.
function minimalUserFromSession(session: Session): User {
  const meta = session.user.user_metadata || {}
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    displayName: meta.full_name || meta.name || null,
    bio: null,
    avatarUrl: meta.avatar_url || meta.picture || null,
    birthday: null,
    location: null,
    isPremium: false,
    aiyaMessagesUsed: 0,
    aiyaMessagesLimit: 50,
    weeklySummaryDay: null,
    dailyReminderTime: null,
    language: currentLanguage(),
    theme: 'light',
    createdAt: session.user.created_at ?? new Date().toISOString(),
  }
}

function App() {
  // Per-slice selectors so App doesn't re-render the whole routed tree on every
  // openModalCount/isOnline change.
  const init = useStore((s) => s.init)
  const setUser = useStore((s) => s.setUser)
  const bumpMemoriesRefresh = useStore((s) => s.bumpMemoriesRefresh)
  const theme = useStore((s) => s.theme)
  const syncStartedForRef = useRef<string | null>(null)
  // Tracks a user currently held as a PROVISIONAL minimal seed (real record
  // fetch timed out on cold start). While set, later auth/network events must
  // reconcile the real record — otherwise a premium user stays on the free-tier
  // seed (paywall + wrong limits) for the whole session.
  const seededUserIdRef = useRef<string | null>(null)
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme

  // Migration prompt state
  const [migrationPrompt, setMigrationPrompt] = useState<{
    show: boolean
    count: number
    userId: string
    confirmDelete: boolean
  }>({ show: false, count: 0, userId: '', confirmDelete: false })

  const handleMigrationAccept = useCallback(async () => {
    const { userId } = migrationPrompt
    setMigrationPrompt((p) => ({ ...p, show: false }))
    try {
      const count = await migrateLocalMemories(userId)
      if (count > 0) {
        memorySyncService.start(userId)
        // The migration reassigned Dexie rows to the cloud id in place; nothing
        // changed userId, so mounted lists won't re-query on their own. Bump the
        // shared signal so the current view (e.g. Home) shows the memories
        // immediately instead of only after navigating away and back.
        bumpMemoriesRefresh()
        // The user explicitly asked to back up device-only memories — confirm it
        // worked (previously this was silent, so success and failure looked the
        // same and a failed migration read as "nothing happened").
        toast.success(i18n.t('migrationSuccess', { count }))
      }
    } catch {
      // migrateLocalMemories now throws (and logs) on a real failure instead of
      // swallowing it — tell the user their memories are still only on-device.
      toast.error(i18n.t('migrationFailed'))
    }
  }, [migrationPrompt, bumpMemoriesRefresh])

  const handleMigrationReject = useCallback(() => {
    setMigrationPrompt((p) => ({ ...p, confirmDelete: true }))
  }, [])

  const handleMigrationConfirmDelete = useCallback(async () => {
    setMigrationPrompt({ show: false, count: 0, userId: '', confirmDelete: false })
    await deleteLocalMemories()
  }, [])

  const handleMigrationCancelDelete = useCallback(() => {
    setMigrationPrompt((p) => ({ ...p, confirmDelete: false }))
  }, [])

  // Update status bar when theme changes (separate from main init)
  useEffect(() => {
    updateStatusBar(theme === 'dark')
  }, [theme])

  useEffect(() => {
    const SESSION_TIMEOUT = 10000
    const FETCH_TIMEOUT = 8000

    // Prompt to migrate local (guest) memories on EVERY path that establishes a
    // logged-in cloud user — not only SIGNED_IN. If the app was killed before
    // the user answered the prompt, session-restore/INITIAL_SESSION would
    // otherwise never re-offer it and the local rows stay stranded. Idempotent:
    // migrateLocalMemories no-ops once its per-user done flag is set.
    const maybePromptMigration = (uid: string) => {
      countLocalMemories().then((count) => {
        if (count > 0) {
          setMigrationPrompt({ show: true, count, userId: uid, confirmDelete: false })
        }
      }).catch(() => {})
    }

    // Initialize app and restore session
    const initializeApp = async () => {
      // Initialize native platform (StatusBar, back button, listeners)
      await initializeNativeApp(themeRef.current === 'dark')

      // First, try to restore session from storage (with timeout to avoid hanging)
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT
        )
        if (session?.user) {
          let user: User | null = null
          try {
            user = await withTimeout(fetchUserData(session.user.id), FETCH_TIMEOUT)
            // If user record missing (e.g. first Google OAuth login), create it
            if (!user) {
              const meta = session.user.user_metadata || {}
              user = await withTimeout(
                ensureUserExists(session.user.id, session.user.email, 5, {
                  displayName: meta.full_name || meta.name || null,
                  avatarUrl: meta.avatar_url || meta.picture || null,
                }),
                FETCH_TIMEOUT
              )
            }
          } catch (fetchErr) {
            // The session is valid but the user-data fetch timed out (slow/quiet
            // network). Do NOT leave a genuinely-authenticated user on the
            // logged-out UI — seed a minimal user from the session so the app
            // stays logged-in, then retry the fetch once with a short backoff to
            // fill in the real data.
            if (import.meta.env.DEV) {
              console.warn('[App] session restore fetch failed, seeding minimal user:', fetchErr)
            }
            // Don't downgrade an already-loaded real user (e.g. the concurrent
            // INITIAL_SESSION path may have set the full record first) to the
            // minimal seed.
            if (useStore.getState().user?.id !== session.user.id) {
              setUser(minimalUserFromSession(session))
              seededUserIdRef.current = session.user.id
            }
            if (syncStartedForRef.current !== session.user.id) {
              memorySyncService.start(session.user.id)
              syncStartedForRef.current = session.user.id
            }
            await new Promise((r) => setTimeout(r, 1500))
            try {
              user = await withTimeout(fetchUserData(session.user.id), FETCH_TIMEOUT)
            } catch {
              // Retry also failed — keep the minimal user; onAuthStateChange /
              // a later online sync will reconcile the real record.
            }
          }
          if (user) {
            setUser(user)
            seededUserIdRef.current = null // real record loaded — no longer a seed
            // Start background sync for restored session (service handles duplicate calls)
            if (syncStartedForRef.current !== user.id) {
              memorySyncService.start(user.id)
              syncStartedForRef.current = user.id
            }
            // Re-offer local→cloud migration if it was never answered.
            maybePromptMigration(user.id)
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Session restore error:', error)
        }
      }

      // Then initialize the rest of the app
      await init()
    }

    initializeApp()

    // On return to foreground, re-verify the session. Without this, a background
    // token-refresh failure can surface as a false SIGNED_OUT and log the user out.
    setAppForegroundHandler(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          // Genuinely no session — clear sync + user state.
          memorySyncService.stop()
          syncStartedForRef.current = null
          setUser(null)
        }
      } catch {
        // Network not ready yet on resume — ignore and stay logged in.
      }
    })

    // Listen to auth changes (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          // TOKEN_REFRESHED only renews the JWT — user data hasn't changed,
          // so skip the DB fetch to save egress bandwidth.
          if (event === 'TOKEN_REFRESHED') {
            // Just make sure sync is running for this user
            if (syncStartedForRef.current !== session.user.id) {
              memorySyncService.start(session.user.id)
              syncStartedForRef.current = session.user.id
            }
            // If the current user is still a provisional minimal seed (real
            // fetch timed out on cold start), reconcile it now — otherwise a
            // premium user stays on the free-tier seed for the whole session,
            // since TOKEN_REFRESHED would normally just no-op here.
            if (seededUserIdRef.current === session.user.id) {
              try {
                const real = await withTimeout(fetchUserData(session.user.id), FETCH_TIMEOUT)
                if (real) {
                  setUser(real)
                  seededUserIdRef.current = null
                }
              } catch {
                // Keep the seed; a later event / the online listener reconciles.
              }
            }
            return
          }

          try {
            let user = await withTimeout(fetchUserData(session.user.id), FETCH_TIMEOUT)

            // If user doesn't exist in DB (e.g. first Google OAuth login), create them
            if (!user) {
              const meta = session.user.user_metadata || {}
              user = await withTimeout(
                ensureUserExists(session.user.id, session.user.email, 2, {
                  displayName: meta.full_name || meta.name || null,
                  avatarUrl: meta.avatar_url || meta.picture || null,
                }),
                FETCH_TIMEOUT
              )
            }

            if (user) {
              setUser(user)
              seededUserIdRef.current = null
              // Check if there are local memories to migrate — prompt the user
              maybePromptMigration(user.id)
              // Start background sync for this user (service handles duplicate calls)
              if (syncStartedForRef.current !== user.id) {
                memorySyncService.start(user.id)
                syncStartedForRef.current = user.id
              }
            }
          } catch (err) {
            // Timeout or error fetching user data — non-blocking
            if (import.meta.env.DEV) console.warn('[App] auth SIGNED_IN user fetch failed:', err)
          }
        }
      } else if (event === 'SIGNED_OUT') {
        memorySyncService.stop()
        syncStartedForRef.current = null
        setUser(null)
      } else if (session?.user) {
        try {
          const user = await withTimeout(fetchUserData(session.user.id), FETCH_TIMEOUT)
          if (user) {
            setUser(user)
            seededUserIdRef.current = null
            // Start background sync for this user (service handles duplicate calls)
            if (syncStartedForRef.current !== user.id) {
              memorySyncService.start(user.id)
              syncStartedForRef.current = user.id
            }
            // INITIAL_SESSION can also be a first login with unmigrated guest data.
            maybePromptMigration(user.id)
          }
        } catch (err) {
          // Timeout or error fetching user data for a valid session (e.g.
          // INITIAL_SESSION on a slow network). Seed a minimal user from the
          // session so an authenticated user isn't shown the logged-out UI;
          // a later fetch/sync reconciles the real record. Only seed if we
          // don't already have this user set.
          if (import.meta.env.DEV) console.warn('[App] auth state user fetch failed:', err)
          const sess = session
          if (sess?.user && useStore.getState().user?.id !== sess.user.id) {
            setUser(minimalUserFromSession(sess))
            seededUserIdRef.current = sess.user.id
            if (syncStartedForRef.current !== sess.user.id) {
              memorySyncService.start(sess.user.id)
              syncStartedForRef.current = sess.user.id
            }
          }
        }
      } else if (event !== 'INITIAL_SESSION') {
        // Only clear user for explicit sign-out events, not during init
        memorySyncService.stop()
        syncStartedForRef.current = null
        setUser(null)
      }
    })

    subscriptionRef.current = subscription

    // Reconnecting is another chance to heal a provisional minimal seed (the
    // premium-user-shown-as-free case) even if no auth event fires.
    const onOnline = async () => {
      const seededId = seededUserIdRef.current
      if (!seededId) return
      try {
        const real = await withTimeout(fetchUserData(seededId), FETCH_TIMEOUT)
        if (real && useStore.getState().user?.id === seededId) {
          setUser(real)
          seededUserIdRef.current = null
        }
      } catch {
        // Still offline/slow — leave the seed; a later event reconciles.
      }
    }
    if (typeof window !== 'undefined') window.addEventListener('online', onOnline)

    return () => {
      // Cleanup: unsubscribe from auth changes and stop sync
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
        subscriptionRef.current = null
      }
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline)
      setAppForegroundHandler(null)
      memorySyncService.stop()
      syncStartedForRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init, setUser])

  return (
    <>
      <OfflineIndicator />
      <Toaster />
      <MigrationPrompt
        show={migrationPrompt.show}
        count={migrationPrompt.count}
        confirmDelete={migrationPrompt.confirmDelete}
        onAccept={handleMigrationAccept}
        onReject={handleMigrationReject}
        onConfirmDelete={handleMigrationConfirmDelete}
        onCancelDelete={handleMigrationCancelDelete}
      />
      <AppLockGate>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        }>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="vault" element={<Vault />} />
              <Route path="relationship-saver" element={<RelationshipSaver />} />
              <Route path="aiya" element={<Aiya />} />
              <Route path="insights" element={<Insights />} />
              {/* Retired routes now redirect into the merged Progress page so any
                  deep links / notifications / old shortcuts keep working. */}
              <Route path="statistics" element={<Navigate to="/insights?tab=overview" replace />} />
              <Route path="achievements" element={<Navigate to="/insights?tab=goals" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="profile/connections" element={<Connections />} />
              <Route path="add-memory" element={<AddMemory />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppLockGate>
    </>
  )
}

export default App
