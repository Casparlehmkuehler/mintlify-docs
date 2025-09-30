import React, { useState, useEffect } from 'react'
import { User, Bell, Shield, Palette, Save, Moon, Sun, Loader2, Lock, AlertCircle, Smartphone, Copy, Check, Trash2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { buildApiUrl } from '../../lib/api'

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
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [manualEntrySecret, setManualEntrySecret] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [setting2FA, setSetting2FA] = useState(false)
  const [copied, setCopied] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)

  // Load profile data
  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  // Helper function to check actual MFA status from Supabase
  const checkMFAStatus = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const hasVerifiedTOTP = factors?.totp?.some(factor => factor.status === 'verified') || false
      return hasVerifiedTOTP
    } catch (error) {
      console.error('Error checking MFA status:', error)
      return false
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
        // Check actual MFA status and sync it
        await checkMFAStatus()
        
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
        redirectTo: window.location.origin + '/settings?password-reset=true'
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

  const handleEnable2FA = async () => {
    try {
      setSetting2FA(true)
      setError(null)

      // First check if user already has factors enrolled
      const { data: existingFactors, error: listError } = await supabase.auth.mfa.listFactors()
      
      if (listError) {
        console.error('List Factors Error:', listError)
        throw listError
      }

      console.log('Existing factors:', existingFactors)

      // If there are existing unverified factors, clean them up first
      if (existingFactors.totp && existingFactors.totp.length > 0) {
        for (const factor of existingFactors.totp) {
          if (factor.status === 'unverified') {
            console.log('Cleaning up unverified factor:', factor.id)
            await supabase.auth.mfa.unenroll({ factorId: factor.id })
          } else if (factor.status === 'verified') {
            setError('Two-factor authentication is already enabled for your account.')
            return
          }
        }
      }

      // Create a unique friendly name with timestamp
      const timestamp = Date.now()
      const friendlyName = `Authenticator App ${timestamp}`

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: friendlyName
      })

      if (error) {
        console.error('MFA Enrollment Error:', error)
        throw error
      }

      console.log('MFA Enrollment Success:', data)
      
      // Store the factor ID for later verification
      setFactorId(data.id)
      setQrCodeUrl(data.totp.qr_code)
      setManualEntrySecret(data.totp.secret)
      setShow2FASetup(true)
    } catch (err: any) {
      if (err.message?.includes('422') || err.message?.includes('MFA is not enabled')) {
        setError('Two-factor authentication is not enabled for this project. Please contact your administrator.')
      } else if (err.code === 'mfa_factor_name_conflict') {
        setError('A setup attempt is already in progress. Please try again in a moment.')
      } else {
        setError('Failed to start 2FA setup: ' + err.message)
      }
      console.error('2FA Setup Error:', err)
    } finally {
      setSetting2FA(false)
    }
  }

  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    if (!factorId) {
      setError('2FA setup error: Missing factor ID. Please try again.')
      return
    }

    try {
      setSetting2FA(true)
      setError(null)

      // First, create a challenge for the factor
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factorId
      })

      if (challengeError) {
        console.error('Challenge Error:', challengeError)
        throw challengeError
      }

      console.log('Challenge created:', challengeData)
      
      // Then verify the challenge with the user's code
      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: challengeData.id,
        code: verificationCode
      })

      if (verifyError) {
        console.error('Verify Error:', verifyError)
        throw verifyError
      }

      console.log('Verification success:', verifyData)

      // Update profile to reflect 2FA is enabled - do this first
      if (profile && user) {
        const updatedProfile = { ...profile, two_factor_enabled: true }
        setProfile(updatedProfile)
        
        // Save to database immediately
        const { error: updateError } = await (supabase as any)
          .from('profiles')
          .update({ two_factor_enabled: true })
          .eq('id', user.id)
          
        if (updateError) {
          console.error('Failed to update 2FA status in database:', updateError)
        }
      }

      setSuccess('Two-factor authentication enabled successfully!')
      setShow2FASetup(false)
      setVerificationCode('')
      setFactorId(null)
      
      // Reload the profile to ensure UI is in sync
      setTimeout(() => {
        setSuccess(null)
        loadProfile()
      }, 1000)
    } catch (err: any) {
      console.error('2FA Verification Error:', err)
      if (err.message?.includes('Invalid TOTP code')) {
        setError('Invalid verification code. Please check your authenticator app and try again.')
      } else {
        setError('Failed to verify 2FA code: ' + err.message)
      }
    } finally {
      setSetting2FA(false)
    }
  }

  const handleDisable2FA = async () => {
    try {
      setSetting2FA(true)
      setError(null)

      // First get all enrolled factors
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
      
      if (factorsError) {
        console.error('List Factors Error:', factorsError)
        throw factorsError
      }

      console.log('Current factors:', factors)

      // Find TOTP factors and unenroll them
      const totpFactors = factors.totp?.filter(factor => factor.status === 'verified') || []
      
      if (totpFactors.length === 0) {
        throw new Error('No active 2FA factors found')
      }

      // Unenroll the first TOTP factor (assuming one factor per user)
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: totpFactors[0].id
      })

      if (unenrollError) {
        console.error('Unenroll Error:', unenrollError)
        throw unenrollError
      }

      // Update profile to reflect 2FA is disabled
      if (profile && user) {
        const updatedProfile = { ...profile, two_factor_enabled: false }
        setProfile(updatedProfile)
        
        // Save to database immediately
        const { error: updateError } = await (supabase as any)
          .from('profiles')
          .update({ two_factor_enabled: false })
          .eq('id', user.id)
          
        if (updateError) {
          console.error('Failed to update 2FA status in database:', updateError)
        }
      }

      setSuccess('Two-factor authentication disabled successfully!')
      
      // Reload the profile to ensure UI is in sync
      setTimeout(() => {
        setSuccess(null)
        loadProfile()
      }, 1000)
    } catch (err: any) {
      console.error('2FA Disable Error:', err)
      setError('Failed to disable 2FA: ' + err.message)
    } finally {
      setSetting2FA(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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

        {/* Notification Preferences */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
          <div className="flex items-center mb-4">
            <Bell className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Notification Preferences</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-dark-text">Email Notifications</p>
                <p className="text-sm text-gray-500 dark:text-dark-text-secondary">Receive important updates via email</p>
              </div>
              <input
                type="checkbox"
                checked={profile?.email_notifications || false}
                onChange={(e) => handleProfileChange('email_notifications', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-dark-border rounded"
              />
            </div>
            <div className="bg-gray-50 dark:bg-dark-accent/10 p-3 rounded-md">
              <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                <strong>Note:</strong> Granular notification settings (run completion, failures, billing, etc.) will be available soon. For now, this controls all email notifications.
              </p>
            </div>
          </div>
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
            
            <div className="pt-4 border-t border-gray-200 dark:border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-1">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary">Add an extra layer of security to your account</p>
                </div>
                <div className="flex items-center">
                  <Smartphone className="h-4 w-4 text-gray-400 dark:text-dark-text-secondary mr-2" />
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    profile?.two_factor_enabled 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : 'bg-gray-100 dark:bg-dark-accent/20 text-gray-600 dark:text-dark-text-secondary'
                  }`}>
                    {profile?.two_factor_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              
              {!profile?.two_factor_enabled ? (
                <button
                  onClick={handleEnable2FA}
                  disabled={setting2FA}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {setting2FA ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Enable 2FA
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <Shield className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                    <span className="text-sm text-green-800 dark:text-green-200">
                      Your account is protected with two-factor authentication.
                    </span>
                  </div>
                  <button
                    onClick={handleDisable2FA}
                    disabled={setting2FA}
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {setting2FA ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Disabling...
                      </>
                    ) : (
                      'Disable 2FA'
                    )}
                  </button>
                </div>
              )}
              
              {/* 2FA Setup Modal */}
              {show2FASetup && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                  <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShow2FASetup(false)}></div>
                    
                    <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                    
                    <div className="inline-block align-bottom bg-white dark:bg-dark-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                      <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 sm:mx-0 sm:h-10 sm:w-10">
                            <Smartphone className="h-6 w-6 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-dark-text">
                              Set up Two-Factor Authentication
                            </h3>
                            <div className="mt-4 space-y-4">
                              <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
                                Scan this QR code with your authenticator app (like Google Authenticator or Authy):
                              </p>
                              
                              {qrCodeUrl && (
                                <div className="flex justify-center">
                                  <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                                </div>
                              )}
                              
                              <div className="bg-gray-50 dark:bg-dark-accent/10 p-3 rounded-md">
                                <p className="text-xs text-gray-600 dark:text-dark-text-secondary mb-2">
                                  Or enter this code manually:
                                </p>
                                <div className="flex items-center space-x-2">
                                  <code className="flex-1 text-sm font-mono bg-gray-100 dark:bg-dark-accent/20 p-2 rounded border text-gray-900 dark:text-dark-text">
                                    {manualEntrySecret}
                                  </code>
                                  <button
                                    onClick={() => copyToClipboard(manualEntrySecret!)}
                                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-dark-text-secondary dark:hover:text-dark-text"
                                  >
                                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                  </button>
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                                  Enter the 6-digit code from your authenticator app:
                                </label>
                                <input
                                  type="text"
                                  value={verificationCode}
                                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text text-center text-lg font-mono"
                                  placeholder="000000"
                                  maxLength={6}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-dark-accent/10 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                          type="button"
                          onClick={handleVerify2FA}
                          disabled={setting2FA || verificationCode.length !== 6}
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          {setting2FA ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Verifying...
                            </>
                          ) : (
                            'Enable 2FA'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShow2FASetup(false)
                            setVerificationCode('')
                            setFactorId(null)
                            setQrCodeUrl(null)
                            setManualEntrySecret(null)
                          }}
                          disabled={setting2FA}
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-dark-border shadow-sm px-4 py-2 bg-white dark:bg-dark-card text-base font-medium text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

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