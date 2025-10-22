import React, { useState, useEffect } from 'react'
import { AlertCircle, ExternalLink, RotateCcw, Cpu, Zap, Server, CheckCircle, X, Send, Check } from 'lucide-react'
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
  local_imports?: string[] | null
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
  local_imports?: string[] | null
}

interface BillingHistory {
  activities: BillingActivity[]
  total_activities: number
}

interface Invoice {
  id: string
  number: string
  status: string
  amount_paid: number
  amount_due: number
  currency: string
  created: number
  hosted_invoice_url: string
  invoice_pdf: string
  description?: string
}

const BillingPage: React.FC = () => {
  const [credits, setCredits] = useState<CreditsBalance | null>(null)
  const [, setExecutionHistory] = useState<ExecutionHistory | null>(null)
  const [, setBillingActivities] = useState<BillingHistory | null>(null)
  const [, ] = useState<BillingActivity | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, ] = useState(false)
  const [availableHardware, setAvailableHardware] = useState<string[]>([])
  const [hardwareLoading, setHardwareLoading] = useState(false)
  const [hardwarePricing, setHardwarePricing] = useState<{[key: string]: string}>({})
  const [showHardwareRequestModal, setShowHardwareRequestModal] = useState(false)
  const [hardwareRequestForm, setHardwareRequestForm] = useState({
    hardwareTypes: [] as string[],
    useCase: '',
    estimatedUsage: '',
    additionalInfo: ''
  })
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null)
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
    fetchInvoices()
    fetchAvailableHardware()
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
        const errorText = await response.text()
        console.error('Execution history API error response:', errorText)
        throw new Error('Failed to fetch execution history')
      }

      const data = await response.json()
      console.log('Execution history data received:', data)
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

  const fetchHardwarePricing = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.log('No session found for pricing fetch')
        return {}
      }

      const response = await fetch(buildApiUrl("/api/v2/external/machine-types"), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        console.warn('Failed to fetch machine types data')
        return {}
      }

      const data = await response.json()
      console.log('Machine types API response:', data) // Debug log
      const pricingMap: {[key: string]: string} = {}
      
      if (data.machine_types && Array.isArray(data.machine_types)) {
        data.machine_types.forEach((item: any) => {
          if (item.hardware_profile && item.price_per_hour) {
            // Convert per hour to per minute
            const pricePerMinute = (item.price_per_hour / 60).toFixed(3)
            pricingMap[item.hardware_profile] = `$${pricePerMinute}/min`
          }
        })
      }
      
      return pricingMap
    } catch (err) {
      console.error('Error fetching machine types:', err)
      return {}
    }
  }

  const fetchAvailableHardware = async () => {
    try {
      setHardwareLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.log('No session found for hardware fetch')
        return
      }

      // Fetch both hardware and pricing data in parallel
      const [hardwareResponse, pricingData] = await Promise.all([
        fetch(buildApiUrl("/api/v2/external/user/quotas/available-hardware"), {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }),
        fetchHardwarePricing()
      ])

      if (!hardwareResponse.ok) {
        throw new Error('Failed to fetch available hardware')
      }

      const hardwareData = await hardwareResponse.json()
      setAvailableHardware(hardwareData.available_hardware_profiles || [])
      setHardwarePricing(pricingData)
    } catch (err) {
      console.error('Error fetching available hardware:', err)
      // Don't set error for hardware as it's not critical
    } finally {
      setHardwareLoading(false)
    }
  }

  const fetchInvoices = async () => {
    try {
      setInvoicesLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.log('No session found for invoice fetch')
        return
      }

      const response = await fetch(buildApiUrl("/api/v2/external/billing/invoices"), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch invoices')
      }

      const data = await response.json()
      setInvoices(data.invoices || [])
    } catch (err) {
      console.error('Error fetching invoices:', err)
      // Don't set error for invoices as it's not critical
    } finally {
      setInvoicesLoading(false)
    }
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const creditPackages = [
    { credits: 10, price: 1000, popular: false },
    { credits: 25, price: 2500, popular: true },
    { credits: 50, price: 5000, popular: false },
    { credits: 100, price: 10000, popular: false }
  ]

  const getHardwareIcon = (profile: string) => {
    const normalizedProfile = profile.toLowerCase()
    if (normalizedProfile.includes('cpu')) {
      return <Cpu className="h-5 w-5" />
    } else if (normalizedProfile.includes('gpu') || normalizedProfile.includes('a10') || normalizedProfile.includes('h100')) {
      return <Zap className="h-5 w-5" />
    } else {
      return <Server className="h-5 w-5" />
    }
  }

  const getHardwareDisplayName = (profile: string) => {
    const profileMap: { [key: string]: string } = {
      'cpu': 'CPU',
      'gpu': 'NVIDIA T4',
      'gpu_a10': 'GPU A10 (24GB)',
      'gpu_h100': 'GPU H100 (80GB)',
      'gpu_4xa10': 'GPU 4xA10 (96GB)',
      'gpu_8xh100': 'GPU 8xH100 (640GB)'
    }
    return profileMap[profile.toLowerCase()] || profile.toUpperCase()
  }

  const handleHardwareRequestSubmit = async () => {
    if (!hardwareRequestForm.useCase.trim()) {
      alert('Please describe your use case')
      return
    }
    if (hardwareRequestForm.hardwareTypes.length === 0) {
      alert('Please select at least one hardware type')
      return
    }

    setSubmittingRequest(true)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userEmail = session?.user?.email || 'Unknown'
      const userId = session?.user?.id || 'Unknown'
      
      // Get user's full name from user metadata or email
      const userName = session?.user?.user_metadata?.full_name || 
                      session?.user?.user_metadata?.name || 
                      userEmail.split('@')[0] // Fallback to email prefix
      
      // Use Web3Forms to send the email
      const formData = {
        access_key: import.meta.env.VITE_WEB3FORMS_ACCESS_KEY, // Web3Forms access key from env
        subject: `Hardware Access Request from ${userName}`,
        from_name: userName,
        email: userEmail,
        message: `
Hardware Access Request

Name: ${userName}
Email: ${userEmail}
User ID: ${userId}
Requested Hardware: ${hardwareRequestForm.hardwareTypes.join(', ')}

Use Case:
${hardwareRequestForm.useCase}

Estimated Usage:
${hardwareRequestForm.estimatedUsage || 'Not specified'}

Additional Information:
${hardwareRequestForm.additionalInfo || 'None'}

Submitted on ${new Date().toLocaleString()}
        `
      }

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to send request')
      }
      
      // Success! Reset form and close modal
      setHardwareRequestForm({
        hardwareTypes: [],
        useCase: '',
        estimatedUsage: '',
        additionalInfo: ''
      })
      setShowHardwareRequestModal(false)
      
      // Show success notification
      setNotification({
        type: 'success',
        message: 'Hardware access request submitted successfully! We\'ll get back to you soon.'
      })
      
      // Auto-hide notification after 5 seconds
      setTimeout(() => setNotification(null), 5000)
      
      // Track the request
      analytics.track('hardware_access_request_submitted', {
        hardware_types: hardwareRequestForm.hardwareTypes,
        user_id: userId
      })
    } catch (error) {
      console.error('Error submitting hardware request:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to submit request. Please try again.'
      })
      
      // Auto-hide error notification after 5 seconds
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setSubmittingRequest(false)
    }
  }

  const toggleHardwareType = (type: string) => {
    setHardwareRequestForm(prev => ({
      ...prev,
      hardwareTypes: prev.hardwareTypes.includes(type)
        ? prev.hardwareTypes.filter(t => t !== type)
        : [...prev.hardwareTypes, type]
    }))
  }

  return (
    <div className="space-y-6 px-6">
      {/* Notification Banner */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border-l-4 ${
          notification.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900 border-green-400 text-green-800 dark:text-green-400' 
            : 'bg-red-50 dark:bg-red-900 border-red-400 text-red-800 dark:text-red-400'
        } max-w-md`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <Check className="h-5 w-5 text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="ml-auto pl-3"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Billing & Balance</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-secondary">Manage your account balance and billing information.</p>
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

      {/* Credit Balance */}
      <div>
        <div className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border p-6">
          <div className="space-y-6">
            {/* Credit Progress Section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary">Available Balance</span>
                {loading ? (
                  <div className="w-32 h-4 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <span className="text-sm font-semibold text-gray-900 dark:text-dark-text">
                    {formatCurrency(credits?.available_credits || 0)} / {formatCurrency((credits?.monthly_free_credits || 0) + (credits?.purchased_credits || 0))}
                  </span>
                )}
              </div>
              
              <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2 flex overflow-hidden">
                {loading ? (
                  <div className="w-1/3 bg-gray-100 dark:bg-gray-600 h-2 rounded-full animate-pulse"></div>
                ) : credits && (
                  <>
                    <div 
                      className="bg-blue-500 h-2 transition-all duration-300 first:rounded-l-full"
                      style={{ 
                        width: `${Math.max(0, (Math.max(0, credits.available_credits - (credits.monthly_free_credits || 0)) / ((credits.monthly_free_credits || 0) + (credits.purchased_credits || 0))) * 100)}%`
                      }}
                    ></div>
                    <div 
                      className="bg-green-500 h-2 transition-all duration-300 last:rounded-r-full"
                      style={{ 
                        width: `${Math.max(0, (Math.min(credits.monthly_free_credits || 0, credits.available_credits) / ((credits.monthly_free_credits || 0) + (credits.purchased_credits || 0))) * 100)}%`
                      }}
                    ></div>
                  </>
                )}
              </div>
            </div>

            {/* Credit Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loading ? (
                <>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                    <div>
                      <div className="w-32 h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mb-1"></div>
                      <div className="w-16 h-3 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                    <div>
                      <div className="w-28 h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mb-1"></div>
                      <div className="w-16 h-3 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-text">Monthly Free Balance</p>
                      <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{formatCurrency(credits?.monthly_free_credits || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-text">Purchased Balance</p>
                      <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{formatCurrency(credits?.purchased_credits || 0)}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <p className="text-xs text-gray-500 dark:text-dark-text-secondary">
              Monthly free balance is used first before purchased balance
            </p>
          </div>
        </div>
      </div>
      
      {/* Available Hardware Profiles */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Available Machines</h2>
          <p className="text-sm text-gray-600 dark:text-dark-text-secondary">Hardware profiles you have access to run</p>
        </div>
        <div className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border p-6">
          {hardwareLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                    <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : availableHardware.length === 0 ? (
            <div className="text-center py-8">
              <Server className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
                No hardware profiles available. Contact support for access.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableHardware.map((profile) => (
                  <div 
                    key={profile}
                    className="flex items-center space-x-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800/50 rounded-lg"
                  >
                    <div className="flex-shrink-0 p-2 bg-white dark:bg-dark-card rounded-lg shadow-sm">
                      <div className="text-blue-600 dark:text-blue-400">
                        {getHardwareIcon(profile)}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-dark-text">
                          {getHardwareDisplayName(profile)}
                        </p>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                      <div className="flex items-center space-x-2">
                        <p className="text-xs text-gray-500 dark:text-dark-text-secondary">Available</p>
                        {hardwarePricing[profile] && (
                          <>
                            <span className="text-xs text-gray-400">•</span>
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                              {hardwarePricing[profile]}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                    Need access to more advanced resources (B200, H200, H100, A100)?
                  </p>
                  <button
                    onClick={() => setShowHardwareRequestModal(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    <span>Request Access</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Purchase Credits & Invoices Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Purchase Credits */}
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Add Funds</h2>
            <p className="text-sm text-gray-600 dark:text-dark-text-secondary">Add money to your account balance</p>
          </div>
          <div className="space-y-3">
            {creditPackages.map((pkg) => (
              <div 
                key={pkg.credits}
                className="relative p-4 border border-gray-200 dark:border-dark-border rounded-xl bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-dark-text">
                      {formatCurrency(pkg.price / 100)}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handlePurchaseCredits(pkg.credits)}
                    className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
            <p className="text-xs text-gray-600 dark:text-dark-text-secondary">
              Secure payment powered by Stripe • Funds never expire • Instant activation
            </p>
          </div>
        </div>

        {/* Invoices & Receipts */}
        <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Invoices & Receipts</h2>
              <p className="text-sm text-gray-600 dark:text-dark-text-secondary">Download or view your billing documents</p>
            </div>
            
            <div className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-dark-border">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text">Recent Invoices</h3>
                  <p className="text-xs text-gray-500 dark:text-dark-text-secondary">Your billing history</p>
                </div>
                <button
                  onClick={fetchInvoices}
                  disabled={invoicesLoading}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
                  title="Refresh invoices"
                >
                  <RotateCcw className={`h-4 w-4 ${invoicesLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="overflow-x-auto">
                {invoicesLoading ? (
                  <div className="p-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-dark-border last:border-b-0">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                          <div>
                            <div className="w-20 h-3 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mb-1"></div>
                            <div className="w-16 h-3 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                          </div>
                        </div>
                        <div className="w-12 h-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="text-gray-400 dark:text-gray-500 mb-2">
                      <ExternalLink className="h-8 w-8 mx-auto" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-1">No receipts yet</h3>
                    <p className="text-xs text-gray-500 dark:text-dark-text-secondary">Your receipts will appear here after making purchases</p>
                  </div>
                ) : (
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-dark-border">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Invoice</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr 
                          key={invoice.id}
                          className="border-b border-gray-50 dark:border-dark-border last:border-b-0 hover:bg-gray-25 dark:hover:bg-dark-accent/20 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-dark-text">#{invoice.number || 'Draft'}</div>
                            <div className="text-xs text-gray-500 dark:text-dark-text-secondary truncate max-w-xs">{invoice.description || 'Credit purchase'}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-dark-text-secondary">
                            {formatDate(invoice.created)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-text">
                            {formatCurrency(invoice.amount_paid / 100)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>View</span>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* Hardware Request Modal */}
      {showHardwareRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-dark-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text">Request Hardware Access</h2>
                <button
                  onClick={() => setShowHardwareRequestModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Hardware Types Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-3">
                  Select Hardware Types *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {['B200', 'H200', 'H100', 'A100', 'A10', 'Other (Please specify)'].map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleHardwareType(type)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        hardwareRequestForm.hardwareTypes.includes(type)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-dark-text'
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <span className="font-medium">{type}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Use Case */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                  Use Case *
                </label>
                <textarea
                  value={hardwareRequestForm.useCase}
                  onChange={(e) => setHardwareRequestForm(prev => ({ ...prev, useCase: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-bg dark:text-dark-text"
                  rows={4}
                  placeholder="Describe what you'll be using the hardware for..."
                />
              </div>

              {/* Estimated Usage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                  Estimated Usage (optional)
                </label>
                <input
                  type="text"
                  value={hardwareRequestForm.estimatedUsage}
                  onChange={(e) => setHardwareRequestForm(prev => ({ ...prev, estimatedUsage: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-bg dark:text-dark-text"
                  placeholder="e.g., 100 hours/month, daily training runs, etc."
                />
              </div>

              {/* Additional Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                  Additional Information (optional)
                </label>
                <textarea
                  value={hardwareRequestForm.additionalInfo}
                  onChange={(e) => setHardwareRequestForm(prev => ({ ...prev, additionalInfo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-bg dark:text-dark-text"
                  rows={3}
                  placeholder="Any other details you'd like to share..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-dark-border">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowHardwareRequestModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleHardwareRequestSubmit}
                  disabled={submittingRequest || !hardwareRequestForm.useCase.trim() || hardwareRequestForm.hardwareTypes.length === 0}
                  className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  {submittingRequest ? (
                    <>
                      <RotateCcw className="h-4 w-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                Your request will be sent directly to our support team
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BillingPage