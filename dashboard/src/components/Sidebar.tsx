import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LayoutDashboard, 
  Play, 
  Lock,
  CreditCard, 
  Key, 
  Settings, 
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
  Database
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { usePreloader } from '../hooks/useCachedData'
import { analytics, CTA_NAMES } from '../services/analytics'

interface SidebarProps {
  isMobileOpen: boolean
  onMobileToggle: () => void
  onCloseMobile: () => void
}

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Runs', href: '/runs', icon: Play },
  { name: 'Storage', href: '/storage', icon: Database },
 //{ name: 'Environment Variables', href: '/env-vars', icon: Lock },
  { name: 'API Keys', href: '/api-keys', icon: Key },
  { name: 'Billing', href: '/billing', icon: CreditCard },
]

const Sidebar: React.FC<SidebarProps> = ({
  isMobileOpen,
  onMobileToggle,
  onCloseMobile,
}) => {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const { triggerPreload } = usePreloader()

  const handleSignOut = async () => {
    try {
      analytics.trackCTA(CTA_NAMES.LOGOUT_BUTTON, {
        user_id: user?.id,
        email: user?.email
      })
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }


  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0 w-64">
        <div className="flex flex-col w-full">
          <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto bg-gray-100 dark:bg-dark-card border-r border-gray-200 dark:border-dark-border">
            <div className="flex items-center flex-shrink-0 px-6">
              <a 
                href="https://lyceum.technology"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-gray-700 dark:text-dark-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                Lyceum
              </a>
            </div>
            <nav className="mt-8 flex-1 px-4 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => {
                      // Track navigation CTAs
                      const ctaMap: Record<string, string> = {
                        '/': CTA_NAMES.NAV_DASHBOARD,
                        '/runs': 'nav_runs',
                        '/storage': 'nav_storage',
                        '/env-vars': 'nav_env_vars',
                        '/billing': 'nav_billing',
                        '/api-keys': CTA_NAMES.NAV_API_KEYS,
                      }
                      if (ctaMap[item.href]) {
                        analytics.trackCTA(ctaMap[item.href], {
                          from: location.pathname,
                          to: item.href
                        })
                      }
                    }}
                    onMouseEnter={() => triggerPreload(item.href)}
                    className={clsx(
                      'group flex items-center px-2 py-2 text-sm rounded-md transition-all duration-200',
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/20'
                        : 'text-gray-500 dark:text-dark-text-secondary font-normal hover:bg-gray-200 dark:hover:bg-dark-accent/20 hover:text-gray-800 dark:hover:text-dark-text'
                    )}
                  >
                    <Icon
                      className={clsx(
                        'mr-3 flex-shrink-0 transition-colors duration-200',
                        isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-dark-text-secondary group-hover:text-gray-600 dark:group-hover:text-dark-text'
                      )}
                      size={20}
                    />
                    <span className="whitespace-nowrap">
                      {item.name}
                    </span>
                  </Link>
                )
              })}
            </nav>
            
            {/* User section */}
            <div className="flex-shrink-0 px-4 pb-2 border-t border-gray-200 dark:border-dark-border pt-2 relative">
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center w-full p-2 rounded-md hover:bg-gray-100 dark:hover:bg-dark-accent/20 transition-all duration-200"
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-dark-text truncate text-left">
                      {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-dark-text-secondary truncate text-left">
                      {user?.email}
                    </p>
                  </div>
                  <div className="ml-2">
                    <ChevronDown 
                      className={`w-4 h-4 text-gray-400 dark:text-dark-text-secondary transition-transform ${
                        userDropdownOpen ? 'rotate-180' : ''
                      }`} 
                    />
                  </div>
                </button>
                
                {/* Dropdown Menu */}
                <AnimatePresence>
                  {userDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-md shadow-lg py-1 z-50"
                    >
                      <Link
                        to="/settings"
                        onClick={() => {
                          setUserDropdownOpen(false)
                          analytics.trackCTA(CTA_NAMES.NAV_SETTINGS, {
                            from: location.pathname
                          })
                        }}
                        className="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-all duration-200"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Link>
                      <hr className="my-1" />
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false)
                          handleSignOut()
                        }}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-all duration-200"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed inset-y-0 left-0 z-30 w-64 bg-gray-100 dark:bg-dark-card border-r border-gray-200 dark:border-dark-border md:hidden"
          >
            <div className="flex flex-col h-full pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center justify-between flex-shrink-0 px-4">
                <a 
                  href="https://lyceum.technology"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-semibold text-gray-700 dark:text-dark-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                >
                  Lyceum
                </a>
                <button
                  onClick={onCloseMobile}
                  className="p-2 rounded-md text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-accent/20 hover:text-gray-900 dark:hover:text-dark-text transition-all duration-200"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="mt-8 flex-1 px-4 space-y-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={onCloseMobile}
                      className={clsx(
                        'group flex items-center px-2 py-2 text-sm rounded-md transition-all duration-200',
                        isActive
                          ? 'text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/20'
                          : 'text-gray-500 dark:text-dark-text-secondary font-normal hover:bg-gray-200 dark:hover:bg-dark-accent/20 hover:text-gray-800 dark:hover:text-dark-text'
                      )}
                    >
                      <Icon
                        className={clsx(
                          'mr-3 flex-shrink-0 transition-colors duration-200',
                          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-dark-text-secondary group-hover:text-gray-600 dark:group-hover:text-dark-text'
                        )}
                        size={20}
                      />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
              
              {/* User section - Mobile */}
              <div className="flex-shrink-0 px-4 pb-2 border-t border-gray-200 dark:border-dark-border pt-2">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-dark-text truncate">
                        {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-dark-text-secondary truncate">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  
                  {/* Mobile Menu Options */}
                  <div className="space-y-1">
                    <Link
                      to="/settings"
                      onClick={onCloseMobile}
                      className="flex items-center p-2 text-sm text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-accent/20 rounded-md transition-all duration-200"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        onCloseMobile()
                        handleSignOut()
                      }}
                      className="flex items-center w-full p-2 text-sm text-gray-700 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-accent/20 rounded-md transition-colors"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile menu button */}
      <div className="fixed top-4 left-4 z-40 md:hidden">
        <button
          onClick={onMobileToggle}
          className="p-2 rounded-md bg-gray-100 dark:bg-dark-card text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 hover:text-gray-900 dark:hover:text-dark-text transition-all duration-200 border border-gray-200 dark:border-dark-border"
        >
          <Menu size={20} />
        </button>
      </div>
    </>
  )
}

export default Sidebar