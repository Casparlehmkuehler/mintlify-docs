import React, { useState, useEffect } from 'react'
import { Plus, Copy, Trash2, Calendar, Key, Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { dataCache, CacheKeys } from '../../services/DataCache'
import { dataPreloader } from '../../services/DataPreloader'
import { usePreloader } from '../../hooks/useCachedData'
import { buildApiUrl } from '../../lib/api'
import { analytics, ANALYTICS_EVENTS, CTA_NAMES } from '../../services/analytics'

interface ApiKey {
  id: string
  user_id: string
  key_name: string
  key_hash: string
  key_prefix: string
  is_active: boolean | null
  last_used_at: string | null
  created_at: string | null
  updated_at: string | null
  expires_at: string | null
}


const ApiKeysPage: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewKeyModal, setShowNewKeyModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyExpiryDate, setNewKeyExpiryDate] = useState('')
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState<'api-keys' | 'jwt'>('api-keys')
  const [jwtToken, setJwtToken] = useState<string | null>(null)
  const [jwtLoading, setJwtLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const { invalidateCache } = usePreloader()

  useEffect(() => {
    if (activeTab === 'api-keys') {
      // Trigger preloading for API keys data
      dataPreloader.preloadApiKeys()
      fetchApiKeys()
    } else if (activeTab === 'jwt') {
      fetchJwtToken()
      // No automatic refresh - only fetch on tab switch or manual refresh
    }
  }, [activeTab])

  const fetchApiKeys = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true)
      
      const cacheKey = CacheKeys.apiKeys()
      
      // Try cache first (if not forcing refresh)
      if (!forceRefresh) {
        const cached = dataCache.get(cacheKey)
        if (cached && Array.isArray(cached)) {
          setApiKeys(cached)
          setLoading(false)
          return
        }
      }
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.error('No authenticated user')
        return
      }

      const response = await fetch(buildApiUrl('/api/v2/external/auth/api-keys/'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        console.error('Error fetching API keys:', await response.text())
        return
      }

      const data = await response.json()
      
      // Cache the API keys data
      dataCache.set(cacheKey, data || [], 10 * 60 * 1000) // 10 minute TTL
      
      setApiKeys(data || [])
    } catch (error) {
      console.error('Error fetching API keys:', error)
    } finally {
      setLoading(false)
    }
  }


  const fetchJwtToken = async () => {
    try {
      setJwtLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        setJwtToken(session.access_token)
      } else {
        setJwtToken(null)
      }
    } catch (error) {
      console.error('Error fetching JWT token:', error)
      setJwtToken(null)
    } finally {
      setJwtLoading(false)
    }
  }

  const copyToClipboard = (text: string, isJwt: boolean = false, keyName?: string) => {
    navigator.clipboard.writeText(text)
    
    // Track copy action
    analytics.trackCTA(CTA_NAMES.COPY_API_KEY, {
      key_type: isJwt ? 'jwt' : 'api_key',
      key_name: keyName || 'jwt_token'
    })
    
    if (isJwt) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const deleteApiKey = async (keyId: string, keyName?: string) => {
    try {
      // Track delete attempt
      analytics.trackCTA(CTA_NAMES.DELETE_API_KEY, {
        key_id: keyId,
        key_name: keyName
      })
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.error('No authenticated user')
        return
      }

      const response = await fetch(buildApiUrl(`/api/v2/external/auth/api-keys/${keyId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        console.error('Error deleting API key:', await response.text())
        analytics.track('api_key_delete_failed', { key_id: keyId, error: 'request_failed' })
        return
      }

      // Track successful deletion
      analytics.track(ANALYTICS_EVENTS.API_KEY_DELETED, {
        key_id: keyId,
        key_name: keyName
      })

      // Invalidate cache and refresh
      invalidateCache('all') // API keys affect other parts of the dashboard
      await fetchApiKeys(true)
    } catch (error) {
      console.error('Error deleting API key:', error)
    }
  }


  const createNewKey = async () => {
    if (newKeyName.trim()) {
      try {
        // Track API key creation attempt
        analytics.trackCTA(CTA_NAMES.CREATE_API_KEY, {
          key_name: newKeyName
        })
        
        setCreating(true)
        setError(null)
        
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError('User not authenticated')
          return
        }

        // Use the selected expiry date or default to 1 year
        let expiresAt: Date
        if (newKeyExpiryDate) {
          expiresAt = new Date(newKeyExpiryDate)
          // Validate that the date is in the future
          if (expiresAt <= new Date()) {
            setError('Expiry date must be in the future')
            return
          }
        } else {
          expiresAt = new Date()
          expiresAt.setFullYear(expiresAt.getFullYear() + 1)
        }

        const response = await fetch(buildApiUrl('/api/v2/external/auth/api-keys/'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            key_name: newKeyName,
            expires_at: expiresAt.toISOString()
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          setError(errorData.detail || 'Failed to create API key')
          return
        }

        const keyData = await response.json()
        setNewKeyValue(keyData.api_key)
        
        // Track successful API key creation
        analytics.track(ANALYTICS_EVENTS.API_KEY_CREATED, {
          key_name: newKeyName,
          expires_at: expiresAt.toISOString()
        })
        
        // Track success flow 3 - API key generated
        analytics.trackSuccessFlow(3, 'api_key_generated', {
          key_name: newKeyName
        })
        
        setNewKeyName('')
        setNewKeyExpiryDate('')
        setError(null)
        
        // Invalidate cache and refresh
        invalidateCache('all') // API keys affect other parts of the dashboard
        await fetchApiKeys(true)
      } catch (error) {
        setError('Failed to create API key. Please try again.')
        console.error('Error creating API key:', error)
        
        // Track failed API key creation
        analytics.track('api_key_create_failed', {
          key_name: newKeyName,
          error: error instanceof Error ? error.message : 'unknown_error'
        })
      } finally {
        setCreating(false)
      }
    }
  }

  return (
    <div className="space-y-5 px-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Authentication</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-dark-text-secondary">Manage your API keys and JWT tokens for accessing Lyceum services.</p>
          </div>
          {activeTab === 'api-keys' && (
            <button
              onClick={() => {
                analytics.trackCTA('open_create_api_key_modal')
                setShowNewKeyModal(true)
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Key
            </button>
          )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-dark-border">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'api-keys'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-dark-text-secondary dark:hover:text-dark-text'
            }`}
          >
            <div className="flex items-center">
              <Key className="h-4 w-4 mr-2" />
              API Keys
            </div>
          </button>
          <button
            onClick={() => setActiveTab('jwt')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'jwt'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-dark-text-secondary dark:hover:text-dark-text'
            }`}
          >
            <div className="flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              JWT Token
            </div>
          </button>
        </nav>
      </div>

      {/* API Keys Tab Content */}
      {activeTab === 'api-keys' && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Your API Keys</h2>
          </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500 dark:text-dark-text-secondary">Loading API keys...</div>
        ) : apiKeys.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-dark-text-secondary">No API keys found. Create your first key to get started.</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">{apiKey.key_name}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      apiKey.is_active 
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                        : 'bg-gray-100 dark:bg-dark-card text-gray-800 dark:text-dark-text'
                    }`}>
                      {apiKey.is_active ? 'active' : 'inactive'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-dark-text-secondary">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Created: {apiKey.created_at ? new Date(apiKey.created_at).toLocaleDateString() : 'Unknown'}
                    </div>
                    <div>
                      Last used: {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleDateString() : 'Never'}
                    </div>
                    {apiKey.expires_at && (
                      <div>
                        Expires: {new Date(apiKey.expires_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-start space-x-2">
                    <div className="flex-1">
                      <div className="flex items-start bg-gray-50 dark:bg-dark-card rounded-md px-3 py-2">
                        <code 
                          className="flex-1 text-sm font-mono text-gray-900 dark:text-dark-text leading-relaxed"
                          style={{ 
                            wordBreak: 'break-all', 
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                            maxWidth: '100%'
                          }}
                        >
                          {newKeyValue && apiKey.id === apiKeys[0]?.id
                            ? newKeyValue
                            : `${apiKey.key_prefix}${'•'.repeat(32)}`
                          }
                        </code>
                        <div className="flex items-start space-x-1 ml-2 mt-1">
                          {newKeyValue && apiKey.id === apiKeys[0]?.id && (
                            <button
                              onClick={() => copyToClipboard(newKeyValue, false, apiKey.key_name)}
                              className="p-1 text-gray-400 dark:text-dark-text-secondary hover:text-gray-600 dark:hover:text-dark-text"
                              title="Copy to clipboard"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteApiKey(apiKey.id, apiKey.key_name)}
                  className="ml-4 p-2 text-gray-400 dark:text-dark-text-secondary hover:text-red-600 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            ))}
          </div>
        )}
        </div>
      )}

      {/* JWT Token Tab Content */}
      {activeTab === 'jwt' && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Current Session JWT Token</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-secondary">
              Your JWT token auto-refreshes every 5 minutes to stay current with your session.
            </p>
          </div>
          {jwtLoading ? (
            <div className="p-6 text-center text-gray-500 dark:text-dark-text-secondary">Loading JWT token...</div>
          ) : jwtToken ? (
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                    Access Token (JWT)
                  </label>
                  <div className="relative">
                    <div className="bg-gray-50 dark:bg-dark-card rounded-md px-3 py-3 border border-gray-200 dark:border-dark-border">
                      <code 
                        className="block text-sm font-mono text-gray-900 dark:text-dark-text leading-relaxed"
                        style={{ 
                          wordBreak: 'break-all', 
                          overflowWrap: 'anywhere',
                          whiteSpace: 'pre-wrap',
                          maxWidth: '100%',
                          fontSize: '12px'
                        }}
                      >
                        {jwtToken}
                      </code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(jwtToken, true)}
                      className="absolute top-2 right-2 p-2 text-gray-400 dark:text-dark-text-secondary hover:text-gray-600 dark:hover:text-dark-text bg-white dark:bg-dark-card rounded-md border border-gray-200 dark:border-dark-border"
                      title="Copy to clipboard"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    {copied && (
                      <div className="absolute top-2 right-14 bg-green-600 text-white px-2 py-1 rounded text-sm">
                        Copied!
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-dark-text-secondary">
                  <div className="flex items-center">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    <span>Auto-refreshing</span>
                  </div>
                  <div>
                    <button
                      onClick={fetchJwtToken}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      Refresh manually
                    </button>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> This JWT token represents your current authenticated session. Use it as a Bearer token in the Authorization header for API requests.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500 dark:text-dark-text-secondary">
              <p>No active session found. Please sign in to view your JWT token.</p>
            </div>
          )}
        </div>
      )}

      {/* Create New Key Modal */}
      {(showNewKeyModal || newKeyValue) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:border-dark-border">
          <div className="bg-white dark:bg-dark-card rounded-lg p-6 w-full max-w-md dark:border-dark-border">
            {newKeyValue ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">API Key Created Successfully!</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                      Your New API Key
                    </label>
                    <div className="flex items-start bg-gray-50 dark:bg-dark-card rounded-md px-3 py-2 border border-gray-300 dark:border-dark-border">
                      <code 
                        className="flex-1 text-sm font-mono text-gray-900 dark:text-dark-text leading-relaxed"
                        style={{ 
                          wordBreak: 'break-all', 
                          overflowWrap: 'anywhere',
                          whiteSpace: 'pre-wrap',
                          maxWidth: '100%'
                        }}
                      >
                        {newKeyValue}
                      </code>
                      <button
                        onClick={() => copyToClipboard(newKeyValue, false, newKeyName || 'new_key')}
                        className="ml-2 p-1 text-gray-400 dark:text-dark-text-secondary hover:text-gray-600 dark:hover:text-dark-text flex-shrink-0 mt-1"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      Save this key now! You won't be able to see it again.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setNewKeyValue(null)
                      setShowNewKeyModal(false)
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Create New API Key</h2>
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-3">
                      <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                      Key Name
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => {
                        setNewKeyName(e.target.value)
                        setError(null) // Clear error when user types
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Production API Key"
                      disabled={creating}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                      Expiry Date (optional)
                    </label>
                    <input
                      type="date"
                      value={newKeyExpiryDate}
                      onChange={(e) => {
                        setNewKeyExpiryDate(e.target.value)
                        setError(null) // Clear error when user types
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text-secondary focus:ring-blue-500 focus:border-blue-500"
                      min={new Date().toISOString().split('T')[0]} // Today's date as minimum
                      disabled={creating}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-dark-text-secondary">
                      Leave empty to use default expiry (1 year from now)
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowNewKeyModal(false)
                      setError(null)
                      setNewKeyName('')
                      setNewKeyExpiryDate('')
                    }}
                    disabled={creating}
                    className="px-4 py-2 border border-gray-300 dark:border-dark-border rounded-md text-sm font-medium text-gray-700 dark:text-dark-text-secondary bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createNewKey}
                    disabled={creating || !newKeyName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {creating && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {creating ? 'Creating...' : 'Create Key'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ApiKeysPage