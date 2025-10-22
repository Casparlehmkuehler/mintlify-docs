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
        // Get the current session after OAuth callback
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setError('Authentication failed. Please try again.')
          setStatus('error')
          return
        }

        if (!session?.user) {
          console.error('No user session found')
          setError('No user session found. Please try again.')
          setStatus('error')
          return
        }

        const user = session.user
        console.log('OAuth callback - user authenticated:', user.id)
        
        // Ensure user setup is complete for OAuth users
        setStatus('creating_profile')
        console.log('🔧 Calling ensure_user_setup for OAuth user:', user.id)
        const { data: setupData, error: setupError } = await supabase.rpc('ensure_user_setup', {
          p_user_id: user.id
        });
        
        if (setupError) {
          console.error('❌ OAuth setup error:', setupError);
        } else {
          console.log('✅ OAuth user setup complete:', setupData);
        }
        
        setStatus('complete')
        
        // Redirect to dashboard after a short delay
        const timer = setTimeout(() => {
          navigate('/', { replace: true })
        }, 1000)

        return () => clearTimeout(timer)

      } catch (error: any) {
        console.error('OAuth callback error:', error)
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