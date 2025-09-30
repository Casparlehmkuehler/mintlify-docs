import { supabase } from '../lib/supabase'
import { buildApiUrl } from '../lib/api'
import { dataCache, CacheKeys } from './DataCache'

interface PreloadConfig {
  immediate: boolean  // Should preload immediately
  priority: number   // Higher number = higher priority
  dependencies?: string[] // Other data this depends on
}

class DataPreloader {
  private static instance: DataPreloader
  private preloadQueue: Array<{ key: string; fetchFn: () => Promise<any>; config: PreloadConfig }> = []
  private isProcessing = false
  private preloadedPages = new Set<string>()

  private constructor() {
    // Clean up expired cache entries periodically
    setInterval(() => {
      dataCache.clearExpired()
    }, 2 * 60 * 1000) // Every 2 minutes
  }

  public static getInstance(): DataPreloader {
    if (!DataPreloader.instance) {
      DataPreloader.instance = new DataPreloader()
    }
    return DataPreloader.instance
  }

  // Add data to preload queue
  private addToQueue(key: string, fetchFn: () => Promise<any>, config: PreloadConfig) {
    // Don't add if already in cache or already in queue
    if (dataCache.has(key) || this.preloadQueue.some(item => item.key === key)) {
      return
    }

    this.preloadQueue.push({ key, fetchFn, config })
    
    // Sort by priority
    this.preloadQueue.sort((a, b) => b.config.priority - a.config.priority)

    if (config.immediate && !this.isProcessing) {
      this.processQueue()
    }
  }

  // Process the preload queue
  private async processQueue() {
    if (this.isProcessing || this.preloadQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.preloadQueue.length > 0) {
      const item = this.preloadQueue.shift()!
      
      try {
        // Check if still needed (might have been loaded by user action)
        if (!dataCache.has(item.key)) {
          const data = await item.fetchFn()
          dataCache.set(item.key, data)
        }
      } catch (error) {
        console.warn(`Failed to preload ${item.key}:`, error)
      }

      // Small delay to prevent overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    this.isProcessing = false
  }

  // Preload dashboard data
  async preloadDashboardData() {
    const key = CacheKeys.dashboardData()
    
    this.addToQueue(key, async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      // Only fetch executions for dashboard data
      const executionsRes = await fetch(buildApiUrl('/api/v2/external/billing/history?limit=100'), {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      const executions = executionsRes.ok ? await executionsRes.json() : { executions: [] }

      return {
        executions: executions.executions || [],
        fetchedAt: Date.now()
      }
    }, { immediate: true, priority: 10 })
  }

  // Preload runs data
  async preloadRunsData() {
    const key = CacheKeys.runs(1)
    
    this.addToQueue(key, async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const response = await fetch(buildApiUrl('/api/v2/external/billing/history?limit=100'), {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (!response.ok) throw new Error('Failed to fetch runs')
      return response.json()
    }, { immediate: false, priority: 8 })
  }

  // Preload storage data
  async preloadStorageData(prefix: string = '') {
    const key = CacheKeys.storageFiles(prefix)
    
    this.addToQueue(key, async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const url = buildApiUrl(`/api/v2/external/storage/list-files?prefix=${encodeURIComponent(prefix)}&max_files=1000`)
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (!response.ok) throw new Error('Failed to fetch storage')
      return response.json()
    }, { immediate: false, priority: 7 })
  }

  // Preload API keys - DISABLED to reduce API calls
  async preloadApiKeys() {
    // No longer preloading API keys to reduce unnecessary requests
    return Promise.resolve([])
  }

  // Preload billing data - DISABLED to reduce API calls
  async preloadBillingData() {
    // No longer preloading billing data to reduce unnecessary requests
    return Promise.resolve({ credits: null })
  }

  // Smart preloading based on current page
  async preloadForPage(currentPage: string) {
    if (this.preloadedPages.has(currentPage)) {
      return
    }

    this.preloadedPages.add(currentPage)

    switch (currentPage) {
      case '/':
      case '/dashboard':
        // Only preload runs data for dashboard
        await this.preloadRunsData()
        setTimeout(() => {
          this.preloadStorageData()
        }, 1000)
        break

      case '/runs':
        await this.preloadRunsData()
        setTimeout(() => {
          this.preloadStorageData()
        }, 500)
        break

      case '/storage':
        await this.preloadStorageData()
        break

      case '/api-keys':
        // No longer preloading API keys
        break

      case '/billing':
        // No longer preloading billing data
        break
    }

    // Start processing queue if not already
    if (!this.isProcessing) {
      setTimeout(() => this.processQueue(), 200)
    }
  }

  // Invalidate cache for specific patterns (call after mutations)
  invalidateCache(pattern: 'runs' | 'storage' | 'dashboard' | 'all') {
    switch (pattern) {
      case 'runs':
        dataCache.invalidatePattern(CacheKeys.allRuns())
        this.preloadedPages.delete('/runs')
        break
      case 'storage':
        dataCache.invalidatePattern(CacheKeys.allStorage())
        this.preloadedPages.delete('/storage')
        break
      case 'dashboard':
        dataCache.invalidatePattern(CacheKeys.allDashboard())
        this.preloadedPages.delete('/')
        this.preloadedPages.delete('/dashboard')
        break
      case 'all':
        dataCache.clear()
        this.preloadedPages.clear()
        break
    }
  }

  // Force immediate preload
  async forcePreload() {
    await this.processQueue()
  }

  // Get cache statistics
  getCacheStats() {
    return {
      cache: dataCache.getStats(),
      preloadedPages: Array.from(this.preloadedPages),
      queueLength: this.preloadQueue.length
    }
  }
}

export const dataPreloader = DataPreloader.getInstance()
export default DataPreloader