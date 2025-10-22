import React, { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Upload,
  Search,
  Edit3,
  Trash2,
  Save,
  X,
  Download
} from 'lucide-react'
import { analytics } from '../../services/analytics'
import { envVarsApi, type EnvVar, type CreateEnvVarRequest } from '../../services/envVarsApi'
import { dataCache, CacheKeys } from '../../services/DataCache'

interface TempEnvVar {
  id: string
  name: string
  value: string
}

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

const EnvVarsPage: React.FC = () => {
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [tempVars, setTempVars] = useState<TempEnvVar[]>([{ id: generateId(), name: '', value: '' }])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editValue, setEditValue] = useState('')
  const [copiedNameId, setCopiedNameId] = useState<string | null>(null)
  const [nameErrors, setNameErrors] = useState<{[key: string]: string}>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadEnvVars()
  }, [])

  const loadEnvVars = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Use cache with 2 minute TTL for env vars
      const vars = await dataCache.getOrFetch(
        CacheKeys.envVars(),
        () => envVarsApi.getAllEnvVars(),
        2 * 60 * 1000 // 2 minutes TTL
      )
      
      setEnvVars(vars)
    } catch (err) {
      console.error('Error loading environment variables:', err)
      setError(err instanceof Error ? err.message : 'Failed to load environment variables')
    } finally {
      setLoading(false)
    }
  }



  const validateEnvVarName = (name: string) => {
    // Check if name is empty
    if (!name.trim()) {
      return 'Name is required'
    }

    const trimmedName = name.trim()

    // Check if name starts with a digit
    if (/^\d/.test(trimmedName)) {
      return 'The name should not start with a digit'
    }

    // Check if name contains only letters, digits, and underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
      return 'The name contains invalid characters. Only letters, digits, and underscores are allowed'
    }

    return null
  }

  const addAnotherTempVar = () => {
    const newTempVar: TempEnvVar = {
      id: generateId(),
      name: '',
      value: ''
    }
    setTempVars([...tempVars, newTempVar])
  }

  const updateTempVar = (id: string, field: 'name' | 'value', value: string) => {
    setTempVars(tempVars.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ))
    
    // Clear error when user starts typing
    if (field === 'name' && nameErrors[id]) {
      const newErrors = { ...nameErrors }
      delete newErrors[id]
      setNameErrors(newErrors)
    }
  }

  const removeTempVar = (id: string) => {
    if (tempVars.length > 1) {
      setTempVars(tempVars.filter(v => v.id !== id))
      const newErrors = { ...nameErrors }
      delete newErrors[id]
      setNameErrors(newErrors)
    }
  }

  const saveTempVars = async () => {
    const validVars: CreateEnvVarRequest[] = []
    const errors: {[key: string]: string} = {}
    let hasErrors = false

    tempVars.forEach(tempVar => {
      if (!tempVar.name.trim() && !tempVar.value.trim()) {
        return // Skip empty rows
      }

      if (!tempVar.name.trim()) {
        errors[tempVar.id] = 'Name is required'
        hasErrors = true
        return
      }

      if (!tempVar.value.trim()) {
        errors[tempVar.id] = 'Value is required'
        hasErrors = true
        return
      }

      // Validate name
      const nameValidationError = validateEnvVarName(tempVar.name)
      if (nameValidationError) {
        errors[tempVar.id] = nameValidationError
        hasErrors = true
        return
      }

      // Check for duplicates in existing vars
      if (envVars.some(v => v.name === tempVar.name.trim())) {
        errors[tempVar.id] = 'Environment variable with this name already exists'
        hasErrors = true
        return
      }

      // Check for duplicates in current temp vars
      const duplicateInTemp = tempVars.filter(v => v.name.trim() === tempVar.name.trim()).length > 1
      if (duplicateInTemp) {
        errors[tempVar.id] = 'Duplicate name in current entries'
        hasErrors = true
        return
      }

      validVars.push({
        name: tempVar.name.trim(),
        value: tempVar.value.trim()
      })
    })

    setNameErrors(errors)

    if (!hasErrors && validVars.length > 0) {
      try {
        setSaving(true)
        setError(null)
        
        let newVars: EnvVar[]
        if (validVars.length === 1) {
          // Create single variable
          const newVar = await envVarsApi.createEnvVar(validVars[0])
          newVars = [newVar]
        } else {
          // Create multiple variables
          newVars = await envVarsApi.createMultipleEnvVars(validVars)
        }
        
        // Update local state and invalidate cache
        const updatedVars = [...envVars, ...newVars]
        setEnvVars(updatedVars)
        setTempVars([{ id: generateId(), name: '', value: '' }]) // Reset to single empty row
        setNameErrors({})
        
        // Invalidate cache
        dataCache.delete(CacheKeys.envVars())
        
        analytics.track('env_vars_created', {
          count: newVars.length,
          total_count: updatedVars.length
        })
      } catch (err) {
        console.error('Error saving environment variables:', err)
        setError(err instanceof Error ? err.message : 'Failed to save environment variables')
      } finally {
        setSaving(false)
      }
    }
  }

  const deleteEnvVar = async (id: string) => {
    try {
      await envVarsApi.deleteEnvVar(id)
      const updatedVars = envVars.filter(v => v.id !== id)
      setEnvVars(updatedVars)
      
      // Invalidate cache
      dataCache.delete(CacheKeys.envVars())
      
      analytics.track('env_var_deleted', {
        total_count: updatedVars.length
      })
    } catch (err) {
      console.error('Error deleting environment variable:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete environment variable')
    }
  }

  const startEdit = (envVar: EnvVar) => {
    setEditingId(envVar.id)
    setEditName(envVar.name)
    setEditValue('') // Start with empty value field for security
  }

  const saveEdit = async () => {
    if (!editName.trim() || !editValue.trim() || !editingId) return

    // Validate name
    const nameValidationError = validateEnvVarName(editName)
    if (nameValidationError) {
      alert(nameValidationError)
      return
    }

    const existingVar = envVars.find(v => v.name === editName.trim() && v.id !== editingId)
    if (existingVar) {
      alert('Environment variable with this name already exists')
      return
    }

    try {
      const updatedVar = await envVarsApi.updateEnvVar(editingId, editName.trim(), editValue.trim())
      
      const updatedVars = envVars.map(v => 
        v.id === editingId ? updatedVar : v
      )
      setEnvVars(updatedVars)
      setEditingId(null)
      setEditName('')
      setEditValue('')
      
      // Invalidate cache
      dataCache.delete(CacheKeys.envVars())
      
      analytics.track('env_var_updated', {
        total_count: updatedVars.length
      })
    } catch (err) {
      console.error('Error updating environment variable:', err)
      alert(err instanceof Error ? err.message : 'Failed to update environment variable')
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditValue('')
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      parseEnvContent(content)
      analytics.track('env_file_uploaded')
    }
    reader.readAsText(file)
  }

  const parseEnvContent = (content: string) => {
    const lines = content.split('\n')
    const newTempVars: TempEnvVar[] = []
    
    lines.forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [name, ...valueParts] = trimmed.split('=')
        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
        
        if (name && value !== undefined) {
          const cleanName = name.trim()
          
          // Add to temp vars (validation will happen on save)
          newTempVars.push({
            id: generateId(),
            name: cleanName,
            value: value
          })
        }
      }
    })

    if (newTempVars.length > 0) {
      // Clear existing temp vars and replace with parsed content
      setTempVars(newTempVars)
      setNameErrors({})
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const pastedText = event.clipboardData.getData('text')
    
    try {
      const parsed = JSON.parse(pastedText)
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        const newTempVars: TempEnvVar[] = []
        
        Object.entries(parsed).forEach(([key, value]) => {
          if (typeof value === 'string') {
            newTempVars.push({
              id: generateId(),
              name: key,
              value: value
            })
          }
        })
        
        if (newTempVars.length > 0) {
          setTempVars(newTempVars)
          setNameErrors({})
          event.preventDefault()
          analytics.track('env_vars_bulk_pasted', {
            count: newTempVars.length
          })
          return
        }
      }
    } catch {
      // Not JSON, try env format
    }

    // Try env format
    if (pastedText.includes('=')) {
      parseEnvContent(pastedText)
      event.preventDefault()
    }
  }

  const copyNameToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedNameId(id)
      setTimeout(() => setCopiedNameId(null), 2000)
    })
  }

  const exportEnvFile = () => {
    const content = envVars.map(v => `${v.name}="${v.value}"`).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lyceum.env'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    analytics.track('env_file_exported', {
      count: envVars.length
    })
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays < 7) return `${diffInDays}d ago`
    return date.toLocaleDateString()
  }

  const filteredVars = envVars.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 px-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Environment Variables</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-secondary">
          Manage your environment variables securely
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400 dark:text-red-300" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              <button 
                onClick={() => {
                  setError(null)
                  loadEnvVars()
                }}
                className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:text-red-500 dark:hover:text-red-300"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add new env var */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Add New Variables</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4 mb-4" onPaste={handlePaste}>
          {tempVars.map((tempVar, index) => (
            <div key={tempVar.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                {index === 0 && (
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                    Name
                  </label>
                )}
                <div className="relative">
                  <input
                    type="text"
                    value={tempVar.name}
                    onChange={(e) => updateTempVar(tempVar.id, 'name', e.target.value)}
                    placeholder="API_KEY"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-bg dark:text-dark-text ${
                      nameErrors[tempVar.id] 
                        ? 'border-red-300 dark:border-red-600' 
                        : 'border-gray-300 dark:border-dark-border'
                    }`}
                  />
                  {tempVars.length > 1 && (
                    <button
                      onClick={() => removeTempVar(tempVar.id)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove this variable"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {nameErrors[tempVar.id] && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{nameErrors[tempVar.id]}</p>
                )}
              </div>
              <div>
                {index === 0 && (
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                    Value
                  </label>
                )}
                <input
                  type="text"
                  value={tempVar.value}
                  onChange={(e) => updateTempVar(tempVar.id, 'value', e.target.value)}
                  placeholder="your-secret-value"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-bg dark:text-dark-text"
                />
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={addAnotherTempVar}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text rounded-lg hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text rounded-lg hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload .env File
            </button>
            
            {envVars.length > 0 && (
              <button
                onClick={exportEnvFile}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text rounded-lg hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export .env
              </button>
            )}
          </div>
          
          <button
            onClick={saveTempVars}
            disabled={saving || tempVars.every(v => !v.name.trim() && !v.value.trim())}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        
          <input
            ref={fileInputRef}
            type="file"
            accept=".env,.txt,text/plain"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Search and count */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 dark:text-dark-text-secondary" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search variables..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-bg dark:text-dark-text"
          />
        </div>
      </div>

      {/* Environment variables list */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Your Environment Variables</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500 dark:text-dark-text-secondary">Loading environment variables...</div>
        ) : filteredVars.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-dark-text-secondary">
            {envVars.length === 0 ? 'No environment variables found. Create your first variable to get started.' : 'No variables match your search.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredVars.map((envVar) => (
              <div key={envVar.id} className="p-6">
                {editingId === envVar.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-bg dark:text-dark-text"
                      />
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Enter new value"
                        className="px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-bg dark:text-dark-text"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={!editName.trim() || !editValue.trim()}
                        className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text rounded-lg hover:bg-gray-50 dark:hover:bg-dark-accent/20 text-sm"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center py-2">
                    {/* Variable Name - Fixed Width */}
                    <div className="w-64 flex-shrink-0">
                      <div className="relative group">
                        <code 
                          className="text-sm font-medium text-gray-900 dark:text-dark-text cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate block"
                          onClick={() => copyNameToClipboard(envVar.name, envVar.id)}
                        >
                          {envVar.name}
                        </code>
                        {/* Hover tooltip */}
                        <span className="absolute -top-7 left-0 px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                          {copiedNameId === envVar.id ? 'Copied!' : 'Click to copy'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Value - Always Hidden */}
                    <div className="w-96 ml-8">
                      <code className="text-sm text-gray-600 dark:text-dark-text-secondary font-mono truncate block max-w-xs">
                        ••••••••••••••••
                      </code>
                    </div>
                    
                    {/* Timestamp and Actions - Right Aligned */}
                    <div className="flex items-center justify-end space-x-3 flex-shrink-0 ml-auto">
                      <div className="text-xs text-gray-500 dark:text-dark-text-secondary">
                        Updated {getTimeAgo(envVar.updated_at)}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => startEdit(envVar)}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="Edit variable"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteEnvVar(envVar.id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete variable"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default EnvVarsPage