import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Mail, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { EmailPreferencesApi } from '../../services/emailPreferencesApi'

const UnsubscribePage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const email = searchParams.get('email')

  const [selectedOption, setSelectedOption] = useState<'all' | 'specific'>('all')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [unsubscribing, setUnsubscribing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!email) {
      setError('No email address provided. Please use the unsubscribe link from your email.')
    }
  }, [email])

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category))
    } else {
      setSelectedCategories([...selectedCategories, category])
    }
  }

  const handleUnsubscribe = async () => {
    if (!email) {
      setError('No email address provided')
      return
    }

    if (selectedOption === 'specific' && selectedCategories.length === 0) {
      setError('Please select at least one category to unsubscribe from')
      return
    }

    try {
      setUnsubscribing(true)
      setError(null)

      const categoriesToUnsubscribe = selectedOption === 'all' ? ['all'] : selectedCategories

      await EmailPreferencesApi.unsubscribe(email, categoriesToUnsubscribe)
      setIsSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to unsubscribe. Please try again.')
    } finally {
      setUnsubscribing(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-8 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-2">
            You've been unsubscribed
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary mb-6">
            You will no longer receive the selected email categories.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/settings')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Go to Settings
            </button>
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
              Want more control over your email preferences?{' '}
              <a href="/login" className="text-blue-600 hover:text-blue-700 underline">
                Log in to manage preferences
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-8">
        <div className="flex items-center mb-6">
          <Mail className="h-8 w-8 text-gray-500 dark:text-dark-text-secondary mr-3" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
            Unsubscribe from Emails
          </h1>
        </div>

        {email && (
          <div className="mb-6 p-3 bg-gray-50 dark:bg-dark-accent/10 rounded-md">
            <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
              Email: <span className="font-medium text-gray-900 dark:text-dark-text">{email}</span>
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="flex items-start cursor-pointer">
              <input
                type="radio"
                name="unsubscribe-option"
                checked={selectedOption === 'all'}
                onChange={() => setSelectedOption('all')}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                  Unsubscribe from all emails
                </p>
                <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
                  Stop receiving all non-critical emails (marketing, transactional, job notifications, billing)
                </p>
              </div>
            </label>
          </div>

          <div>
            <label className="flex items-start cursor-pointer">
              <input
                type="radio"
                name="unsubscribe-option"
                checked={selectedOption === 'specific'}
                onChange={() => setSelectedOption('specific')}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                  Choose specific categories
                </p>
                <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
                  Select which types of emails you want to unsubscribe from
                </p>
              </div>
            </label>
          </div>

          {selectedOption === 'specific' && (
            <div className="ml-7 mt-4 space-y-3 p-4 bg-gray-50 dark:bg-dark-accent/10 rounded-md">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes('marketing')}
                  onChange={() => handleCategoryToggle('marketing')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-900 dark:text-dark-text">
                  Marketing & Product Updates
                </span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes('transactional')}
                  onChange={() => handleCategoryToggle('transactional')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-900 dark:text-dark-text">
                  Transactional Emails
                </span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes('security')}
                  onChange={() => handleCategoryToggle('security')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-900 dark:text-dark-text">
                  Security Alerts (Not recommended)
                </span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes('job_notifications')}
                  onChange={() => handleCategoryToggle('job_notifications')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-900 dark:text-dark-text">
                  Job Notifications
                </span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes('billing')}
                  onChange={() => handleCategoryToggle('billing')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-900 dark:text-dark-text">
                  Billing & Payments
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-md mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> Password reset emails are always sent for security reasons, regardless of your preferences.
          </p>
        </div>

        <button
          onClick={handleUnsubscribe}
          disabled={unsubscribing || !email}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {unsubscribing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Unsubscribing...
            </>
          ) : (
            'Unsubscribe'
          )}
        </button>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-dark-text-secondary">
          Want more control?{' '}
          <a href="/login" className="text-blue-600 hover:text-blue-700 underline">
            Log in to manage all preferences
          </a>
        </p>
      </div>
    </div>
  )
}

export default UnsubscribePage
