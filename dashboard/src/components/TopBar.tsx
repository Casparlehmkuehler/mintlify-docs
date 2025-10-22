import React, { useState, useEffect, useRef } from 'react'
import { Search, Settings, HelpCircle, LayoutGrid, Play, Folder, CreditCard, Key, User, Clock, Loader, Square, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import OnboardingModal from './OnboardingModal'
import PanicButton from './PanicButton'
import { buildApiUrl } from '../lib/api'

interface SearchResult {
  id: string
  title: string
  type: 'page' | 'execution' | 'file'
  path: string
  icon: any
  metadata?: {
    status?: string
    created_at?: string
    execution_type?: string
  }
}

interface CreditsBalance {
  available_credits: number
  used_credits: number
  total_credits_used: number
  remaining_credits: number
  monthly_free_credits: number
  purchased_credits: number
}

interface RunningJob {
  execution_id: string
  file_name?: string
  created_at: string
  execution_type?: string
  status: string
}

const TopBar: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const [credits, setCredits] = useState<CreditsBalance | null>(null)
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [runningJobs, setRunningJobs] = useState<RunningJob[]>([])
  const [showJobsModal, setShowJobsModal] = useState(false)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false)
  const [apiKeysCount, setApiKeysCount] = useState(0)
  const [abortingJobs, setAbortingJobs] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  // Static pages that are always searchable
  const staticPages: SearchResult[] = [
    { id: 'page-1', title: 'Dashboard', type: 'page', path: '/', icon: LayoutGrid },
    { id: 'page-2', title: 'Runs', type: 'page', path: '/runs', icon: Play },
    { id: 'page-3', title: 'Storage', type: 'page', path: '/storage', icon: Folder },
    { id: 'page-4', title: 'Billing', type: 'page', path: '/billing', icon: CreditCard },
    { id: 'page-5', title: 'API Keys', type: 'page', path: '/api-keys', icon: Key },
    { id: 'page-6', title: 'Account', type: 'page', path: '/account', icon: User },
    { id: 'page-7', title: 'Settings', type: 'page', path: '/settings', icon: Settings },
  ]

  // Search function
  const performSearch = async (query: string) => {
    if (!query.trim() || !user) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    const results: SearchResult[] = []

    // Search static pages
    const pageResults = staticPages.filter(page =>
      page.title.toLowerCase().includes(query.toLowerCase())
    )
    results.push(...pageResults)

    try {
      // Search executions/runs
      const { data: executions, error } = await supabase
        .from('execution')
        .select('execution_id, created_at, status, execution_type, file_name')
        .eq('user_id', user.id)
        .or(`execution_id.ilike.%${query}%,file_name.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && executions) {
        const executionResults: SearchResult[] = executions.map((exec) => ({
          id: exec.execution_id,
          title: exec.file_name || `Run ${exec.execution_id.slice(0, 8)}...`,
          type: 'execution' as const,
          path: `/runs?id=${exec.execution_id}`,
          icon: Play,
          metadata: {
            status: exec.status,
            created_at: exec.created_at,
            execution_type: exec.execution_type
          }
        }))
        results.push(...executionResults)
      }
    } catch (error) {
      console.error('Search error:', error)
    }

    setSearchResults(results.slice(0, 8)) // Limit to 8 results
    setIsSearching(false)
  }

  // Fetch credits and API keys
  const fetchCredits = async () => {
    if (!user) return
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Fetch credits and API keys in parallel
      const [creditsResponse, apiKeysResponse] = await Promise.all([
        fetch(buildApiUrl('/api/v2/external/billing/credits'), {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
        fetch(buildApiUrl('/api/v2/external/auth/api-keys/'), {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
      ])

      if (creditsResponse.ok) {
        const data = await creditsResponse.json()
        setCredits(data)
      }

      if (apiKeysResponse.ok) {
        const apiKeys = await apiKeysResponse.json()
        setApiKeysCount(apiKeys?.length || 0)
      }
    } catch (error) {
      console.error('Error fetching credits and API keys:', error)
    }
  }

  // Fetch running jobs
  const fetchRunningJobs = async () => {
    if (!user) return
    
    try {
      const { data: executions, error } = await supabase
        .from('execution')
        .select('execution_id, created_at, execution_type, file_name, status')
        .eq('user_id', user.id)
        .in('status', ['pending', 'running', 'waiting for docker container'])
        .order('created_at', { ascending: false })

      if (!error && executions) {
        setRunningJobs(executions)
      }
    } catch (error) {
      console.error('Error fetching running jobs:', error)
    }
  }

  // Abort a running job
  const abortJob = async (jobId: string) => {
    try {
      setAbortingJobs(prev => new Set([...prev, jobId]))
      
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw new Error('Please log in to abort jobs')
      }

      const response = await fetch(buildApiUrl(`/api/v2/external/workloads/abort/${jobId}`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to abort job: ${errorText}`)
      }

      const result = await response.json()
      
      // Update the job status in local state
      setRunningJobs(prevJobs => prevJobs.map(job => 
        job.execution_id === jobId 
          ? { ...job, status: result.status || 'cancelling' }
          : job
      ))
      
      // Refresh the running jobs list after a short delay
      setTimeout(() => {
        fetchRunningJobs()
      }, 1000)

    } catch (err: any) {
      console.error('Error aborting job:', err)
    } finally {
      setAbortingJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }

  // Only fetch data on mount, no automatic polling
  useEffect(() => {
    if (user) {
      fetchCredits()
      fetchRunningJobs()
    }
  }, []) // Remove user dependency to prevent refetch on navigation

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, user])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!searchResults.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        handleSelectResult(searchResults[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false)
      searchRef.current?.blur()
    }
  }

  const handleSelectResult = (item: SearchResult) => {
    navigate(item.path)
    setSearchQuery('')
    setIsSearchFocused(false)
    searchRef.current?.blur()
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'page': return 'bg-blue-100 text-blue-800 dark:bg-dark-card dark:text-blue-300'
      case 'execution': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'file': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-dark-card dark:text-dark-text-secondary'
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 dark:text-green-400'
      case 'running': return 'text-blue-600 dark:text-blue-400'
      case 'failed': return 'text-red-600 dark:text-red-400'
      case 'pending': return 'text-yellow-600 dark:text-yellow-400'
      default: return 'text-gray-600 dark:text-dark-text-secondary'
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) // Value is already in dollars/euros
  }
  
  return (
    <div className="bg-white dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Search */}
        <div className="flex-1 max-w-md relative">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-dark-text-secondary" />
            </div>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search runs, pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              onKeyDown={handleKeyDown}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg leading-5 bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 dark:focus:placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {isSearching && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            )}
          </div>
          
          {/* Search Results Dropdown */}
          {isSearchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
              {searchResults.map((item, index) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectResult(item)}
                    className={`w-full flex items-center px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors ${
                      index === selectedIndex ? 'bg-blue-50 dark:bg-dark-card' : ''
                    } ${index === 0 ? 'rounded-t-lg' : ''} ${index === searchResults.length - 1 ? 'rounded-b-lg' : ''}`}
                  >
                    <Icon className="h-4 w-4 text-gray-400 dark:text-dark-text-secondarymr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">{item.title}</p>
                      {item.metadata && (
                        <div className="flex items-center gap-2 mt-1">
                          {item.metadata.status && (
                            <span className={`text-xs ${getStatusColor(item.metadata.status)}`}>
                              {item.metadata.status}
                            </span>
                          )}
                          {item.metadata.created_at && (
                            <span className="text-xs text-gray-500 dark:text-dark-text-secondary flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(item.metadata.created_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getTypeColor(item.type)}`}>
                      {item.type === 'execution' ? 'run' : item.type}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* No results message */}
          {isSearchFocused && searchQuery && !isSearching && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-50 p-4">
              <p className="text-sm text-gray-500 dark:text-dark-text-secondary text-center">No results found for "{searchQuery}"</p>
            </div>
          )}
        </div>

        {/* Right side - Action icons */}
        <div className="flex items-center space-x-3">
          {/* Running Jobs Icon - only show if there are running jobs */}
          {runningJobs.length > 0 && (
            <div 
              className="relative"
              onMouseEnter={() => setShowJobsModal(true)}
              onMouseLeave={() => setShowJobsModal(false)}
            >
              <button className="p-2 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-all duration-200">
                <Loader className="h-5 w-5 animate-spin" style={{ animationDuration: '4s' }} />
              </button>
              
              {/* Running Jobs Modal */}
              {showJobsModal && (
                <>
                  {/* Invisible bridge to maintain hover */}
                  <div className="absolute top-full right-0 w-72 h-2" />
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg shadow-xl z-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-text mb-3">
                      Running Jobs ({runningJobs.length})
                    </h3>
                    
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {runningJobs.map((job) => (
                        <div 
                          key={job.execution_id}
                          className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-dark-accent/20 rounded transition-colors">
                        
                          <Play className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-3 flex-shrink-0" />
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              navigate(`/runs?id=${job.execution_id}`)
                              setShowJobsModal(false)
                            }}
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
                              {job.file_name || `Run ${job.execution_id.slice(0, 8)}...`}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs ${getStatusColor(job.status)}`}>{job.status}</span>
                              <span className="text-xs text-gray-500 dark:text-dark-text-secondary flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {new Date(job.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              abortJob(job.execution_id)
                            }}
                            disabled={abortingJobs.has(job.execution_id)}
                            className="ml-2 p-1 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                            title="Abort job"
                          >
                            {abortingJobs.has(job.execution_id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {/* Emergency Button */}
          <PanicButton userEmail={user?.email} />
          
          {/* Help Button - Opens onboarding modal */}
          <button
            onClick={() => setShowOnboardingModal(true)}
            className="p-2 text-gray-400 dark:text-dark-text-secondaryhover:text-gray-600 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-accent/20 rounded-lg transition-all duration-200"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          
          {/* Settings Button */}
          <button 
            onClick={() => navigate('/settings')}
            className="p-2 text-gray-400 dark:text-dark-text-secondaryhover:text-gray-600 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-accent/20 rounded-lg transition-all duration-200"
          >
            <Settings className="h-5 w-5" />
          </button>
          
          {/* Credits Balance Button */}
          <div 
            className="relative"
            onMouseEnter={() => setShowCreditsModal(true)}
            onMouseLeave={() => setShowCreditsModal(false)}
          >
            <button 
              onClick={() => navigate('/billing')}
              className="px-3 py-1.5 bg-blue-600 dark:bg-dark-card hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg transition-all duration-200 flex items-center space-x-2"
            >
              <span className="text-sm font-medium">Current Balance:</span>
              <span className="text-sm font-medium">
                {credits ? formatCurrency(credits.available_credits) : '...'}
              </span>
            </button>
            
            {/* Credits Hover Modal */}
            {showCreditsModal && credits && (
              <>
                {/* Invisible bridge to maintain hover */}
                <div className="absolute top-full right-0 w-80 h-2" />
                <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg shadow-xl z-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-text mb-3">Credit Balance</h3>
                
                {/* Credit Bar */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-dark-text-secondary">Available</span>
                      <span className="font-medium text-gray-900 dark:text-dark-text">
                        {formatCurrency(credits.available_credits)} / {formatCurrency((credits.monthly_free_credits || 0) + (credits.purchased_credits || 0))}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-dark-bg rounded-full h-2 flex overflow-hidden">
                      {/* Blue section for purchased credits */}
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 transition-all duration-300"
                        style={{ 
                          width: `${Math.max(0, (Math.max(0, credits.available_credits - (credits.monthly_free_credits || 0)) / ((credits.monthly_free_credits || 0) + (credits.purchased_credits || 0))) * 100)}%`
                        }}
                      />
                      {/* Green section for monthly free credits */}
                      <div 
                        className="bg-gradient-to-r from-green-500 to-green-600 h-2 transition-all duration-300"
                        style={{ 
                          width: `${Math.max(0, (Math.min(credits.monthly_free_credits || 0, credits.available_credits) / ((credits.monthly_free_credits || 0) + (credits.purchased_credits || 0))) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Credit Breakdown */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-dark-border">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-dark-text-secondary">Monthly Free</p>
                        <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{formatCurrency(credits.monthly_free_credits || 0)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-dark-text-secondary">Purchased</p>
                        <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{formatCurrency(credits.purchased_credits || 0)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100 dark:border-dark-border">
                    <p className="text-xs text-gray-500 dark:text-dark-text-secondary italic">Click to view billing details</p>
                  </div>
                </div>
              </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        hasApiKey={apiKeysCount > 0}
      />
    </div>
  )
}

export default TopBar