import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate()

  useEffect(() => {
    // The OAuth callback has been handled by Supabase automatically
    // Just redirect to the main dashboard
    const timer = setTimeout(() => {
      navigate('/', { replace: true })
    }, 1000) // Small delay to ensure auth state is updated

    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-dark-text-secondary">
          Completing login...
        </p>
      </div>
    </div>
  )
}

export default OAuthCallback