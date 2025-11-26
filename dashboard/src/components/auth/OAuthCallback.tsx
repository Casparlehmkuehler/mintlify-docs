import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'creating_profile' | 'error' | 'complete'>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Exchange the auth code in the URL for a session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          setError('Authentication failed. Please try signing in.')
          setStatus('error')
          return
        }

        if (!session?.user) {
          console.log('No active session found - checking URL for auth code')

          // Check if this is an email confirmation or OAuth redirect with a code in the URL
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const queryParams = new URLSearchParams(window.location.search)

          const accessToken = hashParams.get('access_token') || queryParams.get('access_token')
          const type = hashParams.get('type') || queryParams.get('type')

          if (type === 'recovery') {
            // This is a password reset - redirect to password reset page
            console.log('Password reset callback detected')
            navigate('/reset-password', { replace: true })
            return
          }

          if (!accessToken) {
            console.error('No session and no access token in URL')
            setError('Email confirmation link may have expired. Please try signing in.')
            setStatus('error')
            return
          }

          console.log('Access token found in URL, user should be authenticated')
        }

        // At this point we should have a valid session
        const { data: { session: currentSession } } = await supabase.auth.getSession()

        if (!currentSession?.user) {
          console.error('Still no user session after token exchange')
          setError('Unable to complete authentication. Please sign in.')
          setStatus('error')
          return
        }

        const user = currentSession.user
        console.log('Auth callback - user authenticated:', user.id)

        // Ensure user setup is complete
        setStatus('creating_profile')
        console.log('🔧 Calling ensure_user_setup for user:', user.id)
        const { data: setupData, error: setupError } = await supabase.rpc('ensure_user_setup', {
          p_user_id: user.id
        });

        if (setupError) {
          console.error('❌ Setup error:', setupError);
        } else {
          console.log('✅ User setup complete:', setupData);
        }

        setStatus('complete')

        // Redirect to dashboard after a short delay
        const timer = setTimeout(() => {
          navigate('/', { replace: true })
        }, 1000)

        return () => clearTimeout(timer)

      } catch (error: any) {
        console.error('Auth callback error:', error)
        setError(`Authentication error: ${error.message}`)
        setStatus('error')
      }
    }

    handleOAuthCallback()
  }, [navigate])

  const getStatusMessage = () => {
    switch (status) {
      case 'processing':
        return 'Completing authentication...'
      case 'creating_profile':
        return 'Setting up your account...'
      case 'complete':
        return 'Success! Redirecting to dashboard...'
      case 'error':
        return error || 'An error occurred'
      default:
        return 'Processing...'
    }
  }

  const handleRetry = () => {
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
      <div className="text-center max-w-md">
        {status !== 'error' ? (
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        ) : (
          <div className="h-32 w-32 mx-auto flex items-center justify-center">
            <div className="text-red-500 text-6xl">⚠️</div>
          </div>
        )}
        
        <p className="mt-4 text-gray-600 dark:text-dark-text-secondary">
          {getStatusMessage()}
        </p>
        
        {status === 'error' && (
          <button
            onClick={handleRetry}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Login
          </button>
        )}
      </div>
    </div>
  )
}

export default OAuthCallback