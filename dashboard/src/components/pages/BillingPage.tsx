import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
// import ExecutionDetailsSidebar from '../ExecutionDetailsSidebar'
import { dataCache, CacheKeys } from '../../services/DataCache'
import { dataPreloader } from '../../services/DataPreloader'
import { usePreloader } from '../../hooks/useCachedData'
import { buildApiUrl } from '../../lib/api'
import { analytics } from '../../services/analytics'

interface CreditsBalance {
  available_credits: number
  used_credits: number
  total_credits_used: number
  remaining_credits: number
  monthly_free_credits: number
  purchased_credits: number
}

interface ExecutionSummary {
  execution_id: string
  created_at: string
  execution_type: string
  status: string
  hardware_profile: string
  billed: number | null
  file_name: string | null
}

interface ExecutionHistory {
  executions: ExecutionSummary[]
  total_executions: number
  total_credits_spent: number
}

interface BillingActivity {
  activity_id: string
  created_at: string
  type: string // 'execution' or 'purchase'
  amount: number | null
  description: string
  status: string
  hardware_profile?: string
}

interface BillingHistory {
  activities: BillingActivity[]
  total_activities: number
}

const BillingPage: React.FC = () => {
  const [credits, setCredits] = useState<CreditsBalance | null>(null)
  const [, setExecutionHistory] = useState<ExecutionHistory | null>(null)
  const [, setBillingActivities] = useState<BillingHistory | null>(null)
  const [, ] = useState<BillingActivity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, ] = useState(false)
  usePreloader()

  useEffect(() => {
    // Check for Stripe success/cancel parameters
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const cancelled = urlParams.get('cancelled')
    
    if (success === 'true') {
      // Track successful credit purchase
      analytics.track('credit_purchase_completed', {
        timestamp: Date.now()
      })
      
      // Track Meta Pixel Purchase event
      analytics.trackPurchase({
        value: 0, // We don't have the exact amount here, but Stripe will handle conversion tracking
        currency: 'USD',
        content_type: 'credits'
      })
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (cancelled === 'true') {
      // Track cancelled purchase
      analytics.track('credit_purchase_cancelled', {
        timestamp: Date.now()
      })
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    
    // Trigger preloading for billing data
    dataPreloader.preloadBillingData()
    fetchCreditsData()
    fetchExecutionHistory()
    fetchBillingActivities()
  }, [])

  const fetchCreditsData = async (forceRefresh: boolean = false) => {
    try {
      const cacheKey = CacheKeys.billingData()
      
      // Try cache first (if not forcing refresh)
      if (!forceRefresh) {
        const cached = dataCache.get(cacheKey)
        if (cached && typeof cached === 'object' && 'credits' in cached) {
          const { credits } = cached as any
          setCredits(credits)
          return
        }
      }
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('Session error:', sessionError)
        setError('Session expired. Please log in again.')
        return
      }
      
      if (!session) {
        console.error('No session found')
        setError('Please log in to view billing information')
        return
      }
      
      console.log('Session found, access token present:', !!session.access_token)

      const response = await fetch(buildApiUrl("/api/v2/external/billing/credits"), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch credits data')
      }

      const data = await response.json()
      
      // Cache the credits data
      dataCache.set(cacheKey, { credits: data }, 5 * 60 * 1000) // 5 minute TTL
      
      setCredits(data)
    } catch (err) {
      console.error('Error fetching credits:', err)
      setError('Failed to load billing information')
    }
  }

  const fetchExecutionHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(buildApiUrl("/api/v2/external/billing/history?limit=10"), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch execution history')
      }

      const data = await response.json()
      setExecutionHistory(data)
    } catch (err) {
      console.error('Error fetching execution history:', err)
    }
  }

  const fetchBillingActivities = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(buildApiUrl("/api/v2/external/billing/activities?limit=3"), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch billing activities')
      }

      const data = await response.json()
      setBillingActivities(data)
    } catch (err) {
      console.error('Error fetching billing activities:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchaseCredits = async (creditsAmount: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      // Track credit purchase attempt
      analytics.track('credit_purchase_initiated', {
        credits_amount: creditsAmount,
        user_id: session?.user?.id
      })
      
      if (!session) {
        setError('Please log in to purchase credits')
        return
      }

      const response = await fetch(buildApiUrl("/api/v2/external/billing/checkout"), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          credits_amount: creditsAmount,
          success_url: `${window.location.origin}/billing?success=true`,
          cancel_url: `${window.location.origin}/billing?cancelled=true`
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        analytics.track('credit_purchase_failed', {
          credits_amount: creditsAmount,
          error: errorData.detail || 'checkout_creation_failed'
        })
        throw new Error(errorData.detail || 'Failed to create checkout session')
      }

      const data = await response.json()
      
      // Track checkout redirect
      analytics.track('credit_purchase_checkout_redirect', {
        credits_amount: creditsAmount,
        checkout_url: data.checkout_url
      })
      
      window.location.href = data.checkout_url
    } catch (err) {
      console.error('Error creating checkout session:', err)
      analytics.track('credit_purchase_error', {
        credits_amount: creditsAmount,
        error: err instanceof Error ? err.message : 'unknown_error'
      })
      setError('Failed to initiate payment process')
    }
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`


  const creditPackages = [
    { credits: 10, price: 1000, popular: false },
    { credits: 25, price: 2500, popular: true },
    { credits: 50, price: 5000, popular: false },
    { credits: 100, price: 10000, popular: false }
  ]

  return (
    <div className="space-y-6 px-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Billing & Credits</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-secondary">Manage your account credits and billing information.</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              <button 
                onClick={() => {
                  setError(null)
                  setLoading(true)
                  fetchCreditsData()
                  fetchExecutionHistory()
                  fetchBillingActivities()
                }}
                className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:text-red-500 dark:hover:text-red-300"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Balance Progress Bar */}
      <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Credit Balance</h2>
        <div className="space-y-4">
          {/* Available Credits Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-dark-text-secondary">Available Credits</span>
              {loading ? (
                <div className="w-32 h-4 bg-gray-200 rounded animate-pulse"></div>
              ) : (
                <span className="font-medium text-gray-900 dark:text-dark-text">
                  {formatCurrency(credits?.available_credits || 0)} / {formatCurrency((credits?.monthly_free_credits || 0) + (credits?.purchased_credits || 0))}
                </span>
              )}
            </div>
            <div className="w-full bg-gray-200 dark:bg-dark-card rounded-full h-3 flex overflow-hidden">
              {loading ? (
                <div className="w-1/3 bg-gray-300 dark:bg-dark-accent/20 h-3 rounded-full animate-pulse"></div>
              ) : credits && (
                <>
                  {/* Blue section for purchased credits still available */}
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 transition-all duration-300 first:rounded-l-full"
                    style={{ 
                      width: `${Math.max(0, (Math.max(0, credits.available_credits - (credits.monthly_free_credits || 0)) / ((credits.monthly_free_credits || 0) + (credits.purchased_credits || 0))) * 100)}%`
                    }}
                  ></div>
                  {/* Green section for monthly free credits still available */}
                  <div 
                    className="bg-gradient-to-r from-green-500 to-green-600 h-3 transition-all duration-300 last:rounded-r-full"
                    style={{ 
                      width: `${Math.max(0, (Math.min(credits.monthly_free_credits || 0, credits.available_credits) / ((credits.monthly_free_credits || 0) + (credits.purchased_credits || 0))) * 100)}%`
                    }}
                  ></div>
                </>
              )}
            </div>
          </div>

          {/* Credit Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-dark-border">
            {loading ? (
              <>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-300 dark:bg-dark-accent/20 rounded-full animate-pulse"></div>
                  <div>
                    <div className="w-32 h-4 bg-gray-200 dark:bg-dark-accent/20 rounded animate-pulse mb-1"></div>
                    <div className="w-16 h-3 bg-gray-200 dark:bg-dark-accent/20 rounded animate-pulse"></div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-300 dark:bg-dark-accent/20 rounded-full animate-pulse"></div>
                  <div>
                    <div className="w-28 h-4 bg-gray-200 dark:bg-dark-accent/20 rounded animate-pulse mb-1"></div>
                    <div className="w-16 h-3 bg-gray-200 dark:bg-dark-accent/20 rounded animate-pulse"></div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-text">Monthly Free Credits</p>
                    <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{formatCurrency(credits?.monthly_free_credits || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-text">Purchased Credits</p>
                    <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{formatCurrency(credits?.purchased_credits || 0)}</p>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Usage Note */}
          <div className="pt-2">
            <p className="text-xs text-gray-500 dark:text-dark-text-secondary italic">
              Monthly free credits are used first before purchased credits
            </p>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Purchase Credits</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {creditPackages.map((pkg) => (
            <div 
              key={pkg.credits}
              className={`relative p-4 border rounded-lg cursor-pointer transition-all hover:border-blue-500 hover:shadow-md ${
                pkg.popular 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' 
                  : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card'
              }`}
              onClick={() => handlePurchaseCredits(pkg.credits)}
            >
              {pkg.popular && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">Popular</span>
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-dark-text">{pkg.credits}</p>
                <p className="text-sm text-gray-600 dark:text-dark-text-secondary">Credits</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-dark-text mt-2">
                  {formatCurrency(pkg.price / 100)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-gray-50 dark:bg-dark-card rounded-lg">
          <p className="text-xs text-gray-600 dark:text-dark-text-secondary">
            Secure payment powered by Stripe • Credits never expire • Instant activation
          </p>
        </div>
      </div>
    </div>
  )
}

export default BillingPage