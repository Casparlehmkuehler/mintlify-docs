/**
 * MFA Verification Component
 *
 * Used during login to verify MFA code.
 * Supports both TOTP codes and backup codes.
 */

import React, { useState } from 'react'
import { Shield, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { MFAService } from '../../services/MFAService'

interface MFAVerificationProps {
  jwtToken: string
  onSuccess: () => void
  onBack?: () => void
  userEmail?: string
}

export const MFAVerification: React.FC<MFAVerificationProps> = ({
  jwtToken,
  onSuccess,
  onBack,
  userEmail,
}) => {
  const [code, setCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [remainingBackupCodes, setRemainingBackupCodes] = useState<number | null>(null)

  const handleVerify = async () => {
    const trimmedCode = code.trim()

    if (!trimmedCode) {
      setError('Please enter a code')
      return
    }

    if (!useBackupCode && trimmedCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    if (useBackupCode && trimmedCode.length !== 8) {
      setError('Please enter a valid 8-character backup code')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const result = await MFAService.verify(jwtToken, trimmedCode)

      // Show warning if backup code was used
      if (result.remaining_backup_codes !== undefined) {
        setRemainingBackupCodes(result.remaining_backup_codes)
        // Give user a moment to see the warning before proceeding
        setTimeout(() => {
          onSuccess()
        }, 1500)
      } else {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please try again.')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleVerify()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-2">
              Two-Factor Authentication
            </h2>
            <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
              {userEmail && (
                <>
                  Signing in as <span className="font-medium">{userEmail}</span>
                  <br />
                </>
              )}
              {useBackupCode
                ? 'Enter one of your backup codes'
                : 'Enter the 6-digit code from your authenticator app'}
            </p>
          </div>

          {/* Back button */}
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text mb-6 transition-colors"
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </button>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Backup code warning */}
          {remainingBackupCodes !== null && (
            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Backup code used.</strong> You have {remainingBackupCodes} backup code
                {remainingBackupCodes !== 1 ? 's' : ''} remaining.
                {remainingBackupCodes <= 2 && (
                  <> Consider regenerating new backup codes from your settings.</>
                )}
              </p>
            </div>
          )}

          {/* Code input */}
          <div className="space-y-6">
            <div>
              <input
                type="text"
                maxLength={useBackupCode ? 8 : 6}
                value={code}
                onChange={(e) => {
                  const input = e.target.value.toUpperCase()
                  setCode(useBackupCode ? input.replace(/[^A-Z0-9]/g, '') : input.replace(/\D/g, ''))
                  setError(null)
                }}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text text-center text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={useBackupCode ? 'ABCD1234' : '000000'}
                disabled={loading}
                autoFocus
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={loading || !code.trim()}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </button>

            {/* Toggle backup code */}
            <div className="text-center">
              <button
                onClick={() => {
                  setUseBackupCode(!useBackupCode)
                  setCode('')
                  setError(null)
                }}
                disabled={loading}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 transition-colors"
              >
                {useBackupCode ? 'Use authenticator app code' : 'Use backup code instead'}
              </button>
            </div>
          </div>

          {/* Help text */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-border">
            <p className="text-xs text-gray-500 dark:text-dark-text-secondary text-center">
              {useBackupCode ? (
                <>
                  Backup codes are 8 characters long and can only be used once. If you've used all
                  your backup codes, you'll need to contact support.
                </>
              ) : (
                <>
                  Can't access your authenticator app? Use a backup code instead. If you've lost
                  both, please contact support.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
