/**
 * MFA Settings Component
 *
 * Manages MFA enable/disable in user settings.
 * Uses the backend MFA API instead of Supabase MFA.
 */

import React, { useState, useEffect } from 'react'
import { Shield, Smartphone, Loader2, AlertCircle } from 'lucide-react'
import { MFAService } from '../../services/MFAService'
import { MFAEnrollment } from '../auth/MFAEnrollment'

interface MFASettingsProps {
  jwtToken: string
}

export const MFASettings: React.FC<MFASettingsProps> = ({ jwtToken }) => {
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showEnrollment, setShowEnrollment] = useState(false)
  const [showDisableModal, setShowDisableModal] = useState(false)
  const [disableCode, setDisableCode] = useState('')
  const [disabling, setDisabling] = useState(false)
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null)

  useEffect(() => {
    checkMFAStatus()
  }, [jwtToken])

  const checkMFAStatus = async () => {
    try {
      setLoading(true)
      setError(null)
      const status = await MFAService.getStatus(jwtToken)
      setMfaEnabled(status.enabled)
      setEnrolledAt(status.enrolled_at || null)
    } catch (err: any) {
      console.error('Error checking MFA status:', err)
      setError('Failed to load MFA status')
    } finally {
      setLoading(false)
    }
  }

  const handleEnableMFA = () => {
    setShowEnrollment(true)
    setError(null)
    setSuccess(null)
  }

  const handleDisableMFA = async () => {
    if (!disableCode || disableCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    try {
      setDisabling(true)
      setError(null)
      await MFAService.disable(jwtToken, disableCode)
      setSuccess('Two-factor authentication disabled successfully!')
      setMfaEnabled(false)
      setShowDisableModal(false)
      setDisableCode('')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to disable MFA')
    } finally {
      setDisabling(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
        <div className="flex items-center mb-4">
          <Shield className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Two-Factor Authentication</h2>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
            <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {!showEnrollment ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-1">
                  Two-Factor Authentication
                </h3>
                <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
                  Add an extra layer of security to your account with TOTP authentication
                </p>
                {enrolledAt && (
                  <p className="text-xs text-gray-400 dark:text-dark-text-secondary mt-1">
                    Enabled on {new Date(enrolledAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center">
                <Smartphone className="h-4 w-4 text-gray-400 dark:text-dark-text-secondary mr-2" />
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    mfaEnabled
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : 'bg-gray-100 dark:bg-dark-accent/20 text-gray-600 dark:text-dark-text-secondary'
                  }`}
                >
                  {mfaEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {!mfaEnabled ? (
              <button
                onClick={handleEnableMFA}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <Shield className="h-4 w-4 mr-2" />
                Enable 2FA
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
                  onClick={() => setShowDisableModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Disable 2FA
                </button>
              </div>
            )}
          </div>
        ) : (
          <MFAEnrollment
            jwtToken={jwtToken}
            onSuccess={() => {
              setSuccess('Two-factor authentication enabled successfully!')
              setMfaEnabled(true)
              setShowEnrollment(false)
              checkMFAStatus()
            }}
            onCancel={() => setShowEnrollment(false)}
            autoStart={true}
          />
        )}
      </div>

      {/* Disable MFA Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => !disabling && setShowDisableModal(false)}
            ></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-dark-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-dark-text">
                      Disable Two-Factor Authentication
                    </h3>
                    <div className="mt-4 space-y-4">
                      <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
                        Disabling two-factor authentication will make your account less secure. Enter your current 6-digit code to confirm.
                      </p>

                      {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3">
                          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                          Enter 6-digit code from your authenticator app:
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={disableCode}
                          onChange={(e) => {
                            setDisableCode(e.target.value.replace(/\D/g, ''))
                            setError(null)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md focus:ring-red-500 focus:border-red-500 bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text text-center text-lg font-mono"
                          placeholder="000000"
                          disabled={disabling}
                          autoFocus
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-dark-accent/10 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDisableMFA}
                  disabled={disabling || disableCode.length !== 6}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {disabling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Disabling...
                    </>
                  ) : (
                    'Disable 2FA'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisableModal(false)
                    setDisableCode('')
                    setError(null)
                  }}
                  disabled={disabling}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-dark-border shadow-sm px-4 py-2 bg-white dark:bg-dark-card text-base font-medium text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
