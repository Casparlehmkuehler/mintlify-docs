import React, { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import DashboardHome from './pages/DashboardHome'
import RunsPage from './pages/RunsPage'
import StoragePage from './pages/StoragePage'
import EnvVarsPage from './pages/EnvVarsPage'
import BillingPage from './pages/BillingPage'
import ApiKeysPage from './pages/ApiKeysPage'
import SettingsPage from './pages/SettingsPage'
import PasswordResetPage from './pages/PasswordResetPage'
import OAuthCallback from './auth/OAuthCallback'
import { dataPreloader } from '../services/DataPreloader'
import { usePreloader } from '../hooks/useCachedData'
import { analytics, ANALYTICS_EVENTS } from '../services/analytics'

const Dashboard: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const { triggerPreload } = usePreloader()

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  // Preload data based on current route and track page views
  useEffect(() => {
    const currentPath = location.pathname
    
    // Track page view
    analytics.trackPageView(currentPath)
    
    // Track specific page events
    switch (currentPath) {
      case '/':
        analytics.track(ANALYTICS_EVENTS.DASHBOARD_VIEWED)
        break
      case '/runs':
        analytics.track('runs_page_viewed')
        break
      case '/storage':
        analytics.track('storage_page_viewed')
        break
      case '/env-vars':
        analytics.track('env_vars_page_viewed')
        break
      case '/billing':
        analytics.track('billing_page_viewed')
        break
      case '/api-keys':
        analytics.track('api_keys_page_viewed')
        break
      case '/settings':
        analytics.track('settings_page_viewed')
        break
    }
    
    // Trigger preloading for current page
    triggerPreload(currentPath)
    
    // Preload common adjacent pages based on user behavior patterns
    const preloadNext = async () => {
      switch (currentPath) {
        case '/':
          // From dashboard, users commonly go to runs or storage
          setTimeout(() => triggerPreload('/runs'), 2000)
          setTimeout(() => triggerPreload('/storage'), 3000)
          break
        case '/runs':
          // From runs, users often check storage or go back to dashboard
          setTimeout(() => triggerPreload('/storage'), 1500)
          break
        case '/storage':
          // From storage, users might check runs or env vars
          setTimeout(() => triggerPreload('/runs'), 1500)
          setTimeout(() => triggerPreload('/env-vars'), 2000)
          break
        case '/env-vars':
          // From env vars, users might check storage or API keys
          setTimeout(() => triggerPreload('/storage'), 1500)
          setTimeout(() => triggerPreload('/api-keys'), 2000)
          break
        case '/billing':
          // From billing, users might check API keys or dashboard
          setTimeout(() => triggerPreload('/api-keys'), 1000)
          break
      }
    }

    preloadNext()
  }, [location.pathname, triggerPreload])

  // Initial preload on component mount
  useEffect(() => {
    // Start preloading dashboard data immediately
    dataPreloader.preloadDashboardData()
  }, [])

  return (
    <div className="h-screen flex overflow-hidden bg-white dark:bg-dark-bg">
      <Sidebar 
        isMobileOpen={isMobileMenuOpen}
        onMobileToggle={toggleMobileMenu}
        onCloseMobile={closeMobileMenu}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden w-full md:w-auto">
        <TopBar />
        <main className="flex-1 relative overflow-y-auto focus:outline-none min-h-0">
          <div className="py-6 min-h-full">
            <div className="w-full max-w-full">
              <Routes>
                <Route path="/" element={<DashboardHome />} />
                <Route path="/runs" element={<RunsPage />} />
                <Route path="/storage" element={<StoragePage />} />
                <Route path="/env-vars" element={<EnvVarsPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/api-keys" element={<ApiKeysPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/reset-password" element={<PasswordResetPage />} />
                <Route path="/auth/callback" element={<OAuthCallback />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile menu backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black bg-opacity-50 md:hidden"
            onClick={closeMobileMenu}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Dashboard