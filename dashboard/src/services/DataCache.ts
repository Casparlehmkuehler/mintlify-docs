interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface CacheConfig {
  defaultTTL: number // Time to live in milliseconds
  maxSize: number    // Maximum number of entries
}

class DataCache {
  private static instance: DataCache
  private cache: Map<string, CacheEntry<any>> = new Map()
  private config: CacheConfig

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes default
      maxSize: 100,
      ...config
    }
  }

  public static getInstance(config?: Partial<CacheConfig>): DataCache {
    if (!DataCache.instance) {
      DataCache.instance = new DataCache(config)
    }
    return DataCache.instance
  }

  // Set data in cache with optional TTL
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now()
    const timeToLive = ttl || this.config.defaultTTL
    
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + timeToLive
    })
  }

  // Get data from cache
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    return this.get(key) !== null
  }

  // Remove specific key
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  // Clear all cache
  clear(): void {
    this.cache.clear()
  }

  // Clear expired entries
  clearExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache statistics
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  // Invalidate cache entries that match a pattern
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  // Get or set pattern - fetch if not in cache
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const data = await fetchFn()
    this.set(key, data, ttl)
    return data
  }
}

// Create cache instance with specific TTLs for different data types
export const dataCache = DataCache.getInstance({
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 200
})

// Cache key generators for different data types
export const CacheKeys = {
  dashboardData: () => 'dashboard:data',
  runs: (page: number = 1, filters?: any) => `runs:page:${page}:${JSON.stringify(filters || {})}`,
  storageFiles: (prefix: string = '') => `storage:files:${prefix}`,
  apiKeys: () => 'api:keys',
  billingData: () => 'billing:data',
  userSettings: () => 'user:settings',
  executionDetail: (id: string) => `execution:${id}`,
  envVars: () => 'env:vars',
  
  // Pattern invalidation keys
  allRuns: () => /^runs:/,
  allStorage: () => /^storage:/,
  allDashboard: () => /^dashboard:/,
  allEnvVars: () => /^env:/
}

export default DataCache