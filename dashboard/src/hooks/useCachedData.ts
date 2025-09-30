import { useState, useEffect, useCallback } from 'react'
import { buildApiUrl } from '../lib/api'
import { dataCache, CacheKeys } from '../services/DataCache'
import { dataPreloader } from '../services/DataPreloader'

interface UseCachedDataOptions {
  cacheKey: string
  fetchFn: () => Promise<any>
  ttl?: number
  immediate?: boolean
  dependencies?: any[]
}

interface UseCachedDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  refresh: () => Promise<void>
}

export function useCachedData<T>({
  cacheKey,
  fetchFn,
  ttl,
  immediate = true,
  dependencies = []
}: UseCachedDataOptions): UseCachedDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (fromCache = true) => {
    try {
      setError(null)

      // Try to get from cache first
      if (fromCache) {
        const cached = dataCache.get<T>(cacheKey)
        if (cached) {
          setData(cached)
          return
        }
      }

      setLoading(true)
      const result = await fetchFn()
      
      // Cache the result
      dataCache.set(cacheKey, result, ttl)
      setData(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data'
      setError(errorMessage)
      console.error(`Error loading data for ${cacheKey}:`, err)
    } finally {
      setLoading(false)
    }
  }, [cacheKey, fetchFn, ttl])

  // Refetch - always hits the API and updates cache
  const refetch = useCallback(async () => {
    await loadData(false)
  }, [loadData])

  // Refresh - clears cache then refetches
  const refresh = useCallback(async () => {
    dataCache.delete(cacheKey)
    await loadData(false)
  }, [cacheKey, loadData])

  // Load data on mount and when dependencies change
  useEffect(() => {
    if (immediate) {
      loadData()
    }
  }, [loadData, immediate, ...dependencies])

  return { data, loading, error, refetch, refresh }
}

// Specialized hooks for common data types
export function useDashboardData() {
  return useCachedData({
    cacheKey: CacheKeys.dashboardData(),
    fetchFn: async () => {
      // This will be called by dataPreloader or fallback to direct fetch
      const cached = dataCache.get(CacheKeys.dashboardData())
      if (cached) return cached

      // Fallback - should rarely happen if preloader is working
      throw new Error('Dashboard data not preloaded')
    },
    ttl: 15 * 60 * 1000 // 15 minutes
  })
}

export function useRunsData(page: number = 1, filters?: any) {
  return useCachedData({
    cacheKey: CacheKeys.runs(page, filters),
    fetchFn: async () => {
      // Fallback direct API call if cache miss
      const { data: { session } } = await (await import('../lib/supabase')).supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const response = await fetch(buildApiUrl('/api/v2/external/billing/history?limit=100'), {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (!response.ok) throw new Error('Failed to fetch runs')
      return response.json()
    },
    dependencies: [page, JSON.stringify(filters)],
    ttl: 10 * 60 * 1000 // 10 minutes
  })
}

export function useStorageData(prefix: string = '') {
  return useCachedData({
    cacheKey: CacheKeys.storageFiles(prefix),
    fetchFn: async () => {
      const cached = dataCache.get(CacheKeys.storageFiles(prefix))
      if (cached) return cached

      throw new Error('Storage data not preloaded')
    },
    dependencies: [prefix],
    ttl: 1 * 60 * 1000 // 1 minute (storage changes frequently)
  })
}

export function useApiKeysData() {
  return useCachedData({
    cacheKey: CacheKeys.apiKeys(),
    fetchFn: async () => {
      const cached = dataCache.get(CacheKeys.apiKeys())
      if (cached) return cached

      throw new Error('API keys data not preloaded')
    },
    ttl: 10 * 60 * 1000 // 10 minutes
  })
}

export function useBillingData() {
  return useCachedData({
    cacheKey: CacheKeys.billingData(),
    fetchFn: async () => {
      const cached = dataCache.get(CacheKeys.billingData())
      if (cached) return cached

      throw new Error('Billing data not preloaded')
    },
    ttl: 5 * 60 * 1000 // 5 minutes
  })
}

// Hook to manually trigger preloading
export function usePreloader() {
  const triggerPreload = useCallback((page: string) => {
    dataPreloader.preloadForPage(page)
  }, [])

  const invalidateCache = useCallback((pattern: 'runs' | 'storage' | 'dashboard' | 'all') => {
    dataPreloader.invalidateCache(pattern)
  }, [])

  const getCacheStats = useCallback(() => {
    return dataPreloader.getCacheStats()
  }, [])

  return { triggerPreload, invalidateCache, getCacheStats }
}