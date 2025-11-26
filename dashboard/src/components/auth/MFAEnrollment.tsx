/**
 * MFA Enrollment Component
 *
 * Step-by-step modal for MFA enrollment:
 * Step 1: Scan QR code
 * Step 2: Verify with 6-digit code
 * Step 3: Save backup codes
 */

import React, { useState } from 'react'
import { Smartphone, Copy, Check, Download, AlertCircle, Loader2, X, ArrowRight, ArrowLeft } from 'lucide-react'
import { MFAService, type MFAEnrollmentData } from '../../services/MFAService'

interface MFAEnrollmentProps {
  jwtToken: string
  onSuccess: () => void
  onCancel?: () => void
  autoStart?: boolean
}

type EnrollmentStep = 'qr-code' | 'verify' | 'backup-codes'

export const MFAEnrollment: React.FC<MFAEnrollmentProps> = ({
  jwtToken,
  onSuccess,
  onCancel,
  autoStart = false,
}) => {
  const [enrollmentData, setEnrollmentData] = useState<MFAEnrollmentData | null>(null)
  const [currentStep, setCurrentStep] = useState<EnrollmentStep>('qr-code')
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [backupCodesSaved, setBackupCodesSaved] = useState(false)
  const [mfaEnabled, setMfaEnabled] = useState(false)

  React.useEffect(() => {
    if (autoStart) {
      startEnrollment()
    }
  }, [autoStart])

  const startEnrollment = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await MFAService.enroll(jwtToken)
      setEnrollmentData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to start MFA enrollment')
    } finally {
      setLoading(false)
    }
  }

  const verifyEnrollment = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await MFAService.verifyEnrollment(jwtToken, verificationCode)
      setMfaEnabled(true)
      setCurrentStep('backup-codes')
    } catch (err: any) {
      setError(err.message || 'Invalid verification code')
      setVerificationCode('')
    } finally {
      setLoading(false)
    }
  }

  const completeEnrollment = () => {
    if (!backupCodesSaved) {
      setError('Please save your backup codes before continuing')
      return
    }
    onSuccess()
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const downloadBackupCodes = () => {
    if (!enrollmentData) return

    const text = 'MFA Backup Codes\n\n' + enrollmentData.backup_codes.join('\n') + '\n\nKeep these codes in a safe place. Each code can only be used once.'
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mfa-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
    setBackupCodesSaved(true)
  }

  if (loading && !enrollmentData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!enrollmentData) {
    return (
      <div className="text-center py-8">
        <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">
          Enable Two-Factor Authentication
        </h3>
        <p className="text-sm text-gray-500 dark:text-dark-text-secondary mb-6">
          Add an extra layer of security to your account
        </p>
        <button
          onClick={startEnrollment}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Get Started
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onCancel}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white dark:bg-dark-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6 border-b border-gray-200 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 sm:mx-0 sm:h-10 sm:w-10">
                  <Smartphone className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-dark-text">
                    Set up Two-Factor Authentication
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1">
                    {currentStep === 'qr-code' && 'Step 1 of 3: Scan QR Code'}
                    {currentStep === 'verify' && 'Step 2 of 3: Verify Code'}
                    {currentStep === 'backup-codes' && 'Step 3 of 3: Save Backup Codes'}
                  </p>
                </div>
              </div>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  disabled={loading}
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-4 flex space-x-2">
              <div className={`h-1 flex-1 rounded ${currentStep === 'qr-code' || currentStep === 'verify' || currentStep === 'backup-codes' ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
              <div className={`h-1 flex-1 rounded ${currentStep === 'verify' || currentStep === 'backup-codes' ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
              <div className={`h-1 flex-1 rounded ${currentStep === 'backup-codes' ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="px-4 pt-4 sm:px-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3 flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6">
            {/* Step 1: QR Code */}
            {currentStep === 'qr-code' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                  Use an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator to scan this QR code:
                </p>
                <div className="flex justify-center py-4">
                  <img
                    src={`data:image/png;base64,${enrollmentData.qr_code}`}
                    alt="MFA QR Code"
                    className="w-64 h-64 border-4 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
                  />
                </div>

                {/* Manual entry */}
                <div className="bg-gray-50 dark:bg-dark-accent/10 border border-gray-200 dark:border-dark-border rounded-md p-4">
                  <p className="text-xs text-gray-600 dark:text-dark-text-secondary mb-2 font-medium">
                    Can't scan? Enter this code manually:
                  </p>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 text-sm font-mono bg-white dark:bg-dark-card p-3 rounded border border-gray-200 dark:border-dark-border text-gray-900 dark:text-dark-text break-all">
                      {enrollmentData.secret}
                    </code>
                    <button
                      onClick={() => copyToClipboard(enrollmentData.secret, 'secret')}
                      className="p-3 text-gray-500 hover:text-gray-700 dark:text-dark-text-secondary dark:hover:text-dark-text transition-colors border border-gray-200 dark:border-dark-border rounded"
                      title="Copy secret"
                    >
                      {copied === 'secret' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Verify Code */}
            {currentStep === 'verify' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                  Enter the 6-digit code from your authenticator app to verify the setup:
                </p>
                <div className="flex justify-center py-8">
                  <input
                    type="text"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => {
                      setVerificationCode(e.target.value.replace(/\D/g, ''))
                      setError(null)
                    }}
                    className="w-48 px-4 py-4 border-2 border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="000000"
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Tip:</strong> The code refreshes every 30 seconds. Make sure to enter it quickly!
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Backup Codes */}
            {currentStep === 'backup-codes' && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 mb-4">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <strong>Success!</strong> Two-factor authentication has been enabled.
                  </p>
                </div>

                <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                  Save these backup codes in a safe place. Each code can only be used once if you lose access to your authenticator app.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {enrollmentData.backup_codes.map((code, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 dark:bg-dark-accent/10 border border-gray-200 dark:border-dark-border rounded p-3 text-center"
                    >
                      <code className="text-base font-mono text-gray-900 dark:text-dark-text font-semibold">
                        {code}
                      </code>
                    </div>
                  ))}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={downloadBackupCodes}
                    className="flex-1 flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Codes
                  </button>
                  <button
                    onClick={() => {
                      const text = enrollmentData.backup_codes.join('\n')
                      copyToClipboard(text, 'backup-codes')
                      setBackupCodesSaved(true)
                    }}
                    className="px-4 py-3 bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text rounded-md hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors"
                    title="Copy all backup codes"
                  >
                    {copied === 'backup-codes' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {backupCodesSaved && (
                  <div className="flex items-center justify-center text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 rounded-md p-2">
                    <Check className="h-4 w-4 mr-1" />
                    Backup codes saved
                  </div>
                )}

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Important:</strong> These codes won't be shown again. Make sure you've saved them!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-dark-accent/10 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            {currentStep === 'qr-code' && (
              <button
                type="button"
                onClick={() => setCurrentStep('verify')}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Next: Verify Code
              </button>
            )}

            {currentStep === 'verify' && (
              <>
                <button
                  type="button"
                  onClick={verifyEnrollment}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Continue'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('qr-code')}
                  disabled={loading}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-dark-border shadow-sm px-4 py-2 bg-white dark:bg-dark-card text-base font-medium text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Back
                </button>
              </>
            )}

            {currentStep === 'backup-codes' && (
              <button
                type="button"
                onClick={completeEnrollment}
                disabled={!backupCodesSaved}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
              >
                Complete Setup
              </button>
            )}

            {onCancel && currentStep !== 'backup-codes' && (
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-dark-border shadow-sm px-4 py-2 bg-white dark:bg-dark-card text-base font-medium text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
