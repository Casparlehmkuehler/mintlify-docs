import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, File, Folder, Download, Trash2, Upload, Search, Filter, ChevronUp, ChevronDown, Loader2, FileText, Image, Archive, Code, Music, Video, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import UploadManager, { ConflictFile } from '../../services/UploadManager'
import UploadProgress from '../UploadProgress'
import FileConflictDialog from '../FileConflictDialog'
import { dataCache, CacheKeys } from '../../services/DataCache'
import { dataPreloader } from '../../services/DataPreloader'
import { usePreloader } from '../../hooks/useCachedData'
import { buildApiUrl } from '../../lib/api'

interface StorageFile {
  key: string
  size: number
  last_modified: string
  etag: string
}

interface StorageItem extends StorageFile {
  isFolder?: boolean
  name: string
  path: string
}

const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="h-4 w-4 text-blue-600" />
    case 'pdf':
    case 'doc':
    case 'docx':
    case 'txt':
    case 'md':
      return <FileText className="h-4 w-4 text-red-600" />
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
      return <Archive className="h-4 w-4 text-yellow-600" />
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'py':
    case 'java':
    case 'cpp':
    case 'c':
    case 'h':
    case 'css':
    case 'html':
    case 'json':
    case 'xml':
      return <Code className="h-4 w-4 text-green-600" />
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'flac':
      return <Music className="h-4 w-4 text-purple-600" />
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'wmv':
    case 'webm':
      return <Video className="h-4 w-4 text-pink-600" />
    default:
      if (fileName.includes('/') && fileName.endsWith('/')) {
        return <Folder className="h-4 w-4 text-blue-500" />
      }
      return <File className="h-4 w-4 text-gray-600" />
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      if (diffMinutes === 0) {
        return 'Just now'
      }
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} month${months !== 1 ? 's' : ''} ago`
  } else {
    const years = Math.floor(diffDays / 365)
    return `${years} year${years !== 1 ? 's' : ''} ago`
  }
}

const processFilesIntoItems = (files: StorageFile[], currentPath: string): StorageItem[] => {
  const items: StorageItem[] = []
  const folderStats = new Map<string, { size: number, lastModified: string }>()
  
  files.forEach(file => {
    // Remove the current path prefix from the file key
    let relativePath = file.key
    if (currentPath && file.key.startsWith(currentPath)) {
      relativePath = file.key.substring(currentPath.length)
    }
    
    // Remove leading slash if present
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.substring(1)
    }
    
    // Skip if empty path
    if (!relativePath) return
    
    const pathParts = relativePath.split('/')
    
    if (pathParts.length === 1) {
      // This is a file in the current directory
      // Skip .keep files from display but use them for folder detection
      if (pathParts[0] === '.keep') return
      
      items.push({
        ...file,
        isFolder: false,
        name: pathParts[0],
        path: file.key
      })
    } else {
      // This file is in a subdirectory, accumulate folder stats
      const folderName = pathParts[0]
      
      if (!folderStats.has(folderName)) {
        folderStats.set(folderName, { 
          size: 0, 
          lastModified: file.last_modified 
        })
      }
      
      const stats = folderStats.get(folderName)!
      // Don't count .keep files in folder size
      if (!file.key.endsWith('.keep')) {
        stats.size += file.size
      }
      
      // Update last modified to the most recent file
      if (new Date(file.last_modified) > new Date(stats.lastModified)) {
        stats.lastModified = file.last_modified
      }
    }
  })
  
  // Create folder items with calculated stats
  folderStats.forEach((stats, folderName) => {
    const folderPath = currentPath ? `${currentPath}${folderName}/` : `${folderName}/`
    items.push({
      key: folderPath,
      size: stats.size,
      last_modified: stats.lastModified,
      etag: '',
      isFolder: true,
      name: folderName,
      path: folderPath
    })
  })
  
  // Sort items: folders first, then files
  return items.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1
    if (!a.isFolder && b.isFolder) return 1
    return a.name.localeCompare(b.name)
  })
}

const StoragePage: React.FC = () => {
  const { user } = useAuth()
  const uploadManagerRef = useRef<UploadManager | null>(null)
  const [selectedFile, setSelectedFile] = useState<StorageItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)
  const [searchResults, setSearchResults] = useState<StorageItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25
  const [filters, setFilters] = useState({
    fileType: [] as string[],
    dateRange: '' as string,
    sizeRange: '' as string
  })
  const [sortConfig, setSortConfig] = useState<{
    key: string | null
    direction: 'asc' | 'desc'
  }>({
    key: null,
    direction: 'asc'
  })
  const detailsPanelRef = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<StorageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [currentPath, setCurrentPath] = useState('')
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState<{
    isDeleting: boolean
    current: number
    total: number
    currentFile: string
    type: 'single' | 'bulk'
  } | null>(null)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [pendingConflicts, setPendingConflicts] = useState<ConflictFile[]>([])
  const [conflictResolver, setConflictResolver] = useState<((resolution: 'replace' | 'keep' | 'cancel') => void) | null>(null)
  const { invalidateCache } = usePreloader()

  // Initialize upload manager
  useEffect(() => {
    if (!uploadManagerRef.current) {
      uploadManagerRef.current = UploadManager.getInstance({
        onComplete: () => {
          // Check if all uploads are completed
          const allTasks = uploadManagerRef.current?.getTasks() || []
          const activeTasks = allTasks.filter(t => 
            t.status === 'uploading' || t.status === 'pending' || t.status === 'paused'
          )
          
          // If this was the last active task, invalidate cache and refresh
          if (activeTasks.length === 0) {
            setTimeout(() => {
              invalidateCache('storage')
              fetchFiles(true) // Force refresh
            }, 1000) // Small delay to ensure all processing is complete
          }
        },
        onError: (task, error) => {
          setError(`Upload failed for ${task.fileName}: ${error}`)
        },
        onConflict: (conflicts) => {
          // Handle file conflicts
          return new Promise((resolve) => {
            setPendingConflicts(conflicts)
            setConflictDialogOpen(true)
            setConflictResolver(() => (resolution: 'replace' | 'keep' | 'cancel') => {
              setConflictDialogOpen(false)
              setPendingConflicts([])
              setConflictResolver(null)
              resolve(resolution)
            })
          })
        }
      })
    }

    // Update access token when available
    const updateToken = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token && uploadManagerRef.current) {
        uploadManagerRef.current.setAccessToken(session.access_token)
      }
    }
    updateToken()
  }, [])

  // Fetch files from API when user is available
  useEffect(() => {
    if (user) {
      // Trigger preloading for the current path
      dataPreloader.preloadStorageData(currentPath)
      fetchFiles()
    }
  }, [user, currentPath])

  const fetchFiles = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true)
      setError(null)
      
      const cacheKey = CacheKeys.storageFiles(currentPath)
      
      // Try cache first (if not forcing refresh)
      if (!forceRefresh) {
        const cached = dataCache.get(cacheKey)
        if (cached && Array.isArray(cached)) {
          const processedItems = processFilesIntoItems(cached, currentPath)
          setItems(processedItems)
          setLoading(false)
          return
        }
      }
      
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        setError('Please log in to view storage files')
        return
      }

      const response = await fetch(buildApiUrl(`/api/v2/external/storage/list-files?prefix=${encodeURIComponent(currentPath)}&max_files=1000`), {
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch storage files')
      }

      const data = await response.json()
      
      // Cache the response
      dataCache.set(cacheKey, data, 1 * 60 * 1000) // 1 minute TTL for storage data
      
      const processedItems = processFilesIntoItems(data || [], currentPath)
      setItems(processedItems)
    } catch (err: any) {
      console.error('Error fetching files:', err)
      setError(err.message || 'Failed to load files. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const performGlobalSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    
    try {
      setIsSearching(true)
      setError(null)
      
      console.log('Performing global search for:', query)
      
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        setError('Please log in to search files')
        return
      }

      // Fetch ALL files (no prefix) to search globally
      const response = await fetch(buildApiUrl(`/api/v2/external/storage/list-files?max_files=5000`), {
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to search files')
      }

      const data = await response.json()
      console.log('Fetched all files for search:', data.length, 'files')
      
      // Convert all raw files directly to searchable items without folder processing
      const allItems: StorageItem[] = data.map((file: StorageFile) => ({
        ...file,
        isFolder: file.key.endsWith('/'),
        name: file.key.split('/').pop() || file.key,
        path: file.key
      }))
      console.log('Converted to searchable items:', allItems.length, 'items')
      
      // Filter by search query (search both name and path)
      const results = allItems.filter(item => 
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.path.toLowerCase().includes(query.toLowerCase())
      )
      
      console.log('Search results:', results.length, 'matches for query:', query)
      setSearchResults(results)
    } catch (err: any) {
      console.error('Error searching files:', err)
      setError(err.message || 'Failed to search files. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const deleteFile = async (fileKey: string) => {
    console.log('deleteFile called with:', fileKey)
    if (!fileKey) {
      console.error('deleteFile called with empty fileKey')
      return
    }
    
    try {
      setDeletingFiles(prev => new Set([...prev, fileKey]))
      setShowDeleteConfirm(null) // Close modal immediately
      setDeleteProgress({
        isDeleting: true,
        current: 0,
        total: 1,
        currentFile: fileKey.split('/').pop() || fileKey,
        type: 'single'
      })
      
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        console.error('No current session')
        throw new Error('Please log in to delete files')
      }

      // Check if this is a folder
      const item = items.find(i => i.key === fileKey)
      const isFolder = item?.isFolder || fileKey.endsWith('/')
      
      const deleteUrl = isFolder 
        ? buildApiUrl(`/api/v2/external/storage/delete-folder/${encodeURIComponent(fileKey)}`)
        : buildApiUrl(`/api/v2/external/storage/delete/${encodeURIComponent(fileKey)}`)
      
      console.log(isFolder ? 'Deleting folder:' : 'Deleting file:', { fileKey, deleteUrl, token: currentSession.access_token?.substring(0, 20) + '...' })

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('Delete response:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Delete failed:', errorText)
        throw new Error(`Failed to delete file: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      console.log('Delete successful:', result)

      // Update progress to completion
      setDeleteProgress(prev => prev ? { ...prev, current: 1 } : null)

      // Remove file from local state
      setItems(prevItems => prevItems.filter(item => item.key !== fileKey))
      setSelectedRows(prev => {
        const newSelected = new Set(prev)
        newSelected.delete(fileKey)
        return newSelected
      })
      
      // Close details panel if this file was selected
      if (selectedFile?.key === fileKey) {
        setSelectedFile(null)
      }

      // Show completion briefly, then hide and refresh
      setTimeout(async () => {
        setDeleteProgress(null)
        // Invalidate cache and refresh file list after deletion is complete
        invalidateCache('storage')
        await fetchFiles(true) // Force refresh
      }, 1000)

    } catch (err: any) {
      console.error('Error deleting file:', err)
      setError(err.message || 'Failed to delete file. Please try again.')
    } finally {
      setDeletingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileKey)
        return newSet
      })
      // Clear progress on error
      if (deleteProgress?.type === 'single') {
        setTimeout(() => setDeleteProgress(null), 500)
      }
    }
  }

  const bulkDeleteFiles = async () => {
    const filesToDelete = Array.from(selectedRows)
    if (filesToDelete.length === 0) return

    try {
      // Add all selected files to deleting state
      setDeletingFiles(prev => new Set([...prev, ...filesToDelete]))
      setShowBulkDeleteConfirm(false) // Close modal immediately
      
      // Set up bulk delete progress
      setDeleteProgress({
        isDeleting: true,
        current: 0,
        total: filesToDelete.length,
        currentFile: 'Initializing...',
        type: 'bulk'
      })
      
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw new Error('Please log in to delete files')
      }

      // Delete files sequentially to show progress
      const successfulDeletes: string[] = []
      const failedDeletes: string[] = []

      for (let i = 0; i < filesToDelete.length; i++) {
        const fileKey = filesToDelete[i]
        const fileName = fileKey.split('/').pop() || fileKey
        
        // Update progress
        setDeleteProgress(prev => prev ? {
          ...prev,
          current: i,
          currentFile: fileName
        } : null)

        try {
          // Check if this is a folder
          const item = items.find(i => i.key === fileKey)
          const isFolder = item?.isFolder || fileKey.endsWith('/')
          
          const deleteUrl = isFolder 
            ? buildApiUrl(`/api/v2/external/storage/delete-folder/${encodeURIComponent(fileKey)}`)
            : buildApiUrl(`/api/v2/external/storage/delete/${encodeURIComponent(fileKey)}`)
          
          const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${currentSession.access_token}`,
              'Content-Type': 'application/json'
            }
          })

          if (!response.ok) {
            throw new Error(`Failed to delete ${fileKey}`)
          }
          
          successfulDeletes.push(fileKey)
        } catch (error) {
          failedDeletes.push(fileKey)
          console.error(`Failed to delete ${fileKey}:`, error)
        }
      }

      // Update progress to completion
      setDeleteProgress(prev => prev ? {
        ...prev,
        current: filesToDelete.length,
        currentFile: 'Completed'
      } : null)

      // Remove successfully deleted files from local state
      if (successfulDeletes.length > 0) {
        setItems(prevItems => 
          prevItems.filter(item => !successfulDeletes.includes(item.key))
        )
        setSelectedRows(new Set())
      }

      // Show success/error message
      if (failedDeletes.length > 0) {
        setError(`Failed to delete ${failedDeletes.length} files. ${successfulDeletes.length} files deleted successfully.`)
      }

      // Close details panel if selected file was deleted
      if (selectedFile && successfulDeletes.includes(selectedFile.key)) {
        setSelectedFile(null)
      }

      // Hide progress after a brief delay and refresh
      setTimeout(async () => {
        setDeleteProgress(null)
        // Invalidate cache and refresh file list after bulk deletion is complete
        invalidateCache('storage')
        await fetchFiles(true) // Force refresh
      }, 1500)

    } catch (err: any) {
      console.error('Error in bulk delete:', err)
      setError(err.message || 'Failed to delete files. Please try again.')
    } finally {
      // Clear deleting state for all files
      setDeletingFiles(prev => {
        const newSet = new Set(prev)
        Array.from(selectedRows).forEach(key => newSet.delete(key))
        return newSet
      })
      // Clear progress on error
      if (deleteProgress?.type === 'bulk') {
        setTimeout(() => setDeleteProgress(null), 500)
      }
    }
  }

  const downloadFile = async (fileKey: string) => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw new Error('Please log in to download files')
      }

      // Check if this is a folder
      const item = items.find(i => i.key === fileKey)
      const isFolder = item?.isFolder || fileKey.endsWith('/')
      
      if (isFolder) {
        // For folders, download all files individually
        const folderPrefix = fileKey.endsWith('/') ? fileKey : fileKey + '/'
        const response = await fetch(buildApiUrl(`/api/v2/external/storage/list-files?prefix=${encodeURIComponent(folderPrefix)}&max_files=1000`), {
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`
          }
        })
        
        if (!response.ok) {
          throw new Error('Failed to list folder contents')
        }
        
        const folderFiles = await response.json()
        
        if (folderFiles.length === 0) {
          throw new Error('Folder is empty')
        }
        
        // Download each file with a slight delay to avoid overwhelming the browser
        console.log(`Downloading ${folderFiles.length} files from folder...`)
        for (let i = 0; i < folderFiles.length; i++) {
          const file = folderFiles[i]
          const fileResponse = await fetch(buildApiUrl(`/api/v2/external/storage/download/${encodeURIComponent(file.key)}`), {
            headers: {
              'Authorization': `Bearer ${currentSession.access_token}`
            }
          })
          
          if (fileResponse.ok) {
            const blob = await fileResponse.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = file.key.split('/').pop() || file.key
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            
            // Small delay between downloads
            if (i < folderFiles.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
        }
        
        console.log(`Downloaded ${folderFiles.length} files from folder`)
      } else {
        // Single file download
        const response = await fetch(buildApiUrl(`/api/v2/external/storage/download/${encodeURIComponent(fileKey)}`), {
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to download file')
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileKey.split('/').pop() || fileKey
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err: any) {
      console.error('Error downloading:', err)
      setError(err.message || 'Failed to download. Please try again.')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      await processFiles(files)
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      await processFiles(files, true)
    }
    
    if (folderInputRef.current) {
      folderInputRef.current.value = ''
    }
  }

  const handleDroppedFiles = async (files: FileList) => {
    await processFiles(files)
  }

  const processFiles = async (files: FileList, isFolder: boolean = false) => {
    if (!files || files.length === 0) return

    if (!uploadManagerRef.current) {
      setError('Upload manager not initialized')
      return
    }

    try {
      if (isFolder) {
        // For folder uploads, preserve the folder structure
        await uploadManagerRef.current.uploadFilesWithStructure(files, currentPath)
      } else {
        // Use the current path as folder prefix for regular file uploads
        const folderPrefix = currentPath || undefined
        await uploadManagerRef.current.uploadFiles(files, folderPrefix)
      }
      
    } catch (err: any) {
      console.error('Error initiating uploads:', err)
      setError(err.message || 'Failed to start uploads. Please try again.')
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, fileKey: string) => {
    console.log('handleDeleteClick called with:', fileKey)
    e.stopPropagation()
    setShowDeleteConfirm(fileKey)
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(null)
  }

  const closeDetails = () => {
    setSelectedFile(null)
  }

  const navigateToFolder = (folderPath: string) => {
    setCurrentPath(folderPath)
    setSelectedRows(new Set())
    setCurrentPage(1)
  }

  const navigateUp = () => {
    if (currentPath) {
      const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/', currentPath.length - 2) + 1)
      setCurrentPath(parentPath)
      setSelectedRows(new Set())
      setCurrentPage(1)
    }
  }

  const getBreadcrumbs = () => {
    if (!currentPath) return []
    const parts = currentPath.split('/').filter(part => part)
    const breadcrumbs = []
    let path = ''
    for (const part of parts) {
      path += part + '/'
      breadcrumbs.push({ name: part, path })
    }
    return breadcrumbs
  }


  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsPanelRef.current && !detailsPanelRef.current.contains(event.target as Node)) {
        closeDetails()
      }
    }

    if (selectedFile) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [selectedFile])

  // Use search results if searching, otherwise use current folder items
  const itemsToFilter = searchQuery.trim() ? searchResults : items
  console.log('Search query:', searchQuery)
  console.log('Using searchResults?', !!searchQuery.trim())
  console.log('Items to filter:', itemsToFilter.length)
  console.log('Search results length:', searchResults.length)
  console.log('Current items length:', items.length)

  // Filter items based on search query and filters
  const filteredItems = itemsToFilter.filter(item => {
    // For search results, we don't need to apply text search filter again
    const matchesSearch = searchQuery.trim() ? true : item.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    // File type filter
    let matchesFileType = true
    if (filters.fileType.length > 0) {
      const extension = item.name.split('.').pop()?.toLowerCase() || ''
      matchesFileType = filters.fileType.some(type => {
        switch (type) {
          case 'image': return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)
          case 'document': return ['pdf', 'doc', 'docx', 'txt', 'md'].includes(extension)
          case 'code': return ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json', 'xml'].includes(extension)
          case 'archive': return ['zip', 'tar', 'gz', 'rar'].includes(extension)
          case 'media': return ['mp3', 'wav', 'ogg', 'flac', 'mp4', 'avi', 'mov', 'wmv', 'webm'].includes(extension)
          default: return false
        }
      })
    }
    
    // Date range filter
    let matchesDateRange = true
    if (filters.dateRange) {
      const fileDate = new Date(item.last_modified)
      const now = new Date()
      const dayMs = 24 * 60 * 60 * 1000
      
      switch (filters.dateRange) {
        case '24h':
          matchesDateRange = now.getTime() - fileDate.getTime() < dayMs
          break
        case '7d':
          matchesDateRange = now.getTime() - fileDate.getTime() < 7 * dayMs
          break
        case '30d':
          matchesDateRange = now.getTime() - fileDate.getTime() < 30 * dayMs
          break
        default:
          matchesDateRange = true
      }
    }
    
    // Size range filter
    let matchesSizeRange = true
    if (filters.sizeRange) {
      const sizeInMB = item.size / (1024 * 1024)
      switch (filters.sizeRange) {
        case 'small':
          matchesSizeRange = sizeInMB < 1
          break
        case 'medium':
          matchesSizeRange = sizeInMB >= 1 && sizeInMB < 10
          break
        case 'large':
          matchesSizeRange = sizeInMB >= 10 && sizeInMB < 100
          break
        case 'xlarge':
          matchesSizeRange = sizeInMB >= 100
          break
        default:
          matchesSizeRange = true
      }
    }
    
    return matchesSearch && matchesFileType && matchesDateRange && matchesSizeRange
  })

  // Sorting logic
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedItems = [...filteredItems].sort((a, b) => {
    // Folders always come first
    if (a.isFolder && !b.isFolder) return -1
    if (!a.isFolder && b.isFolder) return 1
    
    if (!sortConfig.key) return 0

    let aValue: any = a[sortConfig.key as keyof StorageItem]
    let bValue: any = b[sortConfig.key as keyof StorageItem]

    // Handle different data types
    switch (sortConfig.key) {
      case 'last_modified':
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
        break
      case 'size':
        aValue = Number(aValue)
        bValue = Number(bValue)
        break
      case 'name':
      default:
        aValue = String(aValue).toLowerCase()
        bValue = String(bValue).toLowerCase()
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  // Pagination logic
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = sortedItems.slice(startIndex, endIndex)

  // Reset page when search changes or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filters])

  // Debounced global search
  useEffect(() => {
    console.log('Search effect triggered with query:', searchQuery)
    
    if (!searchQuery.trim()) {
      console.log('Empty query, clearing results')
      setSearchResults([])
      setIsSearching(false)
      return
    }

    console.log('Setting up search timer for:', searchQuery)
    const timer = setTimeout(() => {
      console.log('Timer triggered, calling performGlobalSearch')
      performGlobalSearch(searchQuery)
    }, 300)

    return () => {
      console.log('Cleaning up timer')
      clearTimeout(timer)
    }
  }, [searchQuery])

  // Handle row selection
  const toggleRowSelection = (fileKey: string) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(fileKey)) {
      newSelected.delete(fileKey)
    } else {
      newSelected.add(fileKey)
    }
    setSelectedRows(newSelected)
  }

  const toggleAllRows = () => {
    const currentPageIds = paginatedItems.map(item => item.key)
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
    className = "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
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
    <div 
      className="space-y-6 px-6 min-h-screen"
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current++
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          setIsDragging(true)
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current--
        if (dragCounter.current === 0) {
          setIsDragging(false)
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        dragCounter.current = 0
        
        const files = e.dataTransfer.files
        if (files && files.length > 0) {
          handleDroppedFiles(files)
        }
      }}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-blue-500 bg-opacity-20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-dark-card rounded-lg p-8 shadow-xl border-2 border-dashed border-blue-500">
            <Upload className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-900 dark:text-dark-text">Drop files here to upload</p>
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-2">Files will be uploaded to {currentPath || 'root'}</p>
          </div>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Storage</h1>
        <div className="mt-1 flex items-center space-x-2">
          <p className="text-sm text-gray-500 dark:text-dark-text-secondary">Manage your files and data storage.</p>
          {searchQuery.trim() && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {isSearching ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Searching...
                </>
              ) : (
                `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${searchQuery}"`
              )}
            </span>
          )}
        </div>
      </div>
        
      {/* Breadcrumb Navigation */}
      {currentPath && (
        <div className="flex items-center text-sm text-gray-500 dark:text-dark-text-secondary">
            <button
              onClick={() => setCurrentPath('')}
              className="hover:text-gray-700 dark:hover:text-dark-text transition-colors"
            >
              Home
            </button>
            {getBreadcrumbs().map((breadcrumb, index) => (
              <div key={index} className="flex items-center">
                <span className="mx-2">/</span>
                <button
                  onClick={() => navigateToFolder(breadcrumb.path)}
                  className="hover:text-gray-700 dark:hover:text-dark-text transition-colors"
                >
                  {breadcrumb.name}
                </button>
              </div>
            ))}
            {currentPath && (
              <button
                onClick={navigateUp}
                className="ml-3 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
              >
                ← Back
              </button>
            )}
          </div>
        )}


      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
              showFilters 
                ? 'border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900' 
                : 'border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text-secondary bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20'
            }`}
          >
            <Filter className="h-4 w-4 mr-2" />
            More filters
          </button>
          {selectedRows.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-600 rounded-md text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900 hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ({selectedRows.size})
            </button>
          )}
          <div className="flex items-center space-x-2">
            <div 
              className="relative"
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const files = e.dataTransfer.files
                if (files && files.length > 0) {
                  handleDroppedFiles(files)
                }
              }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e)}
                className="hidden"
              />
            </div>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center px-3 py-2 border border-blue-600 rounded-md text-sm font-medium text-blue-600 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900"
            >
              <Folder className="h-4 w-4 mr-2" />
              Upload Folder
            </button>
            <input
              ref={folderInputRef}
              type="file"
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              onChange={(e) => handleFolderUpload(e)}
              className="hidden"
            />
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 dark:border-dark-border rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-3">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">File Type</label>
              <div className="space-y-2">
                {['image', 'document', 'code', 'archive', 'media'].map(type => (
                  <label key={type} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.fileType.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters({...filters, fileType: [...filters.fileType, type]})
                        } else {
                          setFilters({...filters, fileType: filters.fileType.filter(t => t !== type)})
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-dark-text-secondary capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">Date Modified</label>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">File Size</label>
              <select
                value={filters.sizeRange}
                onChange={(e) => setFilters({...filters, sizeRange: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All sizes</option>
                <option value="small">Small (&lt; 1 MB)</option>
                <option value="medium">Medium (1-10 MB)</option>
                <option value="large">Large (10-100 MB)</option>
                <option value="xlarge">Very Large (&gt; 100 MB)</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => setFilters({fileType: [], dateRange: '', sizeRange: ''})}
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
            <span className="ml-3 text-gray-600 dark:text-dark-text-secondary">Loading files...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-8">
          <div className="flex items-center justify-center text-red-600 dark:text-red-400">
            <X className="h-8 w-8 mr-3" />
            <div>
              <h3 className="font-medium">Error Loading Files</h3>
              <p className="text-sm text-gray-600 dark:text-dark-text-secondary mt-1">{error}</p>
              <button 
                onClick={() => fetchFiles(true)}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && items.length === 0 && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-8">
          <div className="flex items-center justify-center text-gray-500 dark:text-dark-text-secondary">
            <Folder className="h-8 w-8 mr-3" />
            <div className="text-center">
              <h3 className="font-medium">No files found</h3>
              <p className="text-sm mt-1">{currentPath ? 'This folder is empty.' : 'Upload files to see them here.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && items.length > 0 && (
        <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-dark-border">
                  <th className="px-4 py-3 text-left">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300" 
                      checked={paginatedItems.length > 0 && paginatedItems.every(item => selectedRows.has(item.key))}
                      onChange={toggleAllRows}
                    />
                  </th>
                  <SortableHeader label="Name" sortKey="name" />
                  <SortableHeader label="Size" sortKey="size" />
                  <SortableHeader label="Modified" sortKey="last_modified" />
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr 
                    key={item.key}
                    className="border-b border-gray-50 dark:border-dark-border hover:bg-gray-25 dark:hover:bg-dark-accent/20 cursor-pointer transition-colors"
                    onClick={() => {
                      if (item.isFolder) {
                        navigateToFolder(item.key)
                      } else {
                        setSelectedFile(item)
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300" 
                        checked={selectedRows.has(item.key)}
                        onChange={() => toggleRowSelection(item.key)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center min-w-0">
                        {item.isFolder ? <Folder className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mr-3" /> : <div className="mr-3">{getFileIcon(item.name)}</div>}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-dark-text truncate max-w-xs" title={item.name}>{item.name}</div>
                          {searchQuery.trim() && item.path !== item.name && (
                            <div className="text-xs text-gray-500 dark:text-dark-text-secondary truncate max-w-xs" title={item.path}>
                              {item.path}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-dark-text-secondary">
                      {formatFileSize(item.size)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-dark-text-secondary">
                      {formatDate(item.last_modified)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              downloadFile(item.key)
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 p-1 rounded"
                            title="Download file"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              console.log('Delete button clicked for:', item.key)
                              console.log('deletingFiles has this key:', deletingFiles.has(item.key))
                              console.log('deletingFiles contents:', Array.from(deletingFiles))
                              handleDeleteClick(e, item.key)
                            }}
                            disabled={deletingFiles.has(item.key)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded"
                            title="Delete file"
                          >
                            {deletingFiles.has(item.key) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && items.length > 0 && (
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
                Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, sortedItems.length)}</span> of{' '}
                <span className="font-medium">{sortedItems.length}</span> results
                {(searchQuery || filters.fileType.length > 0 || filters.dateRange || filters.sizeRange) && (
                  <span className="text-gray-500 dark:text-dark-text-secondary"> (filtered from {items.length} total)</span>
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
      {selectedFile && createPortal(
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
            <div className="flex items-center justify-between p-6 pt-12 border-b border-gray-200 dark:border-dark-border">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text">
                  {selectedFile.key.split('/').pop() || selectedFile.key}
                </h2>
                <p className="text-sm text-gray-500 dark:text-dark-text-secondary">File Details</p>
              </div>
              <button
                onClick={closeDetails}
                className="p-2 rounded-md text-gray-400 dark:text-dark-text-secondary hover:text-gray-600 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-accent/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* File Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2">File Information</h3>
                <div className="bg-gray-50 dark:bg-dark-card rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-dark-text-secondary">Name:</span>
                    <span className="text-gray-900 dark:text-dark-text font-mono text-xs break-all">{selectedFile.key.split('/').pop()}</span>
                  </div>
                  {selectedFile.key.includes('/') && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-dark-text-secondary">Path:</span>
                      <span className="text-gray-900 dark:text-dark-text font-mono text-xs break-all">{selectedFile.key.substring(0, selectedFile.key.lastIndexOf('/'))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-dark-text-secondary">Size:</span>
                    <span className="text-gray-900 dark:text-dark-text">{formatFileSize(selectedFile.size)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-dark-text-secondary">Modified:</span>
                    <span className="text-gray-900 dark:text-dark-text">{new Date(selectedFile.last_modified).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-dark-text-secondary">ETag:</span>
                    <span className="text-gray-900 dark:text-dark-text font-mono text-xs">{selectedFile.etag}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2">Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => downloadFile(selectedFile.key)}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-dark-border rounded-md text-sm font-medium text-gray-700 dark:text-dark-text-secondary bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-accent/20"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(selectedFile.key)
                    }}
                    className="w-full flex items-center justify-center px-4 py-2 border border-red-300 dark:border-red-600 rounded-md text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-dark-card hover:bg-red-50 dark:hover:bg-red-900"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>,
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
              className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-[10003]"
            >
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete {items.find(i => i.key === showDeleteConfirm)?.isFolder ? 'Folder' : 'File'}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete this {items.find(i => i.key === showDeleteConfirm)?.isFolder ? 'folder and all its contents' : 'file'}? This action cannot be undone.
                      </p>
                      <div className="mt-2 text-sm text-gray-900">
                        <strong>{items.find(i => i.key === showDeleteConfirm)?.isFolder ? 'Folder' : 'File'}:</strong> {showDeleteConfirm}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    console.log('Delete dialog button clicked, showDeleteConfirm:', showDeleteConfirm)
                    console.log('About to call deleteFile with:', showDeleteConfirm)
                    if (showDeleteConfirm) {
                      deleteFile(showDeleteConfirm)
                    } else {
                      console.error('showDeleteConfirm is null or undefined!')
                    }
                  }}
                  disabled={showDeleteConfirm ? deletingFiles.has(showDeleteConfirm) : true}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {showDeleteConfirm && deletingFiles.has(showDeleteConfirm) ? (
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
                  disabled={deletingFiles.has(showDeleteConfirm)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-[10002] overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowBulkDeleteConfirm(false)}></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-[10003]"
            >
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete Selected Items
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete {selectedRows.size} selected item{selectedRows.size === 1 ? '' : 's'}? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={bulkDeleteFiles}
                  disabled={selectedRows.size === 0}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Delete All
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        </div>,
        document.body
      )}

      {/* Upload Progress Component */}
      {uploadManagerRef.current && (
        <UploadProgress uploadManager={uploadManagerRef.current} />
      )}

      {/* Delete Progress Bar */}
      {deleteProgress && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 left-4 bg-white dark:bg-dark-card rounded-lg shadow-lg p-4 z-[10000] min-w-[300px] border border-gray-200 dark:border-dark-border"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
              {deleteProgress.type === 'single' ? 'Deleting' : `Deleting ${deleteProgress.current}/${deleteProgress.total}`}
            </span>
            {deleteProgress.currentFile === 'Completed' ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-red-500" />
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2 truncate" title={deleteProgress.currentFile}>
            {deleteProgress.currentFile}
          </div>
          {deleteProgress.type === 'bulk' && (
            <div className="w-full bg-gray-200 dark:bg-dark-accent/20 rounded-full h-2">
              <motion.div
                className="bg-red-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ 
                  width: `${(deleteProgress.current / deleteProgress.total) * 100}%`,
                  backgroundColor: deleteProgress.currentFile === 'Completed' ? '#10b981' : '#ef4444'
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* File Conflict Dialog */}
      <FileConflictDialog
        isOpen={conflictDialogOpen}
        conflictingFiles={pendingConflicts}
        onResolve={(resolution) => {
          if (conflictResolver) {
            conflictResolver(resolution)
          }
        }}
      />
    </div>
  )
}

export default StoragePage