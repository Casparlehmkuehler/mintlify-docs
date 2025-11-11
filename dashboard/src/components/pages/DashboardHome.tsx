import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play, CreditCard, Key, Activity, Loader, BarChart3, DollarSign, ArrowRight, Server, Cpu, Zap, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import OnboardingGuide from '../OnboardingGuide'
import AnalyticsChart, { MetricType, TimePeriod } from '../../utils/AnalyticsChart'
import { dataCache, CacheKeys } from '../../services/DataCache'
import { usePreloader } from '../../hooks/useCachedData'
import { Skeleton, DashboardCardSkeleton } from '../SimpleSkeleton'
import { buildApiUrl } from '../../lib/api'

interface DashboardData {
  credits: {
    available_credits: number
    used_credits: number
    total_credits_used: number
    remaining_credits: number
    monthly_free_credits: number
    purchased_credits: number
  } | null
  executionStats: {
    totalExecutions: number
    activeExecutions: number
    successRate: number
  }
  apiKeysCount: number
  availableHardware: string[]
  recentExecutions: Array<{
    execution_id: string
    created_at: string
    status: string
    file_name?: string
    execution_type?: string
    billed?: number
  }>
  analyticsData: Array<{
    date: string
    runs: number
    cost: number
    executions: Array<{
      id: string
      file_name?: string
      status: string
      cost: number
    }>
  }>
}


const DashboardHome: React.FC = () => {
  const [data, setData] = useState<DashboardData>({
    credits: null,
    executionStats: { totalExecutions: 0, activeExecutions: 0, successRate: 0 },
    apiKeysCount: 0,
    availableHardware: [],
    recentExecutions: [],
    analyticsData: []
  })
  const [loading, setLoading] = useState(true)
  const [partialLoading, setPartialLoading] = useState({
    credits: true,
    executions: true,
    apiKeys: true,
    analytics: true,
    hardware: true
  })
  const [error, setError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [showVersionBanner, setShowVersionBanner] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('runs')
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('day')
  usePreloader()

  useEffect(() => {
    // Fetch dashboard data on mount
    fetchDashboardData()
    // Check if version banner has been dismissed
    const bannerDismissed = localStorage.getItem('versionBannerDismissed_v0.2.32')
    if (bannerDismissed) {
      setShowVersionBanner(false)
    }
  }, [])

  const generateAnalyticsData = (executions: any[]) => {
    const now = new Date()
    const analyticsMap = new Map<string, { 
      runs: number; 
      cost: number; 
      executions: Array<{
        id: string;
        file_name?: string;
        status: string;
        cost: number;
      }> 
    }>()
    
    // Initialize data for the last 14 days (reduced from 30 for faster processing)
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      analyticsMap.set(dateKey, { runs: 0, cost: 0, executions: [] })
    }
    
    // Aggregate execution data from all fetched executions
    executions.forEach((exec: any) => {
      const execDate = new Date(exec.created_at).toISOString().split('T')[0]
      if (analyticsMap.has(execDate)) {
        const data = analyticsMap.get(execDate)!
        data.runs += 1
        data.cost += exec.billed || 0
        data.executions.push({
          id: exec.execution_id,
          file_name: exec.file_name,
          status: exec.status,
          cost: exec.billed || 0
        })
      }
    })
    
    // Convert to array format
    return Array.from(analyticsMap.entries()).map(([date, data]) => ({
      date,
      runs: data.runs,
      cost: data.cost,
      executions: data.executions
    }))
  }

  const fetchDashboardData = async (forceRefresh: boolean = false) => {
    try {
      if (!forceRefresh) {
        setLoading(true)
      }
      setError(null)
      
      const cacheKey = CacheKeys.dashboardData()
      
      // Try cache first (if not forcing refresh)
      if (!forceRefresh) {
        const cached = dataCache.get(cacheKey)
        if (cached && typeof cached === 'object' && 'credits' in cached) {
          const { credits, executions, apiKeys, hardware } = cached as any
          
          // Calculate stats from cached data immediately
          const activeExecutions = executions.filter((exec: any) => 
            ['running', 'pending', 'starting'].includes(exec.status.toLowerCase())
          ).length
          
          const completedExecutions = executions.filter((exec: any) => 
            ['completed', 'failed'].includes(exec.status.toLowerCase())
          )
          const successRate = completedExecutions.length > 0 
            ? (completedExecutions.filter((exec: any) => exec.status.toLowerCase() === 'completed').length / completedExecutions.length) * 100
            : 0

          setData({
            credits,
            executionStats: {
              totalExecutions: executions.length,
              activeExecutions,
              successRate
            },
            apiKeysCount: apiKeys?.length || 0,
            availableHardware: hardware || [],
            recentExecutions: executions.slice(0, 5),
            analyticsData: generateAnalyticsData(executions)
          })
          
          setPartialLoading({
            credits: false,
            executions: false,
            apiKeys: false,
            analytics: false,
            hardware: false
          })
          
          // Check localStorage for onboarding preference
          const hideOnboarding = localStorage.getItem('hideOnboarding')
          setShowOnboarding(!hideOnboarding)
          
          setLoading(false)
          return
        }
      }
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Please log in to view dashboard data')
        return
      }

      // Check localStorage for onboarding preference
      const hideOnboarding = localStorage.getItem('hideOnboarding')
      setShowOnboarding(!hideOnboarding)

      // Start all API calls in parallel immediately - don't wait
      const creditsPromise = fetch(buildApiUrl("/api/v2/external/billing/credits"), {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      
      // Fetch more executions for accurate analytics
      const executionHistoryPromise = fetch(buildApiUrl("/api/v2/external/billing/history?limit=1000"), {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      
      const apiKeysPromise = fetch(buildApiUrl("/api/v2/external/auth/api-keys/"), {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      const hardwarePromise = fetch(buildApiUrl("/api/v2/external/user/quotas/available-hardware"), {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      // Process each response as it arrives
      creditsPromise.then(async response => {
        if (response.ok) {
          const credits = await response.json()
          console.log('Credits response:', credits) // Debug log
          setData(prev => ({ ...prev, credits }))
        }
        setPartialLoading(prev => ({ ...prev, credits: false }))
      }).catch(err => {
        console.warn('Failed to load credits:', err)
        setPartialLoading(prev => ({ ...prev, credits: false }))
      })

      apiKeysPromise.then(async response => {
        if (response.ok) {
          const apiKeys = await response.json()
          console.log('API Keys response:', apiKeys) // Debug log
          setData(prev => ({ ...prev, apiKeysCount: Array.isArray(apiKeys) ? apiKeys.length : 0 }))
        }
        setPartialLoading(prev => ({ ...prev, apiKeys: false }))
      }).catch(err => {
        console.warn('Failed to load API keys:', err)
        setPartialLoading(prev => ({ ...prev, apiKeys: false }))
      })

      hardwarePromise.then(async response => {
        if (response.ok) {
          const hardwareData = await response.json()
          console.log('Hardware response:', hardwareData) // Debug log
          setData(prev => ({ ...prev, availableHardware: hardwareData.available_hardware_profiles || [] }))
        }
        setPartialLoading(prev => ({ ...prev, hardware: false }))
      }).catch(err => {
        console.warn('Failed to load hardware:', err)
        setPartialLoading(prev => ({ ...prev, hardware: false }))
      })

      // Wait only for execution history (most important for dashboard)
      const executionHistoryResponse = await executionHistoryPromise
      if (!executionHistoryResponse.ok) {
        throw new Error('Failed to fetch execution history')
      }

      const executionHistory = await executionHistoryResponse.json()
      const executions = executionHistory.executions || []
      
      // Calculate stats from the full sample for accuracy
      const totalExecutions = executionHistory.total_executions || executions.length
      const sampleSize = executions.length
      
      // Count statuses in the sample
      const activeCount = executions.filter((exec: any) => 
        ['running', 'pending', 'starting'].includes(exec.status.toLowerCase())
      ).length
      
      const completedCount = executions.filter((exec: any) => 
        exec.status.toLowerCase() === 'completed' || exec.status.toLowerCase() === 'success'
      ).length
      
      const failedCount = executions.filter((exec: any) => 
        exec.status.toLowerCase() === 'failed' || exec.status.toLowerCase() === 'error'
      ).length
      
      // Extrapolate to total if we have a sample
      let activeExecutions = activeCount
      let successRate = 0
      
      if (sampleSize > 0 && totalExecutions > sampleSize) {
        // We have a sample, extrapolate
        const activeRatio = activeCount / sampleSize
        activeExecutions = Math.round(totalExecutions * activeRatio)
        
        const totalCompleted = completedCount + failedCount
        if (totalCompleted > 0) {
          successRate = (completedCount / totalCompleted) * 100
        }
      } else if (sampleSize > 0) {
        // We have all data
        const totalCompleted = completedCount + failedCount
        if (totalCompleted > 0) {
          successRate = (completedCount / totalCompleted) * 100
        }
      }

      // Set execution data immediately
      setData(prev => ({
        ...prev,
        executionStats: {
          totalExecutions,
          activeExecutions,
          successRate
        },
        recentExecutions: executions.slice(0, 5) // Still show only 5 most recent
      }))
      
      setPartialLoading(prev => ({ ...prev, executions: false }))
      setLoading(false) // Show UI immediately!
      
      // Generate analytics data asynchronously to not block UI
      requestAnimationFrame(() => {
        setTimeout(() => {
          const analyticsData = generateAnalyticsData(executions)
          setData(prev => ({ ...prev, analyticsData }))
          setPartialLoading(prev => ({ ...prev, analytics: false }))
        }, 0)
      })
      
      // Cache the data we have (wait for all promises to avoid partial cache)
      Promise.all([
        creditsPromise.then(r => r.json()).catch(() => null),
        apiKeysPromise.then(r => r.json()).catch(() => []),
        hardwarePromise.then(r => r.json()).catch(() => ({ available_hardware_profiles: [] }))
      ]).then(([creditsData, apiKeysData, hardwareData]) => {
        dataCache.set(cacheKey, {
          credits: creditsData,
          executions: executions,
          apiKeys: apiKeysData || [],
          hardware: hardwareData?.available_hardware_profiles || [],
          fetchedAt: Date.now()
        }, 2 * 60 * 1000) // 2 minute TTL for faster loading
      })
      
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err)
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
      case 'running':
      case 'pending':
      case 'starting':
        return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-dark-card'
      case 'failed':
      case 'error':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
      default:
        return 'text-gray-600 bg-gray-100 dark:text-dark-text-secondary dark:bg-dark-card'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'pending':
      case 'starting':
        return <Loader className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" style={{ animationDuration: '4s' }}/>
      case 'completed':
      case 'success':
        return <Play className="h-4 w-4 text-green-600 dark:text-green-400" />
      case 'failed':
      case 'error':
        return <Play className="h-4 w-4 text-red-600 dark:text-red-400" />
      default:
        return <Play className="h-4 w-4 text-gray-600 dark:text-dark-text-secondary" />
    }
  }

  const dismissOnboarding = () => {
    localStorage.setItem('hideOnboarding', 'true')
    setShowOnboarding(false)
  }

  const dismissVersionBanner = () => {
    localStorage.setItem('versionBannerDismissed_v0.2.32', 'true')
    setShowVersionBanner(false)
  }

  const getHardwareIcon = (profile: string) => {
    const normalizedProfile = profile.toLowerCase()
    if (normalizedProfile.includes('cpu')) {
      return <Cpu className="h-4 w-4" />
    } else if (normalizedProfile.includes('gpu') || normalizedProfile.includes('a10') || normalizedProfile.includes('h100')) {
      return <Zap className="h-4 w-4" />
    } else {
      return <Server className="h-4 w-4" />
    }
  }

  const getHardwareDisplayName = (profile: string) => {
    const profileMap: { [key: string]: string } = {
      'cpu': 'CPU',
      'gpu': 'NVIDIA T4',
      'gpu_a10': 'GPU A10',
      'gpu_h100': 'GPU H100',
      'gpu_4xa10': 'GPU 4xA10',
      'gpu_8xh100': 'GPU 8xH100'
    }
    return profileMap[profile.toLowerCase()] || profile.toUpperCase()
  }


  const creditPercentage = data.credits 
    ? (() => {
        const totalCredits = (data.credits.monthly_free_credits || 0) + (data.credits.purchased_credits || 0)
        return totalCredits > 0 ? (data.credits.available_credits / totalCredits) * 100 : 0
      })()
    : 0

  return (
    <div className="space-y-6 px-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-secondary">Welcome back! Here's your cloud execution overview.</p>
      </div>

      {/* Version Banner */}
      {showVersionBanner && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start flex-1">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400 dark:text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Hey, to ensure smooth running, please make sure you're on extension version <strong>0.2.32</strong>
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Btw - we've made some really cool changes - can you spot them? Ping us if any issues
                </p>
              </div>
            </div>
            <button
              onClick={dismissVersionBanner}
              className="flex-shrink-0 ml-4 text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 dark:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              <button
                onClick={() => fetchDashboardData(true)}
                className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:text-red-500 dark:hover:text-red-300"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Guide - Only show if user hasn't dismissed it and we're not loading */}
      {!loading && showOnboarding && data.executionStats.totalExecutions === 0 && (
        <div className="relative">
          <button
            onClick={dismissOnboarding}
            className="absolute top-4 right-4 text-gray-400 dark:text-dark-text-secondary hover:text-gray-600 dark:hover:text-dark-text z-10"
          >
            ✕
          </button>
          <OnboardingGuide hasApiKey={data.apiKeysCount > 0} />
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Runs Card */}
        {partialLoading.executions ? (
          <DashboardCardSkeleton />
        ) : (
          <Link to="/runs" className="block bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary">Active Runs</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-dark-text mt-1">
                  {data.executionStats.activeExecutions}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-dark-card rounded-lg">
                <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            {data.executionStats.activeExecutions > 0 && (
              <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center">
                View runs <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            )}
          </Link>
        )}

        {/* Credits Card */}
        {partialLoading.credits ? (
          <DashboardCardSkeleton />
        ) : (
          <Link to="/billing" className="block bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary">Credits Available</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-dark-text mt-1">
                  {data.credits ? formatCurrency(data.credits.available_credits || 0) : '—'}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-200 dark:bg-dark-card rounded-full h-1.5">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, creditPercentage)}%` }}
                />
              </div>
            </div>
          </Link>
        )}

        {/* Available Machines Card */}
        {partialLoading.hardware ? (
          <DashboardCardSkeleton />
        ) : (
          <Link to="/billing" className="block bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary">Available Machines</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-dark-text mt-1">
                  {data.availableHardware.length}
                </p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Server className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {data.availableHardware.slice(0, 4).map((profile) => (
                <div 
                  key={profile}
                  className="flex items-center justify-center px-2 py-1 bg-gray-100 dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-full text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  {getHardwareDisplayName(profile)}
                </div>
              ))}
              {data.availableHardware.length > 4 && (
                <div className="flex items-center justify-center px-2 py-1 bg-gray-200 dark:bg-dark-accent border border-gray-300 dark:border-dark-border rounded-full text-xs font-medium text-gray-600 dark:text-gray-400">
                  +{data.availableHardware.length - 4}
                </div>
              )}
            </div>
          </Link>
        )}

        {/* API Keys Card */}
        {partialLoading.apiKeys ? (
          <DashboardCardSkeleton />
        ) : (
          <Link to="/api-keys" className="block bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary">API Keys</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-dark-text mt-1">
                  {data.apiKeysCount}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Key className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            {data.apiKeysCount === 0 ? (
              <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center">
                Create key <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            ) : (
              <div className="mt-3 text-xs text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text flex items-center">
                Manage keys <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            )}
          </Link>
        )}
      </div>

      {/* Recent Activity and Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Executions */}
        <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Recent Runs</h2>
              <Link to="/runs" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                View all
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {partialLoading.executions ? (
              // Skeleton loading state
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-100 dark:bg-dark-card rounded animate-pulse">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-dark-accent/20 rounded"></div>
                    </div>
                    <div>
                      <div className="w-32 h-4 bg-gray-200 dark:bg-dark-card rounded animate-pulse mb-2"></div>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-3 bg-gray-200 dark:bg-dark-card rounded animate-pulse"></div>
                        <div className="w-24 h-3 bg-gray-200 dark:bg-dark-card rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                  <div className="w-12 h-4 bg-gray-200 dark:bg-dark-card rounded animate-pulse"></div>
                </div>
              ))
            ) : data.recentExecutions.length > 0 ? (
              data.recentExecutions.map((execution) => (
                <Link
                  key={execution.execution_id}
                  to={`/runs?id=${execution.execution_id}`}
                  className="px-6 py-3 hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-100 dark:bg-dark-card rounded">
                      {getStatusIcon(execution.status)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                        {execution.file_name || `Run ${execution.execution_id.slice(0, 8)}`}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(execution.status)}`}>
                          {execution.status}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-dark-text-secondary">
                          {new Date(execution.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {execution.billed && (
                    <span className="text-sm text-gray-600 dark:text-dark-text-secondary">
                      {formatCurrency(execution.billed)}
                    </span>
                  )}
                </Link>
              ))
            ) : (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-dark-text-secondary">No executions yet</p>
                <p className="text-xs text-gray-400 dark:text-dark-text-secondary mt-1">Run your first code to see it here</p>
              </div>
            )}
          </div>
        </div>

        {/* Analytics Graph */}
        <div className="xl:col-span-2 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Analytics</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-secondary">
                {selectedMetric === "runs" ? "Number of runs executed" : "How much you spent"}
              </p>
              </div>
              <div className="flex items-center space-x-2">
                {/* Metric Toggle */}
                <div className="flex bg-gray-100 dark:bg-dark-card rounded-lg p-1">
                  <button
                    onClick={() => setSelectedMetric('runs')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      selectedMetric === 'runs'
                        ? 'bg-white dark:bg-dark-accent/20 text-gray-900 dark:text-dark-text shadow-sm'
                        : 'text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <BarChart3 className="h-3 w-3 mr-1 inline" />
                    Runs
                  </button>
                  <button
                    onClick={() => setSelectedMetric('cost')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      selectedMetric === 'cost'
                        ? 'bg-white dark:bg-dark-accent/20 text-gray-900 dark:text-dark-text shadow-sm'
                        : 'text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <DollarSign className="h-3 w-3 mr-1 inline" />
                    Cost
                  </button>
                </div>
                {/* Period Toggle */}
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as TimePeriod)}
                  className="text-xs border border-gray-200 dark:border-dark-border rounded-md px-2 py-1.5 bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-6">
            {partialLoading.analytics ? (
              <div className="h-80 flex items-end justify-around px-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    width="2rem"
                    height={`${Math.random() * 60 + 20}%`}
                    className="rounded-t"
                  />
                ))}
              </div>
            ) : data.analyticsData.length > 0 ? (
              <div className="h-80">
                <AnalyticsChart 
                  data={data.analyticsData}
                  metric={selectedMetric}
                  period={selectedPeriod}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-80 text-gray-500 dark:text-dark-text-secondary">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-dark-text-secondary" />
                  <p className="text-sm dark:text-dark-text-secondary">No data available</p>
                  <p className="text-xs text-gray-400 dark:text-dark-text-secondary">Run some code to see analytics</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

export default DashboardHome