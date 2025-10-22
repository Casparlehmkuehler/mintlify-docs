import React, { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, Github } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { analytics, CTA_NAMES } from '../../services/analytics'

type Step = 'welcome' | 'email' | 'password' | 'signup-name' | 'signup-password'
type AuthMode = 'login' | 'signup'

const LoginFlow: React.FC = () => {
  const [step, setStep] = useState<Step>('welcome')
  const [mode, setMode] = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [passwordVisible, setPasswordVisible] = useState(false)
  
  // Check if this is part of a CLI auth flow
  const isCLIAuth = sessionStorage.getItem('lyceum_auth_callback') !== null
  const source = sessionStorage.getItem('lyceum_auth_source')
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  })

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
    setSuccessMessage(null)
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      setStep('password')
    } else {
      setStep('signup-name')
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      await handleLogin()
    } else {
      await handleSignup()
    }
  }

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStep('signup-password')
  }

  const handleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      
      // Track login button click
      analytics.trackCTA(CTA_NAMES.LOGIN_BUTTON, {
        email: formData.email,
        source: source || 'web'
      })
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })
      
      if (error) {
        throw error
      }
      
      // Track successful login
      if (data.user) {
        // Ensure setup is complete (in case trigger failed during signup)
        console.log('🔧 Calling ensure_user_setup for login user:', data.user.id)
        const { data: setupData, error: setupError } = await supabase.rpc('ensure_user_setup', {
          p_user_id: data.user.id
        });
        
        if (setupError) {
          console.error('❌ Login setup error:', setupError);
        } else {
          console.log('✅ Login user setup complete:', setupData);
        }
        
        analytics.track('login_success', {
          user_id: data.user.id,
          email: data.user.email,
          source: source || 'web',
          method: 'email'
        })
        
        // Track Meta Pixel CompleteRegistration for returning users
        analytics.trackCompleteRegistration({
          user_id: data.user.id,
          login_method: 'email',
          source: source || 'web'
        })
        
        // Track CLI/VSCode authentication success if applicable
        if (source === 'cli') {
          analytics.track('cli_auth_success', {
            user_id: data.user.id,
            email: data.user.email
          })
          analytics.trackSuccessFlow(4, 'cli_authenticated', {
            user_id: data.user.id
          })
        } else if (source === 'vscode') {
          analytics.track('vscode_auth_success', {
            user_id: data.user.id,
            email: data.user.email
          })
          analytics.trackSuccessFlow(4, 'vscode_authenticated', {
            user_id: data.user.id
          })
        }

        // Login successful - redirect will happen automatically
      }
      
    } catch (error: any) {
      setError(error.message)
      analytics.track('login_failed', {
        error: error.message,
        email: formData.email
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    try {
      console.log('🚀 Starting signup process with form data:', { email: formData.email, name: formData.name })
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      
      // Get source from session storage for tracking
      const source = sessionStorage.getItem('lyceum_auth_source')
      
      // Track sign up button click
      analytics.trackCTA(CTA_NAMES.SIGN_UP_BUTTON, {
        email: formData.email,
        name: formData.name,
        source: source || 'web'
      })
      
      console.log('📡 Calling supabase.auth.signUp...')
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            signup_source: source || 'web'
          }
        }
      })
      
      console.log('✅ Supabase signup response received:', { data, error })
      
      if (error) {
        console.error('Signup error details:', error)
        console.log('Error message:', error.message)
        console.log('Error code:', error.code)
        
        // Handle specific signup errors
        if (error.message.includes('already registered')) {
          setError('An account with this email already exists. Please sign in instead.')
          setMode('login')
          setStep('password')
          return
        }
        
        // Show the actual error for debugging
        setError(`Signup failed: ${error.message}`)
        return
      }
      
      // Track successful sign up (success-flow-1)
      if (data.user) {
        console.log('✅ User successfully created:', data.user.id)
        
        // Send confirmation email
        console.log('📧 Sending confirmation email to:', formData.email)
        const { error: confirmError } = await supabase.auth.resend({
          type: 'signup',
          email: formData.email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        })
        
        if (confirmError) {
          console.error('❌ Failed to send confirmation email:', confirmError)
          // Don't fail the signup process, just log the error
        } else {
          console.log('✅ Confirmation email sent successfully')
          setSuccessMessage('Account created successfully! Please check your email to confirm your account.')
        }
        
        // Ensure user setup is complete
        console.log('🔧 Calling ensure_user_setup for signup user:', data.user.id)
        const { data: setupData, error: setupError } = await supabase.rpc('ensure_user_setup', {
          p_user_id: data.user.id
        });
        
        if (setupError) {
          console.error('❌ Signup setup error:', setupError);
        } else {
          console.log('✅ Signup user setup complete:', setupData);
        }
        
        analytics.trackSignUp(data.user.id, {
          email: data.user.email,
          name: formData.name,
          source: source || 'web'
        })
      }
      
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGitHubLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      
      // Track GitHub login CTA
      analytics.trackCTA('github_login', {
        mode: mode,
        source: source || 'web'
      })
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) throw error
      
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      
      // Track Google login CTA
      analytics.trackCTA('google_login', {
        mode: mode,
        source: source || 'web'
      })
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) throw error
      
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    if (step === 'password' || step === 'signup-name') {
      setStep('email')
    } else if (step === 'signup-password') {
      setStep('signup-name')
    } else if (step === 'email') {
      setStep('welcome')
    }
    setError(null)
    setSuccessMessage(null)
  }

  const resetForm = () => {
    setFormData({ email: '', password: '', name: '' })
    setError(null)
    setSuccessMessage(null)
    setPasswordVisible(false)
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    resetForm()
    setStep('email')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-2">
              {step === 'welcome' ? (isCLIAuth ? (source === 'vscode' ? 'Authenticate VSCode Extension' : 'Authenticate Lyceum CLI') : 'Welcome to Lyceum') : 
               mode === 'login' ? 'Sign in to your account' : 'Create your account'}
            </h1>
            <p className="text-gray-600 dark:text-dark-text-secondary">
              {step === 'welcome' ? (isCLIAuth ? 'Please sign in to connect your CLI' : 'Choose how you\'d like to continue') :
               step === 'email' ? 'Enter your email address' :
               step === 'password' ? 'Enter your password' :
               step === 'signup-name' ? 'What should we call you?' :
               step === 'signup-password' ? 'Create a secure password' : ''}
            </p>
          </div>

          {/* Back button */}
          {step !== 'welcome' && (
            <button
              onClick={goBack}
              className="flex items-center text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text mb-6 transition-colors"
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </button>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-sm rounded-md">
              {error}
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="mb-6 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 text-sm rounded-md">
              {successMessage}
            </div>
          )}

          {/* Welcome Step */}
          {step === 'welcome' && (
            <div className="space-y-4">
              <button
                onClick={() => switchMode('login')}
                className="w-full py-3 px-4 border border-gray-300 dark:border-dark-border rounded-md text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                disabled={loading}
              >
                Sign in to existing account
              </button>
              
              <button
                onClick={() => switchMode('signup')}
                className="w-full py-3 px-4 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 transition-colors"
                disabled={loading}
              >
                Create new account
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-dark-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-dark-card text-gray-500 dark:text-dark-text-secondary">or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleGitHubLogin}
                  disabled={loading}
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-dark-border rounded-md text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20 focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <Github className="h-4 w-4 mr-2" />
                  GitHub
                </button>
                
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-dark-border rounded-md text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20 focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google
                </button>
              </div>
            </div>
          )}

          {/* Email Step */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
              
              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                disabled={loading || !formData.email}
              >
                Continue
              </button>
            </form>
          )}

          {/* Password Step (Login) */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-3">
                  Signing in as: <span className="font-medium">{formData.email}</span>
                </p>
                <div className="relative">
                  <input
                    type={passwordVisible ? "text" : "password"}
                    placeholder="Enter your password"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-dark-text-secondary hover:text-gray-600 dark:hover:text-dark-text"
                    disabled={loading}
                  >
                    {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                disabled={loading || !formData.password}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Name Step (Signup) */}
          {step === 'signup-name' && (
            <form onSubmit={handleNameSubmit} className="space-y-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-3">
                  Creating account for: <span className="font-medium">{formData.email}</span>
                </p>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
              
              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                disabled={loading || !formData.name}
              >
                Continue
              </button>
            </form>
          )}

          {/* Password Step (Signup) */}
          {step === 'signup-password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-3">
                  Hi {formData.name}! Create a secure password
                </p>
                <div className="relative">
                  <input
                    type={passwordVisible ? "text" : "password"}
                    placeholder="Create a password (min. 6 characters)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-dark-text-secondary hover:text-gray-600 dark:hover:text-dark-text"
                    disabled={loading}
                  >
                    {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-secondary">
                  Password must be at least 6 characters long
                </p>
              </div>
              
              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                disabled={loading || !formData.password || formData.password.length < 6}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}


        </div>
      </div>
    </div>
  )
}

export default LoginFlow