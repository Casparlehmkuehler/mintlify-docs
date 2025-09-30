import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, XCircle, Play, Pause, Filter, ChevronUp, ChevronDown, Loader2, Trash2, Square, Package, AlertTriangle, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { convertExecutionToRun, type Run } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import JobProgressTooltip from '../JobProgressTooltip'
import TimestampDetails from '../TimestampDetails'
import { dataCache, CacheKeys } from '../../services/DataCache'
import { dataPreloader } from '../../services/DataPreloader'
import { usePreloader } from '../../hooks/useCachedData'
import { buildApiUrl } from '../../lib/api'
import { analytics, ANALYTICS_EVENTS } from '../../services/analytics'

const getStatusIcon = (status: string) => {
  const lowerStatus = status.toLowerCase()
  switch (lowerStatus) {
    case 'running':
      return <Play className="h-4 w-4 text-blue-600" />
    case 'starting':
    case 'pending':
      return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
    case 'completed':
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'failed':
    case 'error':
      return <XCircle className="h-4 w-4 text-red-600" />
    case 'cancelled':
    case 'paused':
    case 'aborted':
      return <Pause className="h-4 w-4 text-yellow-600" />
    default:
      return <Pause className="h-4 w-4 text-gray-600" />
  }
}

const getStatusColor = (status: string) => {
  const lowerStatus = status.toLowerCase()
  switch (lowerStatus) {
    case 'running':
      return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700'
    case 'starting':
    case 'pending':
      return 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-700'
    case 'completed':
    case 'success':
      return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700'
    case 'failed':
    case 'error':
      return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700'
    case 'cancelled':
    case 'paused':
    case 'aborted':
      return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700'
    default:
      return 'bg-gray-100 dark:bg-dark-card text-gray-800 dark:text-dark-text border-gray-200 dark:border-dark-border'
  }
}

const RunsPage: React.FC = () => {
  const { user } = useAuth()
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [expandedInstallLogs, setExpandedInstallLogs] = useState(false)
  const [expandedDockerError, setExpandedDockerError] = useState(false)
  const [loadingRunDetails, setLoadingRunDetails] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [searchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25
  const [filters, setFilters] = useState({
    status: [] as string[],
    dateRange: '' as string
  })
  const [sortConfig, setSortConfig] = useState<{
    key: string | null
    direction: 'asc' | 'desc'
  }>({
    key: null,
    direction: 'asc'
  })
  const detailsPanelRef = useRef<HTMLDivElement>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [, setTotalRunsCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredRun] = useState<Run | null>(null)
  const [tooltipPosition] = useState({ x: 0, y: 0 })
  const [deletingRuns, setDeletingRuns] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [abortingRuns, setAbortingRuns] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'all' | 'python' | 'docker'>('all')
  const [showColumnEditor, setShowColumnEditor] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    run: true,
    status: true,
    duration: true,
    cost: true,
    started: true,
    configuration: true,
    actions: true
  })
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'completed' | 'running' | 'failed' | 'cancelled' | 'aborted'>('all')
  const { invalidateCache } = usePreloader()

  // Fetch runs from Supabase when user is available
  useEffect(() => {
    if (user) {
      // Trigger preloading for runs data
      dataPreloader.preloadRunsData()
      fetchRuns()
    }
  }, [user])

  const fetchRuns = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true)
      setError(null)
      
      const cacheKey = CacheKeys.runs(1) // Using page 1 for now
      
      // Try cache first (if not forcing refresh)
      if (!forceRefresh) {
        const cached = dataCache.get(cacheKey)
        if (cached && typeof cached === 'object' && 'executions' in cached) {
          const cachedData = cached as any
          const executions = cachedData.executions || []
          const totalExecutions = cachedData.total_executions || executions.length
          setTotalRunsCount(totalExecutions)
          
          const convertedRuns = executions.map((execution: any) => {
            return convertExecutionToRun({
              execution_id: execution.execution_id,
              created_at: execution.created_at,
              status: execution.status,
              execution_type: execution.execution_type,
              execution_owner: null,
              user_id: user?.id || '',
              hardware_profile: execution.hardware_profile,
              docker_image_ref: null,
              docker_run_cmd: null,
              docker_run_env: null,
              python_code: '',
              python_requirements: null,
              combined_output: '',
              stderr: '',
              stdout: '',
              file_name: execution.file_name,
              billed: execution.billed,
              amount_billed: execution.amount_billed
            })
          })
          setRuns(convertedRuns)
          setLoading(false)
          return
        }
      }
      
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        setError('Please log in to view execution history')
        return
      }

      const response = await fetch(buildApiUrl("/api/v2/external/billing/history?limit=1000"), {
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch execution history')
      }

      const data = await response.json()
      
      // Cache the response
      dataCache.set(cacheKey, data, 2 * 60 * 1000) // 2 minute TTL for runs data
      
      const executions = data.executions || []
      const totalExecutions = data.total_executions || executions.length
      setTotalRunsCount(totalExecutions)
      
      // Convert executions to the Run format expected by the frontend
      const convertedRuns = executions.map((execution: any) => {
        console.log('Raw execution from API:', execution) // Debug log
        const converted = convertExecutionToRun({
          execution_id: execution.execution_id,
          created_at: execution.created_at,
          status: execution.status,
          execution_type: execution.execution_type,
          execution_owner: null,
          user_id: user?.id || '',
          hardware_profile: execution.hardware_profile,
          docker_image_ref: null,
          docker_run_cmd: null,
          docker_run_env: null,
          python_code: '', // Not available in billing API for security
          python_requirements: null,
          combined_output: '', // Not available in billing API for security
          stderr: '',
          stdout: '',
          return_code: null,
          // New accurate timestamp fields
          execelet_start: execution.execelet_start,
          start_time: execution.start_time,
          end_time: execution.end_time,
          finish_time: execution.finish_time,
          // Legacy timestamp fields for backward compatibility
          job_start: execution.job_start,
          job_end: execution.job_end,
          billed: execution.billed,
          errors: null,
          warnings: null,
          file_name: execution.file_name,
          python_globals_in: null,
          python_globals_out: null,
          cancel: false,
          docker_registry_credentials: null,
          docker_registry_credential_type: null,
          user_callback_url: null,
          s3_mount: null,
          s3_credentials: null
        })
        console.log(`Converted execution ${execution.execution_id}: execution_type="${execution.execution_type}" -> executionType="${converted.executionType}"`) // Debug log
        return converted
      })
      
      setRuns(convertedRuns)
    } catch (err: any) {
      console.error('Error fetching runs:', err)
      setError(err.message || 'Failed to load runs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const deleteRun = async (runId: string) => {
    try {
      // Track workload deletion
      analytics.track(ANALYTICS_EVENTS.WORKLOAD_DELETED, {
        run_id: runId
      })
      
      setDeletingRuns(prev => new Set([...prev, runId]))
      
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw new Error('Please log in to delete runs')
      }

      const response = await fetch(buildApiUrl(`/api/v2/external/execution/${runId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`
        }
      })

      if (!response.ok) {
        analytics.track('workload_delete_failed', { run_id: runId })
        throw new Error('Failed to delete run')
      }

      // Invalidate cache and refresh runs
      invalidateCache('runs')
      
      // Remove run from local state
      setRuns(prevRuns => prevRuns.filter(run => run.id !== runId))
      setSelectedRows(prev => {
        const newSelected = new Set(prev)
        newSelected.delete(runId)
        return newSelected
      })
      
      // Close details panel if this run was selected
      if (selectedRun?.id === runId) {
        setSelectedRun(null)
      }
      
      // Refresh the runs list
      fetchRuns(true)

    } catch (err: any) {
      console.error('Error deleting run:', err)
      setError(err.message || 'Failed to delete run. Please try again.')
    } finally {
      setDeletingRuns(prev => {
        const newSet = new Set(prev)
        newSet.delete(runId)
        return newSet
      })
      setShowDeleteConfirm(null)
    }
  }

  const abortRun = async (runId: string) => {
    try {
      // Track workload abort
      analytics.track('workload_aborted', {
        run_id: runId
      })
      
      setAbortingRuns(prev => new Set([...prev, runId]))
      
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw new Error('Please log in to abort jobs')
      }

      const response = await fetch(buildApiUrl(`/api/v2/external/workloads/abort/${runId}`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        analytics.track('workload_abort_failed', { run_id: runId, error: errorText })
        throw new Error(`Failed to abort run: ${errorText}`)
      }

      const result = await response.json()
      
      // Update the run status in local state
      setRuns(prevRuns => prevRuns.map(run => 
        run.id === runId 
          ? { ...run, status: result.status || 'cancelling' }
          : run
      ))
      
      // Update selected run if it's the one being aborted
      if (selectedRun?.id === runId) {
        setSelectedRun(prev => prev ? { ...prev, status: result.status || 'cancelling' } : null)
      }
      
      // Refresh the runs list after a short delay to get updated status
      setTimeout(() => {
        fetchRuns()
      }, 1000)

    } catch (err: any) {
      console.error('Error aborting run:', err)
      setError(err.message || 'Failed to abort run. Please try again.')
    } finally {
      setAbortingRuns(prev => {
        const newSet = new Set(prev)
        newSet.delete(runId)
        return newSet
      })
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, runId: string) => {
    e.stopPropagation()
    setShowDeleteConfirm(runId)
  }

  const handleAbortClick = (e: React.MouseEvent, runId: string) => {
    e.stopPropagation()
    abortRun(runId)
  }

  const canAbortRun = (status: string) => {
    const lowerStatus = status.toLowerCase()
    return ['running', 'pending', 'starting', 'waiting for docker container'].includes(lowerStatus)
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(null)
  }

  const closeDetails = () => {
    setSelectedRun(null)
    setExpandedInstallLogs(false)
    setExpandedDockerError(false)
    setLoadingRunDetails(false)
    setLoadingProgress(0)
    setLoadingStatus('')
  }

  const fetchExecutionDetails = async (executionId: string) => {
    try {
      console.log('Fetching execution details for:', executionId)
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw new Error('Please log in to view execution details')
      }

      const response = await fetch(buildApiUrl(`/api/v2/external/execution/${executionId}`), {
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`
        }
      })

      console.log('Execution details response status:', response.status)

      if (!response.ok) {
        throw new Error('Failed to fetch execution details')
      }

      const executionDetails = await response.json()
      console.log('Execution details received:', executionDetails)
      return executionDetails
    } catch (err: any) {
      console.error('Error fetching execution details:', err)
      return null
    }
  }

  const selectRunWithDetails = async (run: Run) => {
    console.log('Selecting run:', run.id)
    
    // Track workload view
    analytics.track(ANALYTICS_EVENTS.WORKLOAD_VIEWED, {
      run_id: run.id,
      status: run.status,
      execution_type: run.executionType
    })
    
    // Start loading state and show basic run info in background
    setLoadingRunDetails(true)
    setLoadingProgress(0)
    setLoadingStatus('Initializing...')
    setSelectedRun(run) // Show basic info immediately
    
    try {
      // Get current session for API calls
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw new Error('Please log in to view execution details')
      }

      setLoadingProgress(20)
      setLoadingStatus('Fetching execution details...')

      // Start both API calls
      const detailsPromise = fetchExecutionDetails(run.id)
      const timingPromise = fetch(buildApiUrl(`/api/v2/external/execution/${run.id}/timing`), {
        headers: { 'Authorization': `Bearer ${currentSession.access_token}` }
      })

      setLoadingProgress(40)
      setLoadingStatus('Loading execution logs...')

      // Wait for details first
      const details = await detailsPromise
      
      setLoadingProgress(70)
      setLoadingStatus('Loading timing information...')

      // Then get timing
      const timingResponse = await timingPromise
      
      console.log('Details fetched:', details)
      
      setLoadingProgress(85)
      setLoadingStatus('Processing data...')
      
      let timing = null
      if (timingResponse.ok) {
        const timingData = await timingResponse.json()
        timing = timingData.timing
        console.log('Timing data fetched:', timing)
      } else {
        console.warn('Failed to fetch timing data:', timingResponse.status)
      }

      setLoadingProgress(95)
      setLoadingStatus('Finalizing...')
      
      if (details) {
        // Create the fully loaded run object
        const fullyLoadedRun = {
          ...run,
          combined_output: details.combined_output || run.combined_output,
          stdout: details.stdout || run.stdout,
          stderr: details.stderr || run.stderr,
          python_code: details.python_code || run.python_code,
          return_code: details.return_code !== undefined ? details.return_code : run.return_code,
          timing: timing || run.timing,
          install_log: details.install_log || run.install_log,
          install_return_code: details.install_return_code !== undefined ? details.install_return_code : run.install_return_code,
          errors_docker: details.errors_docker || run.errors_docker,
          timestamps: {
            created_at: details.created_at,
            execelet_start: details.execelet_start,
            start_time: details.start_time,
            end_time: details.end_time,
            finish_time: details.finish_time
          }
        }
        
        console.log('Setting fully loaded run:', fullyLoadedRun)
        
        setLoadingProgress(100)
        setLoadingStatus('Complete!')
        
        // Brief delay to show completion before hiding loading
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Set the fully loaded run (this will show the details panel)
        setSelectedRun(fullyLoadedRun)
      } else {
        console.log('No details returned from API')
        // Still show the basic run info even if details failed
        setSelectedRun(run)
      }
    } catch (error) {
      console.error('Error fetching run details:', error)
      setLoadingStatus('Error loading details')
      // Show the run with basic info on error
      setSelectedRun(run)
    } finally {
      setLoadingRunDetails(false)
      setLoadingProgress(0)
      setLoadingStatus('')
    }
  }

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsPanelRef.current && !detailsPanelRef.current.contains(event.target as Node)) {
        closeDetails()
      }
    }

    if (selectedRun) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [selectedRun])

  // Filter runs based on search query and filters
  const filteredRuns = runs.filter(run => {
    // Text search filter
    const matchesSearch = run.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.id.includes(searchQuery)
    
    // Status filter
    const matchesStatus = filters.status.length === 0 || filters.status.includes(run.status)
    
    // Tab filter for execution type using the execution_type field
    let matchesTab = true
    if (activeTab === 'python') {
      // Check if the run is a Python execution
      matchesTab = run.executionType === 'python code'
      if (!matchesTab) console.log(`Python filter: ${run.id} executionType="${run.executionType}" (expected "python code")`)
    } else if (activeTab === 'docker') {
      // Check if the run is a Docker execution
      matchesTab = run.executionType === 'docker'
      if (!matchesTab) console.log(`Docker filter: ${run.id} executionType="${run.executionType}" (expected "docker")`)
    }
    // 'all' tab shows everything (matchesTab = true)

    // Status filter from the cards
    let matchesStatusFilter = true
    if (activeStatusFilter === 'completed') {
      matchesStatusFilter = ['completed', 'success'].includes(run.status.toLowerCase())
    } else if (activeStatusFilter === 'running') {
      matchesStatusFilter = ['running', 'pending', 'starting', 'waiting for docker container'].includes(run.status.toLowerCase())
    } else if (activeStatusFilter === 'failed') {
      matchesStatusFilter = ['failed', 'error'].includes(run.status.toLowerCase())
    } else if (activeStatusFilter === 'cancelled') {
      matchesStatusFilter = ['cancelled', 'paused'].includes(run.status.toLowerCase())
    } else if (activeStatusFilter === 'aborted') {
      matchesStatusFilter = ['aborted', 'cancelled'].includes(run.status.toLowerCase())
    }
    // 'all' shows everything (matchesStatusFilter = true)
    
    // Date range filter (simplified - last 24h, week, month)
    let matchesDateRange = true
    if (filters.dateRange) {
      const runDate = new Date(run.startTime)
      const now = new Date()
      const dayMs = 24 * 60 * 60 * 1000
      
      switch (filters.dateRange) {
        case '24h':
          matchesDateRange = now.getTime() - runDate.getTime() < dayMs
          break
        case '7d':
          matchesDateRange = now.getTime() - runDate.getTime() < 7 * dayMs
          break
        case '30d':
          matchesDateRange = now.getTime() - runDate.getTime() < 30 * dayMs
          break
        default:
          matchesDateRange = true
      }
    }
    
    return matchesSearch && matchesStatus && matchesTab && matchesStatusFilter && matchesDateRange
  })

  // Sorting logic
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedRuns = [...filteredRuns].sort((a, b) => {
    if (!sortConfig.key) return 0

    let aValue: any = a[sortConfig.key as keyof Run]
    let bValue: any = b[sortConfig.key as keyof Run]

    // Handle different data types
    switch (sortConfig.key) {
      case 'startTime':
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
        break
      case 'duration': {
        // Convert duration string to minutes for sorting
        const parseTime = (timeStr: string) => {
          const parts = timeStr.split(' ')
          let totalMinutes = 0
          parts.forEach(part => {
            if (part.includes('h')) {
              totalMinutes += parseInt(part) * 60
            } else if (part.includes('m')) {
              totalMinutes += parseInt(part)
            } else if (part.includes('s')) {
              totalMinutes += parseInt(part) / 60
            }
          })
          return totalMinutes
        }
        aValue = parseTime(aValue)
        bValue = parseTime(bValue)
        break
      }
      case 'id':
        aValue = parseInt(aValue)
        bValue = parseInt(bValue)
        break
      default:
        aValue = String(aValue).toLowerCase()
        bValue = String(bValue).toLowerCase()
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  // Pagination logic
  const totalPages = Math.ceil(sortedRuns.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedRuns = sortedRuns.slice(startIndex, endIndex)

  // Reset page when search changes or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filters])

  // Handle row selection
  const toggleRowSelection = (runId: string) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(runId)) {
      newSelected.delete(runId)
    } else {
      newSelected.add(runId)
    }
    setSelectedRows(newSelected)
  }

  // Export functionality
  const handleExport = () => {
    const dataToExport = filteredRuns.map(run => ({
      ID: run.id,
      Name: run.name,
      Status: run.status,
      Duration: run.duration,
      Cost: run.cost !== null ? `€${run.cost.toFixed(2)}` : 'N/A',
      Started: new Date(run.startTime).toLocaleDateString(),
      Configuration: run.configuration,
      Description: run.description
    }))

    const csvContent = [
      Object.keys(dataToExport[0]).join(','),
      ...dataToExport.map(row => Object.values(row).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `runs-export-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const toggleAllRows = () => {
    const currentPageIds = paginatedRuns.map(run => run.id)
    const allCurrentPageSelected = currentPageIds.every(id => selectedRows.has(id))
    
    const newSelected = new Set(selectedRows)
    if (allCurrentPageSelected) {
      // Deselect all on current page
      currentPageIds.forEach(id => newSelected.delete(id))
    } else {
      // Select all on current page
      currentPageIds.forEach(id => newSelected.add(id))
    }
    setSelectedRows(newSelected)
  }

  // Helper component for sortable headers
  const SortableHeader: React.FC<{ label: string; sortKey: string; className?: string }> = ({ 
    label, 
    sortKey, 
    className = "px-4 py-3 text-left text-xs font-medium text-gray-500"
  }) => {
    const isSorted = sortConfig.key === sortKey
    return (
      <th className={className}>
        <button
          onClick={() => handleSort(sortKey)}
          className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
        >
          <span>{label}</span>
          <div className="flex flex-col">
            <ChevronUp 
              className={`h-3 w-3 ${isSorted && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-300'}`} 
            />
            <ChevronDown 
              className={`h-3 w-3 -mt-1 ${isSorted && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-300'}`} 
            />
          </div>
        </button>
      </th>
    )
  }

  return (
    <div className="space-y-6 px-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Runs</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-secondary">Monitor and manage your execution jobs.</p>
      </div>

      {/* Execution Type Tabs */}
      <div>
        <nav className="flex space-x-8 border-b border-gray-200 dark:border-dark-border">
          <button
            onClick={() => setActiveTab('all')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text hover:border-gray-300'
            }`}
          >
            All activity
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'python'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text hover:border-gray-300'
            }`}
          >
            Python
          </button>
          <button
            onClick={() => setActiveTab('docker')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'docker'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text hover:border-gray-300'
            }`}
          >
            Docker images
          </button>
        </nav>

        {/* Status Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 py-6">
          <div 
            onClick={() => setActiveStatusFilter('all')}
            className={`rounded-lg p-3 cursor-pointer transition-colors ${
              activeStatusFilter === 'all'
                ? 'border border-blue-500 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800'
                : 'border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20'
            }`}
          >
            <div className="text-sm font-medium text-gray-900 dark:text-dark-text mb-1">All</div>
            <div className={`text-xl font-semibold ${activeStatusFilter === 'all' ? 'text-blue-600 dark:text-dark-text' : 'text-gray-900 dark:text-dark-text'}`}>
              {runs.filter(run => {
                // Apply tab filter for accurate counts
                if (activeTab === 'python') {
                  return run.executionType === 'python code'
                } else if (activeTab === 'docker') {
                  return run.executionType === 'docker'
                }
                return true
              }).length}
            </div>
          </div>
          <div 
            onClick={() => setActiveStatusFilter('completed')}
            className={`rounded-lg p-3 cursor-pointer transition-colors ${
              activeStatusFilter === 'completed'
                ? 'border border-blue-500 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800'
                : 'border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20'
            }`}
          >
            <div className="text-sm font-medium text-gray-900 dark:text-dark-text mb-1">Completed</div>
            <div className={`text-xl font-semibold ${activeStatusFilter === 'completed' ? 'text-blue-600 dark:text-dark-text' : 'text-gray-900 dark:text-dark-text'}`}>
              {runs.filter(run => {
                const matchesTab = activeTab === 'all' ? true : 
                  activeTab === 'python' ? run.executionType === 'python code' :
                  run.executionType === 'docker'
                return matchesTab && ['completed', 'success'].includes(run.status.toLowerCase())
              }).length}
            </div>
          </div>
          <div 
            onClick={() => setActiveStatusFilter('running')}
            className={`rounded-lg p-3 cursor-pointer transition-colors ${
              activeStatusFilter === 'running'
                ? 'border border-blue-500 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800'
                : 'border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20'
            }`}
          >
            <div className="text-sm font-medium text-gray-900 dark:text-dark-text mb-1">Running</div>
            <div className={`text-xl font-semibold ${activeStatusFilter === 'running' ? 'text-blue-600 dark:text-dark-text' : 'text-gray-900 dark:text-dark-text'}`}>
              {runs.filter(run => {
                const matchesTab = activeTab === 'all' ? true : 
                  activeTab === 'python' ? run.executionType === 'python code' :
                  run.executionType === 'docker'
                return matchesTab && ['running', 'pending', 'starting', 'waiting for docker container'].includes(run.status.toLowerCase())
              }).length}
            </div>
          </div>
          <div 
            onClick={() => setActiveStatusFilter('failed')}
            className={`rounded-lg p-3 cursor-pointer transition-colors ${
              activeStatusFilter === 'failed'
                ? 'border border-blue-500 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800'
                : 'border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20'
            }`}
          >
            <div className="text-sm font-medium text-gray-900 dark:text-dark-text mb-1">Failed</div>
            <div className={`text-xl font-semibold ${activeStatusFilter === 'failed' ? 'text-blue-600 dark:text-dark-text' : 'text-gray-900 dark:text-dark-text'}`}>
              {runs.filter(run => {
                const matchesTab = activeTab === 'all' ? true : 
                  activeTab === 'python' ? run.executionType === 'python code' :
                  run.executionType === 'docker'
                return matchesTab && ['failed', 'error'].includes(run.status.toLowerCase())
              }).length}
            </div>
          </div>
          <div 
            onClick={() => setActiveStatusFilter('cancelled')}
            className={`rounded-lg p-3 cursor-pointer transition-colors ${
              activeStatusFilter === 'cancelled'
                ? 'border border-blue-500 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800'
                : 'border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20'
            }`}
          >
            <div className="text-sm font-medium text-gray-900 dark:text-dark-text mb-1">Cancelled</div>
            <div className={`text-xl font-semibold ${activeStatusFilter === 'cancelled' ? 'text-blue-600 dark:text-dark-text' : 'text-gray-900 dark:text-dark-text'}`}>
              {runs.filter(run => {
                const matchesTab = activeTab === 'all' ? true : 
                  activeTab === 'python' ? run.executionType === 'python code' :
                  run.executionType === 'docker'
                return matchesTab && ['cancelled', 'paused'].includes(run.status.toLowerCase())
              }).length}
            </div>
          </div>
          <div 
            onClick={() => setActiveStatusFilter('aborted')}
            className={`rounded-lg p-3 cursor-pointer transition-colors ${
              activeStatusFilter === 'aborted'
                ? 'border border-blue-500 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800'
                : 'border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20'
            }`}
          >
            <div className="text-sm font-medium text-gray-900 dark:text-dark-text mb-1">Aborted</div>
            <div className={`text-xl font-semibold ${activeStatusFilter === 'aborted' ? 'text-blue-600 dark:text-dark-text' : 'text-gray-900 dark:text-dark-text'}`}>
              {runs.filter(run => {
                const matchesTab = activeTab === 'all' ? true : 
                  activeTab === 'python' ? run.executionType === 'python code' :
                  run.executionType === 'docker'
                return matchesTab && ['aborted', 'cancelled'].includes(run.status.toLowerCase())
              }).length}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-dark-border rounded-md text-sm font-medium text-gray-700 dark:text-dark-text-secondary bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors"
            >
              <Filter className="h-4 w-4 mr-1" />
              More filters
            </button>
            {selectedRows.size > 0 && (
              <button
                onClick={() => {
                  // For now, delete runs one by one - could be optimized with bulk API later
                  const selectedRunIds = Array.from(selectedRows)
                  if (selectedRunIds.length === 1) {
                    setShowDeleteConfirm(selectedRunIds[0])
                  } else {
                    // Handle multiple deletes
                    const confirmed = window.confirm(`Are you sure you want to delete ${selectedRunIds.length} selected runs? This action cannot be undone.`)
                    if (confirmed) {
                      selectedRunIds.forEach(runId => {
                        deleteRun(runId)
                      })
                      setSelectedRows(new Set())
                    }
                  }
                }}
                className="inline-flex items-center px-3 py-1.5 border border-red-300 dark:border-red-600 rounded-md text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900 hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete ({selectedRows.size})
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleExport}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-dark-border rounded-md text-sm font-medium text-gray-700 dark:text-dark-text-secondary bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors"
            >
              Export
            </button>
            <button 
              onClick={() => setShowColumnEditor(!showColumnEditor)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-dark-border rounded-md text-sm font-medium text-gray-700 dark:text-dark-text-secondary bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors"
            >
              Edit columns
            </button>
          </div>
        </div>
      </div>


      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-3">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">Status</label>
              <div className="space-y-2">
                {['running', 'pending', 'starting', 'completed', 'success', 'failed', 'error', 'cancelled', 'paused'].map(status => (
                  <label key={status} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.status.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters({...filters, status: [...filters.status, status]})
                        } else {
                          setFilters({...filters, status: filters.status.filter(s => s !== status)})
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-dark-text-secondary capitalize">{status}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">Date Range</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All time</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => setFilters({status: [], dateRange: ''})}
              className="px-3 py-2 text-sm text-gray-600 dark:text-dark-text-secondary hover:text-gray-800 dark:hover:text-dark-text"
            >
              Clear All
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-dark-text-secondary">Loading runs...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-8">
          <div className="flex items-center justify-center text-red-600 dark:text-red-400">
            <XCircle className="h-8 w-8 mr-3" />
            <div>
              <h3 className="font-medium">Error Loading Runs</h3>
              <p className="text-sm text-gray-600 dark:text-dark-text-secondary mt-1">{error}</p>
              <button 
                onClick={() => fetchRuns(true)}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && runs.length === 0 && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-8">
          <div className="flex items-center justify-center text-gray-500 dark:text-dark-text-secondary">
            <Play className="h-8 w-8 mr-3" />
            <div className="text-center">
              <h3 className="font-medium">No runs found</h3>
              <p className="text-sm mt-1">Your execution jobs will appear here once you start running them.</p>
            </div>
          </div>
        </div>
      )}

      {/* Column Editor Panel */}
      {showColumnEditor && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-3">Edit Columns</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(visibleColumns).map(([column, visible]) => (
              <label key={column} className="flex items-center">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisibleColumns(prev => ({
                    ...prev,
                    [column]: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-dark-text-secondary capitalize">
                  {column === 'started' ? 'Start Date' : column}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && runs.length > 0 && (
        <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-dark-border">
                  <th className="px-4 py-3 text-left">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300" 
                      checked={paginatedRuns.length > 0 && paginatedRuns.every(run => selectedRows.has(run.id))}
                      onChange={toggleAllRows}
                    />
                  </th>
                  {visibleColumns.run && <SortableHeader label="Run" sortKey="name" />}
                  {visibleColumns.status && <SortableHeader label="Status" sortKey="status" />}
                  {visibleColumns.duration && <SortableHeader label="Duration" sortKey="duration" />}
                  {visibleColumns.cost && (
                    <SortableHeader 
                      label="Cost" 
                      sortKey="cost" 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500"
                    />
                  )}
                  {visibleColumns.started && (
                    <SortableHeader 
                      label="Started" 
                      sortKey="startTime" 
                      className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500" 
                    />
                  )}
                  {visibleColumns.configuration && (
                    <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500">
                      Configuration
                    </th>
                  )}
                  {visibleColumns.actions && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedRuns.map((run) => (
                  <tr 
                    key={run.id}
                    className="border-b border-gray-50 dark:border-dark-border hover:bg-gray-25 dark:hover:bg-dark-accent/20 cursor-pointer transition-colors"
                    onClick={() => selectRunWithDetails(run)}
                  >
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300" 
                        checked={selectedRows.has(run.id)}
                        onChange={() => toggleRowSelection(run.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    {visibleColumns.run && (
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-dark-text">{run.name}</div>
                        <div className="text-xs text-gray-500 dark:text-dark-text-secondary truncate max-w-xs">#{run.id} • {run.description}</div>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></span>
                          <span className="capitalize">{run.status}</span>
                        </span>
                      </td>
                    )}
                    {visibleColumns.duration && (
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-dark-text-secondary">
                        {run.duration}
                      </td>
                    )}
                    {visibleColumns.cost && (
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-text">
                        {run.cost !== null ? `€${run.cost.toFixed(2)}` : '—'}
                      </td>
                    )}
                    {visibleColumns.started && (
                      <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-500 dark:text-dark-text-secondary">
                        {new Date(run.startTime).toLocaleDateString()}
                      </td>
                    )}
                    {visibleColumns.configuration && (
                      <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-500 dark:text-dark-text-secondary">
                        {run.configuration}
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {canAbortRun(run.status) && (
                            <button
                              onClick={(e) => handleAbortClick(e, run.id)}
                              disabled={abortingRuns.has(run.id)}
                              className="text-gray-400 dark:text-dark-text-secondary hover:text-orange-600 dark:hover:text-orange-400 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded"
                              title="Abort run"
                            >
                              {abortingRuns.has(run.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDeleteClick(e, run.id)}
                            disabled={deletingRuns.has(run.id)}
                            className="text-gray-400 dark:text-dark-text-secondary hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded"
                            title="Delete run"
                          >
                            {deletingRuns.has(run.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination - Always Visible */}
      {!loading && !error && runs.length > 0 && (
        <div className="mt-6 sticky bottom-0 bg-white dark:bg-dark-card px-4 py-3 flex items-center justify-between border border-gray-200 dark:border-dark-border rounded-lg">
          <div className="flex-1 flex justify-between sm:hidden">
            <button 
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-dark-border text-sm font-medium rounded-md text-gray-700 dark:text-dark-text-secondary bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700 dark:text-dark-text-secondary self-center">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-dark-border text-sm font-medium rounded-md text-gray-700 dark:text-dark-text-secondary bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-dark-text-secondary">
                Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, sortedRuns.length)}</span> of{' '}
                <span className="font-medium">{sortedRuns.length}</span> results
                {(searchQuery || filters.status.length > 0 || filters.dateRange) && (
                  <span className="text-gray-500 dark:text-dark-text-secondary"> (filtered from {runs.length} total)</span>
                )}
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md -space-x-px">
                <button 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-sm font-medium text-gray-500 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === pageNum
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-200'
                          : 'border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-500 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-sm font-medium text-gray-500 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Details Panel */}
      {(selectedRun || loadingRunDetails) && createPortal(
        <AnimatePresence>
          <motion.div
            ref={detailsPanelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 right-0 bottom-0 z-[9999] w-full sm:w-[28rem] bg-white dark:bg-dark-card border-l border-gray-200 dark:border-dark-border overflow-y-auto"
            style={{ height: '100vh' }}
          >
            {loadingRunDetails && selectedRun ? (
              /* Loading State with Blurred Background */
              <div className="relative">
                {/* Blurred Background Content */}
                <div className="blur-sm opacity-50 pointer-events-none">
                  <div className="flex items-center justify-between p-6 pt-12 border-b border-gray-200 dark:border-dark-border">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text">
                        {selectedRun.name}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-dark-text-secondary">Run ID: {selectedRun.id}</p>
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="h-32 bg-gray-100 dark:bg-dark-card rounded-lg"></div>
                    <div className="h-24 bg-gray-100 dark:bg-dark-card rounded-lg"></div>
                    <div className="h-48 bg-gray-100 dark:bg-dark-card rounded-lg"></div>
                  </div>
                </div>

                {/* Loading Overlay */}
                <div className="absolute inset-0 bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm flex flex-col items-center justify-center p-12">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">Loading run details...</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary text-center mb-6">{loadingStatus}</p>
                  
                  {/* Progress bar */}
                  <div className="w-full max-w-xs">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-dark-text-secondary mb-1">
                      <span>Progress</span>
                      <span>{loadingProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out" 
                        style={{width: `${loadingProgress}%`}}
                      ></div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={closeDetails}
                  className="absolute top-4 right-4 text-gray-400 dark:text-dark-text-secondary hover:text-gray-600 dark:hover:text-dark-text transition-colors z-10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : selectedRun ? (
              /* Loaded State */
              <React.Fragment>
                <div className="flex items-center justify-between p-6 pt-12 border-b border-gray-200 dark:border-dark-border">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text">
                      {selectedRun.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-dark-text-secondary">Run ID: {selectedRun.id}</p>
                  </div>
              <div className="flex items-center space-x-2">
                {canAbortRun(selectedRun.status) && (
                  <button
                    onClick={() => abortRun(selectedRun.id)}
                    disabled={abortingRuns.has(selectedRun.id)}
                    className="inline-flex items-center px-3 py-1.5 border border-orange-300 dark:border-orange-600 rounded-md text-sm font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900 hover:bg-orange-100 dark:hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Abort run"
                  >
                    {abortingRuns.has(selectedRun.id) ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        Aborting...
                      </>
                    ) : (
                      <>
                        <Square className="h-4 w-4 mr-1" />
                        Abort
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={closeDetails}
                  className="p-2 rounded-md text-gray-400 dark:text-dark-text-secondary hover:text-gray-600 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-accent/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2">Status</h3>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedRun.status)}`}>
                  {getStatusIcon(selectedRun.status)}
                  <span className="ml-1 capitalize">{selectedRun.status}</span>
                </span>
              </div>

              {/* Details */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2">Details</h3>
                <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-dark-text-secondary">Duration:</span>
                    <span className="text-gray-900 dark:text-dark-text">{selectedRun.duration}</span>
                  </div>
                   <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-dark-text-secondary">Execution Cost:</span>
                    <span className="text-gray-900 dark:text-dark-text">{selectedRun.cost !== null ? `${selectedRun.cost.toFixed(4)}€` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-dark-text-secondary">Start Time:</span>
                    <span className="text-gray-900 dark:text-dark-text">
                      {new Date(selectedRun.startTime).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Configuration */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2">Hardware</h3>
                <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4">
                  <div className="text-sm text-gray-900 dark:text-dark-text font-mono">
                    {selectedRun.configuration}
                  </div>
                </div>
              </div>

              {/* Auto-detected Requirements */}
              {selectedRun.install_log && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text">Auto-detected Requirements</h3>
                    {selectedRun.install_return_code === 0 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Installed successfully
                      </span>
                    ) : selectedRun.install_return_code !== null && selectedRun.install_return_code !== undefined ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                        <XCircle className="h-3 w-3 mr-1" />
                        Installation failed
                      </span>
                    ) : null}
                  </div>
                  <button
                    onClick={() => setExpandedInstallLogs(!expandedInstallLogs)}
                    className="w-full bg-gray-50 dark:bg-dark-card hover:bg-gray-100 dark:hover:bg-dark-accent/20 border border-gray-200 dark:border-dark-border rounded-lg p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-gray-600 dark:text-dark-text-secondary" />
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-text">View installation logs</span>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${expandedInstallLogs ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  {expandedInstallLogs && (
                    <div className="mt-2 bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                        {selectedRun.install_log}
                      </pre>
                    </div>
                  )}
                </div>
              )}


              {/* System Errors */}
              {selectedRun.systemErrors && selectedRun.systemErrors.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2">System Errors</h3>
                  <div className="bg-red-50 dark:bg-red-900 border-2 border-red-200 dark:border-red-700 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <div className="space-y-2">
                      {selectedRun.systemErrors.map((error: string, index: number) => (
                        <div key={index} className="flex items-start space-x-2">
                          <div className="flex-shrink-0 mt-0.5">
                            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div className="text-sm text-red-800 dark:text-red-200 font-mono break-words">
                            {error}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-700">
                      <p className="text-xs text-red-700 dark:text-red-300">
                        These are infrastructure or system-level errors that prevented your code from running properly. 
                        Please contact support if these errors persist.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Execution Timeline */}
              {selectedRun.timestamps && (
                <div>
                  <div className="bg-gray-50 dark:bg-dark-card rounded-lg p-4">
                    <TimestampDetails 
                      timestamps={selectedRun.timestamps} 
                      status={selectedRun.status}
                    />
                    
                    {/* Docker Error for Aborted Runs - Integrated into timeline */}
                    {selectedRun.errors_docker && ['aborted', 'cancelled', 'failed'].includes(selectedRun.status.toLowerCase()) && (
                      <div className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg transition-all duration-200">
                        <button
                          onClick={() => setExpandedDockerError(!expandedDockerError)}
                          className="w-full p-3 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Container error occurred</span>
                            </div>
                            <ChevronUp className={`h-4 w-4 text-yellow-600 dark:text-yellow-400 transition-transform duration-200 ${expandedDockerError ? '' : 'rotate-180'}`} />
                          </div>
                        </button>
                        {expandedDockerError && (
                          <div className="px-3 pb-3 border-t border-yellow-200 dark:border-yellow-800">
                            <pre className="mt-3 text-xs text-yellow-800 dark:text-yellow-200 font-mono whitespace-pre-wrap break-all">
                              {selectedRun.errors_docker}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Combined Output */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2">Combined Output</h3>
                <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto">
                  <div className="space-y-1">
                    {selectedRun.combined_output ? (
                      <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                        {selectedRun.combined_output}
                      </pre>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-dark-text-secondary font-mono">
                        No output available
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {selectedRun.warnings && selectedRun.warnings.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2">Warnings</h3>
                  <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 max-h-32 overflow-y-auto">
                    <div className="space-y-1">
                      {selectedRun.warnings.map((warning: string, index: number) => (
                        <div key={index} className="text-sm text-yellow-800 dark:text-yellow-200 font-mono">
                          {warning}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Errors */}
              {selectedRun.errors && selectedRun.errors.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2">Errors</h3>
                  <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4 max-h-32 overflow-y-auto">
                    <div className="space-y-1">
                      {selectedRun.errors.map((error: string, index: number) => (
                        <div key={index} className="text-sm text-red-800 dark:text-red-200 font-mono">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
              </React.Fragment>
            ) : null}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Progress Tooltip */}
      {hoveredRun?.timing && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none"
          style={{ 
            left: `${tooltipPosition.x}px`, 
            top: `${tooltipPosition.y}px` 
          }}
        >
          <JobProgressTooltip timing={hoveredRun.timing} />
        </div>,
        document.body
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-[10002] overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={cancelDelete}></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="inline-block align-bottom bg-white dark:bg-dark-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-[10003]"
            >
              <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 sm:mx-0 sm:h-10 sm:w-10">
                    <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-dark-text">
                      Delete Run
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
                        Are you sure you want to delete this run? This action cannot be undone and all associated data will be permanently removed.
                      </p>
                      <div className="mt-2 text-sm text-gray-900 dark:text-dark-text">
                        <strong>Run:</strong> {runs.find(r => r.id === showDeleteConfirm)?.name || showDeleteConfirm}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-dark-card px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => deleteRun(showDeleteConfirm)}
                  disabled={deletingRuns.has(showDeleteConfirm)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {deletingRuns.has(showDeleteConfirm) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
                <button
                  type="button"
                  onClick={cancelDelete}
                  disabled={deletingRuns.has(showDeleteConfirm)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-dark-border shadow-sm px-4 py-2 bg-white dark:bg-dark-card text-base font-medium text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default RunsPage