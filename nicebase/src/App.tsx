import { useEffect, lazy, Suspense, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import { supabase } from './lib/supabase'
import { fetchUserData, ensureUserExists } from './lib/userService'
import { withTimeout } from './utils/timeout'
import { initializeNativeApp, updateStatusBar, setAppForegroundHandler } from './utils/capacitor'
import { memorySyncService } from './services/memorySyncService'
import { migrateLocalMemories } from './utils/localUserId'
import Toaster from './components/Toaster'
import OfflineIndicator from './components/OfflineIndicator'
import LoadingSpinner from './components/LoadingSpinner'

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home'))
const Vault = lazy(() => import('./pages/Vault'))
const RelationshipSaver = lazy(() => import('./pages/RelationshipSaver'))
const Aiya = lazy(() => import('./pages/Aiya'))
const Statistics = lazy(() => import('./pages/Statistics'))
const Achievements = lazy(() => import('./pages/Achievements'))
const Profile = lazy(() => import('./pages/Profile'))
const Connections = lazy(() => import('./pages/Connections'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AddMemory = lazy(() => import('./pages/AddMemory'))

function App() {
  const { init, setUser, theme } = useStore()
  const syncStartedForRef = useRef<string | null>(null)
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme

  // Update status bar when theme changes (separate from main init)
  useEffect(() => {
    updateStatusBar(theme === 'dark')
  }, [theme])

  useEffect(() => {
    const SESSION_TIMEOUT = 10000
    const FETCH_TIMEOUT = 8000

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
          let user = await withTimeout(
            fetchUserData(session.user.id),
            FETCH_TIMEOUT
          )
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
          if (user) {
            setUser(user)
            // Start background sync for restored session (service handles duplicate calls)
            if (syncStartedForRef.current !== user.id) {
              memorySyncService.start(user.id)
              syncStartedForRef.current = user.id
            }
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

    // When app comes back to foreground, verify the session is still valid.
    // Without this, a background token refresh failure can cause a false SIGNED_OUT.
    setAppForegroundHandler(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          // Truly no session — ensure store is cleared
          memorySyncService.stop()
          syncStartedForRef.current = null
          setUser(null)
        }
      } catch {
        // Network not ready yet — ignore, stay logged in
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
              // Migrate any offline-created memories to this cloud user (best-effort)
              migrateLocalMemories(user.id).catch(() => {})
              // Start background sync for this user (service handles duplicate calls)
              if (syncStartedForRef.current !== user.id) {
                memorySyncService.start(user.id)
                syncStartedForRef.current = user.id
              }
            }
          } catch {
            // Timeout or error fetching user data — non-blocking
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
            // Start background sync for this user (service handles duplicate calls)
            if (syncStartedForRef.current !== user.id) {
              memorySyncService.start(user.id)
              syncStartedForRef.current = user.id
            }
          }
        } catch {
          // Timeout or error — non-blocking
        }
      } else if (event !== 'INITIAL_SESSION') {
        // Only clear user for explicit sign-out events, not during init
        memorySyncService.stop()
        syncStartedForRef.current = null
        setUser(null)
      }
    })

    subscriptionRef.current = subscription

    return () => {
      // Cleanup: unsubscribe from auth changes and stop sync
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
        subscriptionRef.current = null
      }
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
            <Route path="statistics" element={<Statistics />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/connections" element={<Connections />} />
            <Route path="add-memory" element={<AddMemory />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App
