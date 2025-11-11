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
  const [redirectComplete, setRedirectComplete] = useState(false)
  const [showManualFallback, setShowManualFallback] = useState(false)
  const [tokens, setTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null)
  const [copiedToken, setCopiedToken] = useState<'access' | 'refresh' | null>(null)
  const [isManualMode, setIsManualMode] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const callback = params.get('callback')
    const sourceParam = params.get('source')
    const autoRedirectParam = params.get('auto_redirect')
    const manualParam = params.get('manual')

    if (callback) {
      setCallbackUrl(callback)
      setSource(sourceParam)
      // Store callback and source in sessionStorage to persist through auth flow
      sessionStorage.setItem('lyceum_auth_callback', callback)
      if (sourceParam) {
        sessionStorage.setItem('lyceum_auth_source', sourceParam)
      }
      if (autoRedirectParam === 'true') {
        sessionStorage.setItem('lyceum_auth_auto_redirect', 'true')
      }
      if (manualParam === 'true') {
        sessionStorage.setItem('lyceum_auth_manual', 'true')
        setIsManualMode(true)
      }
    } else {
      // Check if we have a stored callback from previous auth attempt
      const storedCallback = sessionStorage.getItem('lyceum_auth_callback')
      const storedSource = sessionStorage.getItem('lyceum_auth_source')
      const storedManual = sessionStorage.getItem('lyceum_auth_manual')
      if (storedCallback) {
        setCallbackUrl(storedCallback)
        setSource(storedSource)
        setIsManualMode(storedManual === 'true')
      }
    }
  }, [location.search])

  useEffect(() => {
    // If user is authenticated and we have a callback URL
    if (user && callbackUrl) {
      console.log('User authenticated, preparing tokens for:', isManualMode ? 'manual entry' : 'redirect')
      // Get user session for token
      const getTokens = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          console.log('Session data:', session ? 'Session found' : 'No session')

          if (session?.access_token && session?.refresh_token) {
            // Store tokens
            setTokens({
              accessToken: session.access_token,
              refreshToken: session.refresh_token
            })

            if (isManualMode) {
              // Manual mode: show tokens immediately, no redirect attempt
              setShowManualFallback(true)
            } else {
              // Auto-redirect mode: attempt redirect
              const redirectUrl = new URL(callbackUrl)
              redirectUrl.searchParams.set('token', session.access_token)
              redirectUrl.searchParams.set('refresh_token', session.refresh_token)
              redirectUrl.searchParams.set('user', user.email || '')

              console.log('Redirecting to:', redirectUrl.toString())

              try {
                window.location.href = redirectUrl.toString()

                // Set timeout to show manual fallback if redirect doesn't work
                const fallbackTimeout = setTimeout(() => {
                  setShowManualFallback(true)
                }, 3000)

                // Show success message after 1 second
                const successTimeout = setTimeout(() => {
                  setRedirectComplete(true)
                }, 1000)

                // Cleanup function
                return () => {
                  clearTimeout(fallbackTimeout)
                  clearTimeout(successTimeout)
                }
              } catch (error) {
                console.error('window.location.href failed:', error)
                setShowManualFallback(true)
              }
            }
          } else {
            console.error('Missing tokens in session:', {
              hasAccessToken: !!session?.access_token,
              hasRefreshToken: !!session?.refresh_token
            })
          }
        } catch (error) {
          console.error('Error getting session:', error)
          setShowManualFallback(true)
        }
      }

      getTokens()
    }
  }, [user, callbackUrl, isManualMode])

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

  // Copy token to clipboard
  const copyToken = async (type: 'access' | 'refresh') => {
    if (!tokens) return

    const token = type === 'access' ? tokens.accessToken : tokens.refreshToken
    try {
      await navigator.clipboard.writeText(token)
      setCopiedToken(type)
      setTimeout(() => setCopiedToken(null), 2000)
    } catch (error) {
      console.error('Failed to copy token:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = token
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopiedToken(type)
        setTimeout(() => setCopiedToken(null), 2000)
      } catch (err) {
        console.error('Fallback copy failed:', err)
      }
      document.body.removeChild(textArea)
    }
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

          setShowManualFallback(false) // Hide fallback during retry
          window.location.href = redirectUrl.toString()

          // Show fallback again if redirect fails
          setTimeout(() => {
            setShowManualFallback(true)
          }, 3000)
        }
      } catch (error) {
        console.error('Manual redirect failed:', error)
      }
    }
  }

  // Show manual token UI (either manual mode or auto-redirect failed)
  if (showManualFallback && tokens) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-bg flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-1">
              {isManualMode ? 'Authentication Tokens' : 'Manual Sign-In'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
              {isManualMode
                ? `Paste these into ${source === 'vscode' ? 'VSCode' : source === 'cursor' ? 'Cursor' : 'your editor'}`
                : 'Copy and paste these tokens to complete sign-in'}
            </p>
          </div>

          {/* Token Cards */}
          <div className="space-y-3 mb-6">
            {/* Access Token */}
            <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary">
                  Access Token
                </label>
                <button
                  onClick={() => copyToken('access')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  {copiedToken === 'access' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="font-mono text-xs text-gray-900 dark:text-dark-text bg-gray-50 dark:bg-dark-bg rounded px-3 py-2 overflow-x-auto">
                {tokens.accessToken}
              </div>
            </div>

            {/* Refresh Token */}
            <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary">
                  Refresh Token
                </label>
                <button
                  onClick={() => copyToken('refresh')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  {copiedToken === 'refresh' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="font-mono text-xs text-gray-900 dark:text-dark-text bg-gray-50 dark:bg-dark-bg rounded px-3 py-2 overflow-x-auto">
                {tokens.refreshToken}
              </div>
            </div>
          </div>

          {/* Instructions */}
          {isManualMode ? (
            <p className="text-xs text-gray-500 dark:text-dark-text-secondary text-center">
              {source === 'vscode' ? 'VSCode' : source === 'cursor' ? 'Cursor' : 'Your editor'} is waiting for these tokens
            </p>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-gray-500 dark:text-dark-text-secondary space-y-1">
                <p>1. Return to {source === 'vscode' ? 'VSCode' : source === 'cursor' ? 'Cursor' : 'your editor'}</p>
                <p>2. Click "Sign In Manually" in the Lyceum status bar</p>
                <p>3. Paste each token when prompted</p>
              </div>
              <button
                onClick={handleManualRedirect}
                className="w-full px-4 py-2 text-sm text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-accent/20 rounded-lg transition-all duration-200"
              >
                Try auto-redirect again
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show processing message while redirecting or success message after redirect
  if (redirectComplete) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <svg
            className="mx-auto h-16 w-16 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-dark-text">
            Authentication successful!
          </h2>
          <p className="mt-2 text-gray-600 dark:text-dark-text-secondary">
            You can now close this tab and return to {source === 'vscode' ? 'VSCode' : 'the CLI'}.
          </p>
        </div>
      </div>
    )
  }

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