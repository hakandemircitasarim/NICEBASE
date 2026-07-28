import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useCallback, useRef, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Home, Archive, MessageCircle, User } from 'lucide-react'
import { hapticFeedback } from '../utils/haptic'
import { useStore } from '../store/useStore'
import { useBackButton } from '../hooks/useBackButton'
import { RouteErrorBoundary } from './RouteErrorBoundary'

// First-run only — keep the tour out of the main bundle.
const Onboarding = lazy(() => import('./Onboarding'))

export default function Layout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const openModalCount = useStore((s) => s.openModalCount)
  const isModalOpen = openModalCount > 0
  // Interactive tour lives at the Layout level (not a single page) because it
  // navigates between routes and spotlights the bottom nav itself.
  const hasCompletedOnboarding = useStore((s) => s.hasCompletedOnboarding)
  const setHasCompletedOnboarding = useStore((s) => s.setHasCompletedOnboarding)
  // The app content is tagged `data-app-shell`; the first-run tour marks it
  // `inert` + aria-hidden ONLY while its overlay is actually mounted (managed
  // inside Onboarding), so the lazy-load gap doesn't leave the app inert with no
  // visible modal.
  const locationRef = useRef(location)
  locationRef.current = location

  // Register Android back button handler with React Router
  const handleBackButton = useCallback((): boolean => {
    const currentPath = locationRef.current.pathname
    // If on a sub-page, navigate back to the logical parent (NOT always home).
    if (currentPath === '/') {
      // On home page - let native handle (exit app)
      return false
    }
    // Explicit parent map so back is deterministic regardless of how the page
    // was reached (e.g. Statistics/Insights/Connections were opened from
    // Profile, so back should return to Profile — not Home).
    const PARENT: Record<string, string> = {
      '/insights': '/profile',
      '/statistics': '/profile',
      '/achievements': '/profile',
      '/profile/connections': '/profile',
    }
    const parent = PARENT[currentPath]
    if (parent) {
      // replace (not push): back-navigation must never GROW the history stack.
      // A push here left ...Profile, Insights, Profile on the stack, so the next
      // back's navigate(-1) from Profile landed on Insights again — back then
      // oscillated Profile↔Insights forever. With replace, the sub-page entry is
      // consumed and back continues to wherever the user really came from.
      navigate(parent, { replace: true })
      return true
    }
    // Otherwise honour real history when there is any (vault, relationship-saver,
    // aiya, add-memory), falling back to home on a cold start / deep link.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
      return true
    }
    navigate('/', { replace: true })
    return true
  }, [navigate])

  // Page-level back handler (bottom of the stack). Returns false on Home so the
  // app exits; overlays/forms push their own handlers on top via useBackButton.
  useBackButton(handleBackButton)

  const navItems: Array<{ path: string; icon: typeof Home; label: string; tourId?: string }> = [
    { path: '/', icon: Home, label: t('appName') },
    // Only the Vault tab is spotlighted by the onboarding tour.
    { path: '/vault', icon: Archive, label: t('vault'), tourId: 'nav-vault' },
    { path: '/aiya', icon: MessageCircle, label: t('aiya') },
    { path: '/profile', icon: User, label: t('profile') },
  ]

  const hideNavForRoutes = location.pathname.startsWith('/add-memory') || location.pathname.startsWith('/aiya')
  const isFullscreenChat = location.pathname.startsWith('/aiya')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
     {/* App content — the tour marks this `inert` while its overlay is mounted. */}
     <div data-app-shell>
      <main
        className={isFullscreenChat ? '' : ''}
        style={isFullscreenChat ? undefined : { paddingBottom: 'calc(4rem + var(--safe-area-inset-bottom, 0px))' }}
      >
        {/* Isolate a page-render crash to the page — keyed by path so it resets
            on navigation, leaving the nav/layout mounted. */}
        <RouteErrorBoundary key={location.pathname}>
          <Outlet />
        </RouteErrorBoundary>
      </main>
      
      <nav 
        className={`fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-700 z-40 transition-transform duration-300 ${
          isModalOpen || hideNavForRoutes ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{
          paddingBottom: 'var(--safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex justify-around items-center h-16 px-1 sm:px-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.path === '/'
              ? location.pathname === '/'
              // Progress (/insights) is a Profile sub-page (like
              // /profile/connections) — keep the Profile tab lit there too.
              : item.path === '/profile'
                ? location.pathname.startsWith('/profile') || location.pathname === '/insights'
                : location.pathname.startsWith(item.path)
            return (
              <motion.button
                key={item.path}
                data-tour={item.tourId}
                onClick={() => {
                  navigate(item.path)
                  hapticFeedback('light')
                }}
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center justify-center flex-1 min-w-[60px] sm:min-w-[80px] h-full min-h-[56px] relative touch-manipulation px-2 snap-center ${
                  isActive
                    ? 'text-primary'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 left-2 right-2 h-1 bg-primary rounded-b-full"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon size={20} className={`sm:size-[22px] ${isActive ? 'mb-0.5 sm:mb-1' : ''}`} strokeWidth={2} />
                <span className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 font-medium whitespace-nowrap ${
                  isActive 
                    ? 'text-primary font-semibold' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {item.label}
                </span>
              </motion.button>
            )
          })}
        </div>
      </nav>
     </div>

      {/* First-run interactive tour — Aiya walks the user through the real
          pages with a moving spotlight. Replayable via Settings. The tour
          plays its own fade-out before flipping the flag, so no
          AnimatePresence here. */}
      {!hasCompletedOnboarding && (
        <Suspense fallback={null}>
          <Onboarding onComplete={() => setHasCompletedOnboarding(true)} />
        </Suspense>
      )}
    </div>
  )
}

