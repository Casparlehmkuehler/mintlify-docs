import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Dashboard from './components/Dashboard'
import LoginFlow from './components/auth/LoginFlow'
import { supabase } from './lib/supabase'
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"
import { analytics } from './services/analytics'

const CLIAuthHandler: React.FC = () => {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [redirectAttempted] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const callback = params.get('callback')
    const sourceParam = params.get('source')
    const autoRedirect = params.get('auto_redirect')
    
    if (callback) {
      setCallbackUrl(callback)
      setSource(sourceParam)
      // Store callback and source in sessionStorage to persist through auth flow
      sessionStorage.setItem('lyceum_auth_callback', callback)
      if (sourceParam) {
        sessionStorage.setItem('lyceum_auth_source', sourceParam)
      }
      if (autoRedirect === 'true') {
        sessionStorage.setItem('lyceum_auth_auto_redirect', 'true')
      }
    } else {
      // Check if we have a stored callback from previous auth attempt
      const storedCallback = sessionStorage.getItem('lyceum_auth_callback')
      const storedSource = sessionStorage.getItem('lyceum_auth_source')
      if (storedCallback) {
        setCallbackUrl(storedCallback)
        setSource(storedSource)
      }
    }
  }, [location.search])

  useEffect(() => {
    // If user is authenticated and we have a callback URL, redirect
    if (user && callbackUrl) {
      console.log('User authenticated, preparing redirect to:', callbackUrl)
      // Get user session for token
      const getTokenAndRedirect = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          console.log('Session data:', session ? 'Session found' : 'No session')
          
          if (session?.access_token && session?.refresh_token) {
            const redirectUrl = new URL(callbackUrl)
            redirectUrl.searchParams.set('token', session.access_token)
            redirectUrl.searchParams.set('refresh_token', session.refresh_token)
            redirectUrl.searchParams.set('user', user.email || '')
            
            console.log('Redirecting to:', redirectUrl.toString())
            
            // Clear stored callback and source
            sessionStorage.removeItem('lyceum_auth_callback')
            sessionStorage.removeItem('lyceum_auth_source')
            sessionStorage.removeItem('lyceum_auth_auto_redirect')
            
            // Try redirect and close tab when successful
            try {
              window.location.href = redirectUrl.toString()
              // Close the tab after successful redirect
              setTimeout(() => {
                window.close()
              }, 2000)
            } catch (error) {
              console.error('window.location.href failed, trying window.open:', error)
              // Fallback to window.open
              window.open(redirectUrl.toString(), '_self')
              setTimeout(() => {
                window.close()
              }, 2000)
            }
          } else {
            console.error('Missing tokens in session:', { 
              hasAccessToken: !!session?.access_token, 
              hasRefreshToken: !!session?.refresh_token 
            })
          }
        } catch (error) {
          console.error('Error getting session:', error)
        }
      }
      
      getTokenAndRedirect()
    }
  }, [user, callbackUrl])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-dark-text-secondary">Authenticating...</p>
        </div>
      </div>
    )
  }

  // Show login flow if not authenticated
  if (!user) {
    return <LoginFlow />
  }

  // Manual redirect function
  const handleManualRedirect = async () => {
    if (callbackUrl) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token && session?.refresh_token) {
          const redirectUrl = new URL(callbackUrl)
          redirectUrl.searchParams.set('token', session.access_token)
          redirectUrl.searchParams.set('refresh_token', session.refresh_token)
          redirectUrl.searchParams.set('user', user?.email || '')
          
          window.location.href = redirectUrl.toString()
        }
      } catch (error) {
        console.error('Manual redirect failed:', error)
      }
    }
  }

  // Show processing message while redirecting
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-dark-text-secondary">
          Redirecting to {source === 'vscode' ? 'VSCode Extension' : 'CLI'}...
        </p>
        {redirectAttempted && (
          <div className="mt-6">
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary mb-4">
              Automatic redirect taking longer than expected.
            </p>
            <button
              onClick={handleManualRedirect}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Click to redirect manually
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const AppContent: React.FC = () => {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Check if this is a CLI auth request (legacy path or VSCode extension callback)
  const params = new URLSearchParams(location.search)
  const hasCallback = params.get('callback') !== null
  const isVSCodeAuth = params.get('source') === 'vscode' || params.get('auto_redirect') === 'true'
  const isCLIAuth = location.pathname === '/cli-login' || (location.pathname === '/' && hasCallback && isVSCodeAuth)

  // Check if user just authenticated and we have a stored callback
  useEffect(() => {
    if (user && !loading) {
      const storedCallback = sessionStorage.getItem('lyceum_auth_callback')
      if (storedCallback && location.pathname === '/') {
        // Redirect to CLI auth handler to complete the flow
        window.location.pathname = '/cli-login'
      }
    }
  }, [user, loading, location.pathname])

  // Handle CLI/VSCode auth flow
  if (isCLIAuth) {
    return <CLIAuthHandler />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-dark-text-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  return user ? <Dashboard /> : <LoginFlow />
}

function App() {
  // Initialize analytics on app load
  useEffect(() => {
    analytics.init({
      posthog: {
        apiKey: import.meta.env.VITE_PUBLIC_POSTHOG_KEY || '',
        host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST
      },
      metaPixel: {
        pixelId: import.meta.env.VITE_META_PIXEL_ID || '1420273115844396'
      },
      debug: import.meta.env.DEV
    })
  }, [])

  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <div className="App">
            <AppContent />
            <Analytics />
            <SpeedInsights />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App