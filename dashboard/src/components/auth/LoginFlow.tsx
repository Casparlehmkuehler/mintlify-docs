import React, { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, Github } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { analytics, CTA_NAMES } from '../../services/analytics'
import { MFAService } from '../../services/MFAService'
import { MFAEnrollment } from './MFAEnrollment'
import { MFAVerification } from './MFAVerification'

type Step = 'welcome' | 'email' | 'password' | 'signup-name' | 'signup-password' | 'signup-mfa-prompt' | 'signup-mfa-setup' | 'mfa-verify'
type AuthMode = 'login' | 'signup'

const LoginFlow: React.FC = () => {
  const [step, setStep] = useState<Step>('welcome')
  const [mode, setMode] = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [jwtToken, setJwtToken] = useState<string | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)

  // Check if this is part of a CLI auth flow
  const isCLIAuth = sessionStorage.getItem('lyceum_auth_callback') !== null
  const source = sessionStorage.getItem('lyceum_auth_source')

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  })
  const [emailNotifications, setEmailNotifications] = useState(true)

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
      if (data.user && data.session) {
        // Store JWT token for MFA verification
        setJwtToken(data.session.access_token)

        // Check if MFA is enabled for this user
        try {
          console.log('🔐 Checking MFA status for user:', data.user.id)
          const mfaStatus = await MFAService.getStatus(data.session.access_token)
          console.log('🔐 MFA Status:', mfaStatus)

          if (mfaStatus.enabled) {
            // MFA is enabled, show verification screen but keep session
            console.log('🔐 MFA is enabled, showing verification screen')
            // Mark that MFA is pending in sessionStorage
            sessionStorage.setItem('mfa_pending', 'true')
            setMfaRequired(true)
            setStep('mfa-verify')
            setLoading(false)
            return
          }

          console.log('🔐 MFA is not enabled, proceeding with normal login')
          // Clear any MFA pending flag
          sessionStorage.removeItem('mfa_pending')
        } catch (mfaError: any) {
          console.error('❌ Error checking MFA status:', mfaError)
          console.error('❌ Error details:', {
            message: mfaError?.message,
            response: mfaError?.response,
          })
          // If MFA check fails, continue with login (don't block user)
        }

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
            signup_source: source || 'web',
            email_notifications: emailNotifications
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

        // Check if email confirmation is required (no session means confirmation required)
        const requiresEmailConfirmation = !data.session

        if (data.session) {
          // Store JWT token for MFA enrollment
          setJwtToken(data.session.access_token)

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
        }

        analytics.trackSignUp(data.user.id, {
          email: data.user.email,
          name: formData.name,
          source: source || 'web'
        })

        // TODO: Re-enable MFA prompt once backend is fully implemented
        // setStep('signup-mfa-prompt')

        // Show appropriate message based on whether email confirmation is required
        if (requiresEmailConfirmation) {
          setSuccessMessage('Account created! Please check your email to confirm your account before signing in.')
          // Don't redirect - user needs to confirm email first
          setTimeout(() => {
            setMode('login')
            setStep('email')
          }, 3000)
        } else {
          // Email confirmation not required - user can access dashboard immediately
          setSuccessMessage('Account created successfully! Redirecting to dashboard...')
          setTimeout(() => {
            navigate('/', { replace: true })
          }, 2000)
        }
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
    } else if (step === 'signup-mfa-setup') {
      setStep('signup-mfa-prompt')
    } else if (step === 'mfa-verify') {
      setStep('password')
      setMfaRequired(false)
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

              <div className="space-y-4">
                <label className="flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-dark-border rounded"
                  />
                  <span className="ml-2 text-sm text-gray-400 dark:text-gray-500">
                    Send me email notifications about my account
                  </span>
                </label>

                <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                  By signing up you agree to our{' '}
                  <a
                    href="https://lyceum.technology/terms-conditions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 underline"
                  >
                    terms and conditions
                  </a>
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

          {/* MFA Prompt Step (Signup) */}
          {step === 'signup-mfa-prompt' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">
                  Account Created Successfully!
                </h3>
                <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                  Welcome to Lyceum, {formData.name}!
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                  Secure your account with Two-Factor Authentication
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Add an extra layer of security to protect your account. You'll need an authenticator app like Google Authenticator or Authy.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setStep('signup-mfa-setup')}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors font-medium"
                >
                  Enable Two-Factor Authentication
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-3 px-4 border border-gray-300 dark:border-dark-border rounded-md text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20 focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  Skip for Now
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-dark-text-secondary text-center">
                You can enable two-factor authentication later from your account settings.
              </p>
            </div>
          )}

          {/* MFA Setup Step (Signup) */}
          {step === 'signup-mfa-setup' && jwtToken && (
            <MFAEnrollment
              jwtToken={jwtToken}
              onSuccess={() => {
                setSuccessMessage('Two-factor authentication enabled successfully!')
                setTimeout(() => window.location.reload(), 2000)
              }}
              onCancel={() => setStep('signup-mfa-prompt')}
              autoStart={true}
            />
          )}

        </div>
      </div>

      {/* MFA Verification Step (Login) - Full Screen */}
      {step === 'mfa-verify' && jwtToken && (
        <MFAVerification
          jwtToken={jwtToken}
          onSuccess={() => {
            console.log('🔐 MFA verification successful, clearing pending flag')
            // Clear the MFA pending flag
            sessionStorage.removeItem('mfa_pending')
            setSuccessMessage('MFA verification successful!')
            // Redirect will happen automatically via AuthContext
            window.location.reload()
          }}
          onBack={goBack}
          userEmail={formData.email}
        />
      )}
    </div>
  )
}

export default LoginFlow