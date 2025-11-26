import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const PasswordResetPage: React.FC = () => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validating, setValidating] = useState(true)
  const [isValidSession, setIsValidSession] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Check if we have a valid reset session
  useEffect(() => {
    const checkResetSession = async () => {
      try {
        setValidating(true)

        // Check for Supabase auth session (should be present from password reset link)
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          setError('Invalid or expired password reset link. Please request a new password reset.')
          setValidating(false)
          return
        }

        setIsValidSession(true)
      } catch (err: any) {
        console.error('Error checking reset session:', err)
        setError('Unable to verify password reset session. Please try again.')
      } finally {
        setValidating(false)
      }
    }

    checkResetSession()
  }, [location.search])

  // Password validation
  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = []
    
    if (pwd.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    if (!/\d/.test(pwd)) {
      errors.push('Password must contain at least one number')
    }
    
    return errors
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const passwordErrors = validatePassword(password)
    if (passwordErrors.length > 0) {
      setError(passwordErrors[0])
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        throw error
      }

      setSuccess(true)
      
      // Redirect to settings after a short delay
      setTimeout(() => {
        navigate('/settings', { replace: true })
      }, 3000)

    } catch (err: any) {
      console.error('Password reset error:', err)
      if (err.message?.includes('Auth session missing')) {
        setError('Your password reset session has expired. Please request a new password reset.')
      } else {
        setError('Failed to reset password: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // Show loading while validating session
  if (validating) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-dark-text-secondary">Verifying password reset session...</p>
        </div>
      </div>
    )
  }

  // Show error if invalid session
  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-2">
                Invalid Reset Link
              </h1>
              <p className="text-gray-600 dark:text-dark-text-secondary mb-6">
                {error || 'This password reset link is invalid or has expired.'}
              </p>
              <button
                onClick={() => navigate('/settings')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Go to Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show success message
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-8">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-2">
                Password Updated!
              </h1>
              <p className="text-gray-600 dark:text-dark-text-secondary mb-6">
                Your password has been successfully updated. You'll be redirected to your settings page shortly.
              </p>
              <div className="flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 mr-2" />
                <span className="text-sm text-gray-500 dark:text-dark-text-secondary">Redirecting...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
              <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-2">
              Reset Your Password
            </h1>
            <p className="text-gray-600 dark:text-dark-text-secondary">
              {user?.email ? `Resetting password for ${user.email}` : 'Enter your new password below'}
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handlePasswordReset} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-dark-border rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text"
                  placeholder="Enter your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-dark-text-secondary"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-dark-text-secondary">
                <p>Password must contain:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li className={password.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}>
                    At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                    One uppercase letter
                  </li>
                  <li className={/[a-z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                    One lowercase letter
                  </li>
                  <li className={/\d/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                    One number
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-dark-border rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text"
                  placeholder="Confirm your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-dark-text-secondary"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Passwords do not match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword || password !== confirmPassword}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/settings')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
            >
              Back to Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PasswordResetPage