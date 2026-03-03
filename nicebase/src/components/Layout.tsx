import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Home, Archive, MessageCircle, User } from 'lucide-react'
import { hapticFeedback } from '../utils/haptic'
import { useStore } from '../store/useStore'
import { setBackButtonHandler } from '../utils/capacitor'

export default function Layout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const openModalCount = useStore((s) => s.openModalCount)
  const isModalOpen = openModalCount > 0
  const locationRef = useRef(location)
  locationRef.current = location

  // Register Android back button handler with React Router
  const handleBackButton = useCallback((): boolean => {
    const currentPath = locationRef.current.pathname
    // If on a sub-page, navigate back to the parent/home
    if (currentPath === '/') {
      // On home page - let native handle (exit app)
      return false
    }
    // Navigate to home for all other pages
    navigate('/', { replace: true })
    return true
  }, [navigate])

  useEffect(() => {
    setBackButtonHandler(handleBackButton)
    return () => setBackButtonHandler(null)
  }, [handleBackButton])

  const navItems = [
    { path: '/', icon: Home, label: t('appName') },
    { path: '/vault', icon: Archive, label: t('vault') },
    { path: '/aiya', icon: MessageCircle, label: t('aiya') },
    { path: '/profile', icon: User, label: t('profile') },
  ]

  const hideNavForRoutes = location.pathname.startsWith('/add-memory') || location.pathname.startsWith('/aiya')
  const isFullscreenChat = location.pathname.startsWith('/aiya')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className={isFullscreenChat ? '' : 'pb-16'}>
        <Outlet />
      </main>
      
      <nav 
        className={`fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-700 z-40 transition-transform duration-300 ${
          isModalOpen || hideNavForRoutes ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex justify-around items-center h-16 px-1 sm:px-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.path === '/' 
              ? location.pathname === '/' 
              : location.pathname.startsWith(item.path)
            return (
              <motion.button
                key={item.path}
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
  )
}

