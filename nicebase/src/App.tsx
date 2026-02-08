import { useEffect, lazy, Suspense, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import { supabase } from './lib/supabase'
import { fetchUserData } from './lib/userService'
import { withTimeout } from './utils/timeout'
import { initializeNativeApp } from './utils/capacitor'
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

  useEffect(() => {
    const SESSION_TIMEOUT = 5000
    const FETCH_TIMEOUT = 8000

    // Initialize app and restore session
    const initializeApp = async () => {
      // Initialize native platform (StatusBar, back button, listeners)
      await initializeNativeApp(theme === 'dark')

      // First, try to restore session from storage (with timeout to avoid hanging)
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT
        )
        if (session?.user) {
          const user = await withTimeout(
            fetchUserData(session.user.id),
            FETCH_TIMEOUT
          )
          if (user) {
            setUser(user)
            // Start background sync for restored session
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

    // Listen to auth changes (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          try {
            const user = await withTimeout(fetchUserData(session.user.id), FETCH_TIMEOUT)
            if (user) {
              setUser(user)
              // Migrate any offline-created memories to this cloud user (best-effort)
              if (event === 'SIGNED_IN') {
                migrateLocalMemories(user.id).catch(() => {})
              }
              // Start background sync for this user
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
            // Start background sync for this user
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

    return () => {
      subscription.unsubscribe()
      memorySyncService.stop()
      syncStartedForRef.current = null
    }
  }, [init, setUser, theme])

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
