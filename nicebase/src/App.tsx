import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useStore } from './store/useStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { ensureUserExists } from './lib/userService'
import { errorLoggingService } from './services/errorLoggingService'
import Toaster from './components/Toaster'
import OfflineIndicator from './components/OfflineIndicator'
import LoadingSpinner from './components/LoadingSpinner'
import { memorySyncService } from './services/memorySyncService'

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home'))
const Vault = lazy(() => import('./pages/Vault'))
const RelationshipSaver = lazy(() => import('./pages/RelationshipSaver'))
const Connections = lazy(() => import('./pages/Connections'))
const Aiya = lazy(() => import('./pages/Aiya'))
const Statistics = lazy(() => import('./pages/Statistics'))
const Achievements = lazy(() => import('./pages/Achievements'))
const Settings = lazy(() => import('./pages/Settings'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AddMemory = lazy(() => import('./pages/AddMemory'))

function App() {
  const { init, setUser, user } = useStore()
  const supabaseEnabled = isSupabaseConfigured()

  useEffect(() => {
    // Initialize app and restore session
    const initializeApp = async () => {
      // First, try to restore session from storage (cloud mode only)
      if (supabaseEnabled) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const user = await ensureUserExists(session.user.id, session.user.email)
            if (user) {
              setUser(user)
            }
          }
        } catch (error) {
          errorLoggingService.logError(
            error instanceof Error ? error : new Error('Session restore error'),
            'error'
          )
        }
      }

      // Then initialize the rest of the app
      await init()
    }

    initializeApp()

    // Listen to auth changes (login, logout, token refresh, etc.)
    if (!supabaseEnabled) {
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const user = await ensureUserExists(session.user.id, session.user.email)
          if (user) {
            setUser(user)
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (session?.user) {
        // For other events, still try to update user if session exists
        const user = await ensureUserExists(session.user.id, session.user.email)
        if (user) {
          setUser(user)
        }
      } else {
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [init, setUser, supabaseEnabled])

  // Premium offline sync: auto-flush queue when online / on resume (native)
  useEffect(() => {
    if (user?.id) {
      memorySyncService.start(user.id)
      return () => memorySyncService.stop()
    }
    memorySyncService.stop()
  }, [user?.id])

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
            <Route path="add-memory" element={<AddMemory />} />
            <Route path="vault" element={<Vault />} />
            <Route path="relationship-saver" element={<RelationshipSaver />} />
            <Route path="connections" element={<Connections />} />
            <Route path="aiya" element={<Aiya />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}

export default App

