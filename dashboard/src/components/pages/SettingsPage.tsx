import React, { useState, useEffect } from 'react'
import { User, Shield, Palette, Save, Moon, Sun, Loader2, Lock, AlertCircle, Trash2, Mail, ChevronDown, ChevronUp, Github } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { buildApiUrl } from '../../lib/api'
import { MFASettings } from '../settings/MFASettings'
import { EmailPreferencesApi, EmailPreferences } from '../../services/emailPreferencesApi'

type Profile = Database['public']['Tables']['profiles']['Row']

const SettingsPage: React.FC = () => {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [jwtToken, setJwtToken] = useState<string | null>(null)
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences | null>(null)
  const [loadingEmailPrefs, setLoadingEmailPrefs] = useState(false)
  const [savingEmailPrefs, setSavingEmailPrefs] = useState(false)
  const [showEmailPrefs, setShowEmailPrefs] = useState(false)
  const [authProvider, setAuthProvider] = useState<'email' | 'github' | 'google' | null>(null)

  // Load profile data and JWT token
  useEffect(() => {
    if (user) {
      loadProfile()
      loadJWTToken()
    }
  }, [user])

  const loadJWTToken = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setJwtToken(session.access_token)
        // Load email preferences once we have the token
        loadEmailPreferences(session.access_token)

        // Detect auth provider
        const { data: { user: authUser } } = await supabase.auth.getUser()
        const provider = authUser?.app_metadata?.provider || 'email'
        setAuthProvider(provider as 'email' | 'github' | 'google')
      }
    } catch (error) {
      console.error('Error loading JWT token:', error)
    }
  }

  const loadEmailPreferences = async (token: string) => {
    try {
      setLoadingEmailPrefs(true)
      const prefs = await EmailPreferencesApi.getEmailPreferences(token)
      setEmailPreferences(prefs)
    } catch (error) {
      console.error('Error loading email preferences:', error)
      // Don't show error to user for this, just log it
    } finally {
      setLoadingEmailPrefs(false)
    }
  }

  const loadProfile = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single()

      if (error) {
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          await createProfile()
        } else {
          throw error
        }
      } else {
        setProfile(data)
      }
    } catch (err: any) {
      setError('Failed to load profile: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const createProfile = async () => {
    try {
      const newProfile: Database['public']['Tables']['profiles']['Insert'] = {
        id: user!.id,
        email: user!.email || null,
        full_name: user!.user_metadata?.full_name || null,
        email_notifications: true,
        dark_mode: false,
        language: 'en',
        onboarding_completed: false,
        two_factor_enabled: false
      }

      const { data, error } = await (supabase as any)
        .from('profiles')
        .insert(newProfile)
        .select()
        .single()

      if (error) throw error
      setProfile(data)
    } catch (err: any) {
      setError('Failed to create profile: ' + err.message)
    }
  }

  const handleProfileChange = (field: keyof Profile, value: string | boolean) => {
    if (profile) {
      setProfile(prev => ({ ...prev!, [field]: value }))
    }
  }

  const handleEmailPreferenceChange = (field: keyof EmailPreferences, value: boolean) => {
    if (emailPreferences) {
      setEmailPreferences(prev => ({ ...prev!, [field]: value }))
    }
  }

  const handleSaveEmailPreferences = async () => {
    if (!emailPreferences || !jwtToken) return

    try {
      setSavingEmailPrefs(true)
      setError(null)
      setSuccess(null)

      await EmailPreferencesApi.updateEmailPreferences(jwtToken, emailPreferences)

      setSuccess('Email preferences updated successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError('Failed to save email preferences: ' + err.message)
    } finally {
      setSavingEmailPrefs(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!profile || !user) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const updates: Database['public']['Tables']['profiles']['Update'] = {
        full_name: profile.full_name,
        username: profile.username,
        email_notifications: profile.email_notifications,
        language: profile.language,
        two_factor_enabled: profile.two_factor_enabled
      }

      const { error } = await (supabase as any)
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (error) throw error

      setSuccess('Profile updated successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError('Failed to save profile: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    try {
      setChangingPassword(true)
      setError(null)

      // Always use password reset email for security
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
        redirectTo: window.location.origin + '/reset-password'
      })

      if (error) throw error

      setSuccess('Password reset email sent! Check your inbox and follow the link to reset your password.')
      setTimeout(() => setSuccess(null), 4000)
    } catch (err: any) {
      setError('Failed to send password reset email: ' + err.message)
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion')
      return
    }

    try {
      setDeleting(true)
      setError(null)

      // Call the backend API to delete user account
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('User not authenticated')
        return
      }

      const response = await fetch(buildApiUrl("/api/v2/external/user/delete"), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to delete account')
      }

      // Sign out the user after successful deletion
      await supabase.auth.signOut()
      
      // Redirect will happen automatically via AuthContext
    } catch (err: any) {
      setError('Failed to delete account: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-500 dark:text-dark-text-secondary">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 px-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Settings</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-dark-text-secondary">Manage your account preferences and configurations.</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}


      <div className="grid grid-cols-1 gap-5">
        {/* Profile Settings */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
          <div className="flex items-center mb-4">
            <User className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Profile Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={profile?.full_name || ''}
                onChange={(e) => handleProfileChange('full_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text"
                placeholder="Enter your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                Username
              </label>
              <input
                type="text"
                value={profile?.username || ''}
                onChange={(e) => handleProfileChange('username', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text"
                placeholder="Enter a username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md bg-gray-50 dark:bg-dark-accent/10 text-gray-500 dark:text-dark-text-secondary cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-dark-text-secondary mt-1">
                Email cannot be changed here. Contact support if needed.
              </p>
            </div>
          </div>
        </div>

        {/* Email Preferences */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
          <button
            onClick={() => setShowEmailPrefs(!showEmailPrefs)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center">
              <Mail className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary mr-2" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Email Preferences</h2>
            </div>
            <div className="flex items-center">
              {loadingEmailPrefs && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 mr-2" />
              )}
              {showEmailPrefs ? (
                <ChevronUp className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
              )}
            </div>
          </button>

          {showEmailPrefs && emailPreferences ? (
            <div className="space-y-4 mt-4">
              <div className="flex items-start justify-between py-3 border-b border-gray-200 dark:border-dark-border">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-text">Marketing & Product Updates</p>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1">
                    Occasional emails about new features, tips, and product announcements
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailPreferences.email_marketing}
                  onChange={(e) => handleEmailPreferenceChange('email_marketing', e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-dark-border rounded"
                />
              </div>

              <div className="flex items-start justify-between py-3 border-b border-gray-200 dark:border-dark-border">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-text">Transactional Emails</p>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1">
                    Account-related emails like welcome messages and verification requests
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailPreferences.email_transactional}
                  onChange={(e) => handleEmailPreferenceChange('email_transactional', e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-dark-border rounded"
                />
              </div>

              <div className="flex items-start justify-between py-3 border-b border-gray-200 dark:border-dark-border">
                <div className="flex-1">
                  <div className="flex items-center">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-text">Security Alerts</p>
                    <AlertCircle className="h-4 w-4 ml-2 text-orange-500" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1">
                    Important security notifications about your account (Recommended)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailPreferences.email_security}
                  onChange={(e) => handleEmailPreferenceChange('email_security', e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-dark-border rounded"
                />
              </div>

              <div className="flex items-start justify-between py-3 border-b border-gray-200 dark:border-dark-border">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-text">Job Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1">
                    Notifications when your jobs complete or fail
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailPreferences.email_job_notifications}
                  onChange={(e) => handleEmailPreferenceChange('email_job_notifications', e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-dark-border rounded"
                />
              </div>

              <div className="flex items-start justify-between py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-text">Billing & Payments</p>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1">
                    Receipts, payment confirmations, and low credit warnings
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailPreferences.email_billing}
                  onChange={(e) => handleEmailPreferenceChange('email_billing', e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-dark-border rounded"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-md mt-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> Password reset emails are always sent for security reasons, regardless of your preferences.
                </p>
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={handleSaveEmailPreferences}
                  disabled={savingEmailPrefs}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingEmailPrefs ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Email Preferences
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : showEmailPrefs && !emailPreferences ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
                {loadingEmailPrefs ? 'Loading email preferences...' : 'Unable to load email preferences'}
              </p>
            </div>
          ) : null}
        </div>

        {/* Appearance Settings */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
          <div className="flex items-center mb-4">
            <Palette className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Appearance</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-dark-text">Dark Mode</p>
              <p className="text-sm text-gray-500 dark:text-dark-text-secondary">Toggle between light and dark theme</p>
            </div>
            <button
              onClick={toggleTheme}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-dark-accent/20 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <span className="sr-only">Toggle dark mode</span>
              <span
                className={`${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform flex items-center justify-center`}
              >
                {theme === 'dark' ? (
                  <Moon className="h-3 w-3 text-gray-700" />
                ) : (
                  <Sun className="h-3 w-3 text-yellow-500" />
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
          <div className="flex items-center mb-4">
            <Shield className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Security</h2>
          </div>
          <div className="space-y-4">
            {/* Password Reset - Only for email/password auth users */}
            {authProvider === 'email' && (
              <div>
                <button
                  onClick={handlePasswordChange}
                  disabled={changingPassword}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending Reset Email...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Send Password Reset Email
                    </>
                  )}
                </button>
                <p className="mt-2 text-sm text-gray-500 dark:text-dark-text-secondary">
                  You'll receive an email with a secure link to reset your password.
                </p>
              </div>
            )}

            {/* OAuth Provider Info - For GitHub users */}
            {authProvider === 'github' && (
              <div className="flex items-start p-4 bg-gray-50 dark:bg-dark-accent/10 rounded-lg border border-gray-200 dark:border-dark-border">
                <Github className="h-5 w-5 text-gray-600 dark:text-dark-text-secondary mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                    You sign in with GitHub
                  </p>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1">
                    Password management is handled through your GitHub account.
                  </p>
                </div>
              </div>
            )}

            {/* OAuth Provider Info - For Google users */}
            {authProvider === 'google' && (
              <div className="flex items-start p-4 bg-gray-50 dark:bg-dark-accent/10 rounded-lg border border-gray-200 dark:border-dark-border">
                <svg className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                    You sign in with Google
                  </p>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1">
                    Password management is handled through your Google account.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MFA Settings */}
        {jwtToken && <MFASettings jwtToken={jwtToken} />}

        {/* Delete Account Section */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-6 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Delete Account
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>
                  Once you delete your account, there is no going back. This action cannot be undone and will permanently delete:
                </p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setShowDeleteAccount(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:text-red-200 dark:hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button 
            onClick={handleSaveProfile}
            disabled={saving || !profile}
            className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-dark-card rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-500 mr-3" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Delete Account</h2>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-4">
                This action cannot be undone. This will permanently delete your account and remove all data associated with it.
              </p>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3 mb-4">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  All of your data will be permanently deleted, including:
                </p>
                <ul className="mt-1 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                  <li>Profile and account settings</li>
                  <li>Execution history and runs</li>
                  <li>API keys and tokens</li>
                  <li>Files and storage data</li>
                  <li>Billing and payment records</li>
                </ul>
              </div>

              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-red-500 focus:border-red-500"
                placeholder="Type DELETE here"
                disabled={deleting}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteAccount(false)
                  setDeleteConfirmation('')
                  setError(null)
                }}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 dark:border-dark-border rounded-md text-sm font-medium text-gray-700 dark:text-dark-text-secondary bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmation !== 'DELETE'}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsPage