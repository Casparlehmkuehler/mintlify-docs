// Upload Manager Service
// Manages file uploads using Web Workers for background processing

import { v4 as uuidv4 } from 'uuid'

export interface UploadTask {
  id: string
  fileName: string
  fileSize: number
  progress: number
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed'
  error?: string
  startTime: number
  endTime?: number
  uploadSpeed?: number
}

export interface ConflictFile {
  name: string
  size: number
  lastModified?: string
  isFolder?: boolean
}

export interface UploadManagerOptions {
  maxConcurrentUploads?: number
  chunkSize?: number
  autoRetry?: boolean
  onProgress?: (task: UploadTask) => void
  onComplete?: (task: UploadTask) => void
  onError?: (task: UploadTask, error: string) => void
  onConflict?: (conflicts: ConflictFile[]) => Promise<'replace' | 'keep' | 'cancel'>
}

class UploadManager {
  private static instance: UploadManager
  private worker: Worker | null = null
  private tasks: Map<string, UploadTask> = new Map()
  private db: IDBDatabase | null = null
  private options: UploadManagerOptions
  private listeners: Set<(tasks: UploadTask[]) => void> = new Set()
  private accessToken: string | null = null
  private isPageVisible: boolean = true
  private uploadQueue: File[] = []
  private processingQueue: boolean = false

  private constructor(options: UploadManagerOptions = {}) {
    this.options = {
      maxConcurrentUploads: 3,
      chunkSize: 5 * 1024 * 1024, // 5MB
      autoRetry: true,
      ...options
    }
    this.initializeWorker()
    this.initializeDB()
    this.setupEventListeners()
  }

  public static getInstance(options?: UploadManagerOptions): UploadManager {
    if (!UploadManager.instance) {
      UploadManager.instance = new UploadManager(options)
    }
    return UploadManager.instance
  }

  private async initializeWorker() {
    try {
      // Create worker from the worker file
      this.worker = new Worker(
        new URL('../workers/uploadWorker.ts', import.meta.url),
        { type: 'module' }
      )

      this.worker.addEventListener('message', this.handleWorkerMessage.bind(this))
      this.worker.addEventListener('error', this.handleWorkerError.bind(this))

      // Send initial configuration
      if (this.accessToken) {
        this.worker.postMessage({
          type: 'SET_AUTH',
          payload: { accessToken: this.accessToken }
        })
      }
    } catch (error) {
      console.error('Failed to initialize upload worker:', error)
      // Fallback to main thread uploads if worker fails
    }
  }

  private async initializeDB() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('UploadManager', 1)

      request.onerror = () => {
        console.error('Failed to open IndexedDB')
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.loadPendingUploads()
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Store for upload tasks
        if (!db.objectStoreNames.contains('uploads')) {
          const store = db.createObjectStore('uploads', { keyPath: 'id' })
          store.createIndex('status', 'status', { unique: false })
        }

        // Store for file chunks (for resumable uploads)
        if (!db.objectStoreNames.contains('chunks')) {
          const store = db.createObjectStore('chunks', { keyPath: 'id' })
          store.createIndex('taskId', 'taskId', { unique: false })
        }
      }
    })
  }

  private setupEventListeners() {
    // Listen for page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.isPageVisible = !document.hidden
      
      if (this.isPageVisible) {
        // Resume uploads when page becomes visible
        this.resumeAllPausedUploads()
      }
    })

    // Warn user if they try to leave with active uploads
    window.addEventListener('beforeunload', (e) => {
      const activeUploads = Array.from(this.tasks.values()).filter(
        task => task.status === 'uploading' || task.status === 'pending'
      )

      if (activeUploads.length > 0) {
        const message = 'You have uploads in progress. Are you sure you want to leave?'
        e.preventDefault()
        e.returnValue = message
        return message
      }
    })

    // Save state periodically
    setInterval(() => {
      this.saveState()
    }, 5000)
  }

  private handleWorkerMessage(event: MessageEvent) {
    const { type, payload } = event.data

    switch (type) {
      case 'UPLOAD_PROGRESS':
        this.updateTaskProgress(payload)
        break
      case 'UPLOAD_COMPLETE':
        this.handleUploadComplete(payload)
        break
      case 'UPLOAD_ERROR':
        this.handleUploadError(payload)
        break
      case 'SAVE_PROGRESS':
        this.saveChunkProgress(payload)
        break
      case 'STATUS_UPDATE':
        this.handleStatusUpdate(payload)
        break
    }
  }

  private handleWorkerError(error: ErrorEvent) {
    console.error('Worker error:', error)
    // Attempt to restart worker
    this.initializeWorker()
  }

  private updateTaskProgress(payload: any) {
    const task = this.tasks.get(payload.taskId)
    if (task) {
      task.progress = payload.progress
      task.status = payload.status
      
      // Calculate upload speed
      if (task.status === 'uploading' && task.startTime) {
        const elapsedSeconds = (Date.now() - task.startTime) / 1000
        const bytesUploaded = (task.fileSize * task.progress) / 100
        task.uploadSpeed = bytesUploaded / elapsedSeconds
      }

      if (payload.error) {
        task.error = payload.error
      }

      this.notifyListeners()
      
      if (this.options.onProgress) {
        this.options.onProgress(task)
      }
    }
  }

  private handleUploadComplete(payload: any) {
    const task = this.tasks.get(payload.taskId)
    if (task) {
      task.status = 'completed'
      task.progress = 100
      task.endTime = Date.now()
      
      this.notifyListeners()
      
      if (this.options.onComplete) {
        this.options.onComplete(task)
      }

      // Clean up completed task from DB
      this.removeTaskFromDB(task.id)
      
      // Process next file in queue
      this.processUploadQueue()
    }
  }

  private handleUploadError(payload: any) {
    const task = this.tasks.get(payload.taskId)
    if (task) {
      task.status = 'failed'
      task.error = payload.error
      
      this.notifyListeners()
      
      if (this.options.onError) {
        this.options.onError(task, payload.error)
      }

      // Retry if configured
      if (this.options.autoRetry) {
        setTimeout(() => {
          this.retryUpload(task.id)
        }, 5000)
      }
    }
  }

  private handleStatusUpdate(payload: any) {
    // Update all tasks from worker status
    payload.forEach((workerTask: any) => {
      const task = this.tasks.get(workerTask.taskId)
      if (task) {
        task.progress = workerTask.progress
        task.status = workerTask.status
      }
    })
    this.notifyListeners()
  }

  public async uploadFile(
    file: File,
    folderPrefix?: string,
    immediate: boolean = false
  ): Promise<string> {
    const taskId = uuidv4()
    
    const task: UploadTask = {
      id: taskId,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'pending',
      startTime: Date.now()
    }

    this.tasks.set(taskId, task)
    this.saveTaskToDB(task)
    
    if (immediate || this.uploadQueue.length === 0) {
      // Start upload immediately
      this.startUpload(file, taskId, folderPrefix)
    } else {
      // Add to queue
      this.uploadQueue.push(file)
      this.processUploadQueue()
    }

    this.notifyListeners()
    return taskId
  }

  public async uploadFiles(
    files: FileList | File[],
    folderPrefix?: string
  ): Promise<string[]> {
    const fileArray = Array.from(files)
    
    // Check for conflicts first
    const conflicts = await this.checkForConflicts(fileArray, folderPrefix)
    
    if (conflicts.length > 0 && this.options.onConflict) {
      const resolution = await this.options.onConflict(conflicts)
      
      if (resolution === 'cancel') {
        return []
      }
      
      // Process files based on resolution
      return this.processFilesWithResolution(fileArray, resolution, folderPrefix)
    }
    
    // No conflicts, proceed normally
    const taskIds: string[] = []
    for (const file of fileArray) {
      const taskId = await this.uploadFile(file, folderPrefix, false)
      taskIds.push(taskId)
    }

    return taskIds
  }

  public async uploadFilesWithStructure(
    files: FileList,
    basePath?: string
  ): Promise<string[]> {
    const fileArray = Array.from(files)
    
    // Group files by their relative paths for conflict checking
    const filesByPath = new Map<string, File[]>()
    const allConflicts: ConflictFile[] = []
    
    for (const file of fileArray) {
      // Get the file's relative path (webkitRelativePath includes folder structure)
      const relativePath = (file as any).webkitRelativePath || file.name
      const fullPath = basePath ? `${basePath}${relativePath}` : relativePath
      const directoryPath = fullPath.substring(0, fullPath.lastIndexOf('/') + 1)
      
      if (!filesByPath.has(directoryPath)) {
        filesByPath.set(directoryPath, [])
      }
      filesByPath.get(directoryPath)!.push(file)
    }
    
    // Check for conflicts in each directory
    for (const [dirPath, dirFiles] of filesByPath) {
      const conflicts = await this.checkForConflicts(dirFiles, dirPath)
      allConflicts.push(...conflicts)
    }
    
    // Handle conflicts if any
    if (allConflicts.length > 0 && this.options.onConflict) {
      const resolution = await this.options.onConflict(allConflicts)
      
      if (resolution === 'cancel') {
        return []
      }
      
      // Process files with resolution, preserving structure
      return this.processFilesWithStructureAndResolution(fileArray, resolution, basePath)
    }
    
    // No conflicts, upload with structure preserved
    const taskIds: string[] = []
    for (const file of fileArray) {
      const relativePath = (file as any).webkitRelativePath || file.name
      const fullPath = basePath ? `${basePath}${relativePath}` : relativePath
      const directoryPath = fullPath.substring(0, fullPath.lastIndexOf('/') + 1)
      
      const taskId = await this.uploadFile(file, directoryPath, false)
      taskIds.push(taskId)
    }
    
    return taskIds
  }

  private async processFilesWithStructureAndResolution(
    files: File[],
    resolution: 'replace' | 'keep',
    basePath?: string
  ): Promise<string[]> {
    const taskIds: string[] = []
    
    if (resolution === 'replace') {
      // Upload all files normally with their structure
      for (const file of files) {
        const relativePath = (file as any).webkitRelativePath || file.name
        const fullPath = basePath ? `${basePath}${relativePath}` : relativePath
        const directoryPath = fullPath.substring(0, fullPath.lastIndexOf('/') + 1)
        
        const taskId = await this.uploadFile(file, directoryPath, false)
        taskIds.push(taskId)
      }
    } else if (resolution === 'keep') {
      // Handle conflicts by renaming files while preserving structure
      for (const file of files) {
        const relativePath = (file as any).webkitRelativePath || file.name
        const fullPath = basePath ? `${basePath}${relativePath}` : relativePath
        const directoryPath = fullPath.substring(0, fullPath.lastIndexOf('/') + 1)
        
        // Check if this specific file conflicts
        const conflicts = await this.checkForConflicts([file], directoryPath)
        
        if (conflicts.length > 0) {
          const uniqueName = await this.generateUniqueFileName(file.name, directoryPath)
          const renamedFile = new File([file], uniqueName, { type: file.type })
          const taskId = await this.uploadFile(renamedFile, directoryPath, false)
          taskIds.push(taskId)
        } else {
          const taskId = await this.uploadFile(file, directoryPath, false)
          taskIds.push(taskId)
        }
      }
    }
    
    return taskIds
  }

  private async startUpload(file: File, taskId: string, folderPrefix?: string) {
    if (!this.worker) {
      console.error('Worker not initialized')
      return
    }

    if (!this.accessToken) {
      console.error('No access token available')
      const task = this.tasks.get(taskId)
      if (task) {
        task.status = 'failed'
        task.error = 'Authentication required'
      }
      return
    }

    // For large files, we need to handle them differently
    // as we can't pass large File objects to workers directly
    if (file.size > 50 * 1024 * 1024) { // > 50MB
      // For very large files, we'll read and send chunks
      await this.uploadLargeFile(file, taskId, folderPrefix)
    } else {
      // For smaller files, send directly to worker
      this.worker.postMessage({
        type: 'ADD_UPLOAD',
        payload: {
          file,
          taskId,
          folderPrefix,
          accessToken: this.accessToken
        }
      })
    }

    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'uploading'
      this.notifyListeners()
    }
  }

  private async uploadLargeFile(file: File, taskId: string, folderPrefix?: string) {
    // For very large files, we'll handle chunking in the main thread
    // and send chunks to the worker
    const chunkSize = 5 * 1024 * 1024 // 5MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)
      
      // Store chunk in IndexedDB for resumability
      await this.storeChunk(taskId, i, chunk)
    }

    // Send task to worker with chunk references
    if (this.worker) {
      this.worker.postMessage({
        type: 'ADD_LARGE_UPLOAD',
        payload: {
          taskId,
          fileName: file.name,
          fileSize: file.size,
          totalChunks,
          folderPrefix,
          accessToken: this.accessToken
        }
      })
    }
  }

  private async storeChunk(taskId: string, index: number, chunk: Blob) {
    if (!this.db) return

    const transaction = this.db.transaction(['chunks'], 'readwrite')
    const store = transaction.objectStore('chunks')
    
    await store.put({
      id: `${taskId}_${index}`,
      taskId,
      index,
      data: chunk
    })
  }

  private async processUploadQueue() {
    if (this.processingQueue || this.uploadQueue.length === 0) {
      return
    }

    this.processingQueue = true
    
    // Check how many uploads are currently active
    const activeUploads = Array.from(this.tasks.values()).filter(
      task => task.status === 'uploading'
    ).length

    const maxConcurrent = this.options.maxConcurrentUploads || 3
    const availableSlots = maxConcurrent - activeUploads

    for (let i = 0; i < availableSlots && this.uploadQueue.length > 0; i++) {
      const file = this.uploadQueue.shift()
      if (file) {
        // Find the task for this file
        const task = Array.from(this.tasks.values()).find(
          t => t.fileName === file.name && t.status === 'pending'
        )
        if (task) {
          this.startUpload(file, task.id)
        }
      }
    }

    this.processingQueue = false
  }

  public pauseUpload(taskId: string) {
    if (this.worker) {
      this.worker.postMessage({
        type: 'PAUSE_UPLOAD',
        payload: { taskId }
      })
    }

    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'paused'
      this.notifyListeners()
    }
  }

  public resumeUpload(taskId: string) {
    if (this.worker) {
      this.worker.postMessage({
        type: 'RESUME_UPLOAD',
        payload: { taskId }
      })
    }

    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'pending'
      this.notifyListeners()
    }
  }

  public cancelUpload(taskId: string) {
    if (this.worker) {
      this.worker.postMessage({
        type: 'CANCEL_UPLOAD',
        payload: { taskId }
      })
    }

    this.tasks.delete(taskId)
    this.removeTaskFromDB(taskId)
    this.notifyListeners()
  }

  public retryUpload(taskId: string) {
    const task = this.tasks.get(taskId)
    if (task && task.status === 'failed') {
      task.status = 'pending'
      task.error = undefined
      this.resumeUpload(taskId)
    }
  }

  private resumeAllPausedUploads() {
    Array.from(this.tasks.values())
      .filter(task => task.status === 'paused')
      .forEach(task => this.resumeUpload(task.id))
  }

  public setAccessToken(token: string) {
    this.accessToken = token
    
    if (this.worker) {
      this.worker.postMessage({
        type: 'SET_AUTH',
        payload: { accessToken: token }
      })
    }
  }

  public getTasks(): UploadTask[] {
    return Array.from(this.tasks.values())
  }

  public getTask(taskId: string): UploadTask | undefined {
    return this.tasks.get(taskId)
  }

  public subscribe(listener: (tasks: UploadTask[]) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners() {
    const tasks = this.getTasks()
    this.listeners.forEach(listener => listener(tasks))
  }

  private async saveTaskToDB(task: UploadTask) {
    if (!this.db) return

    const transaction = this.db.transaction(['uploads'], 'readwrite')
    const store = transaction.objectStore('uploads')
    await store.put(task)
  }

  private async removeTaskFromDB(taskId: string) {
    if (!this.db) return

    const transaction = this.db.transaction(['uploads', 'chunks'], 'readwrite')
    
    // Remove task
    const uploadStore = transaction.objectStore('uploads')
    await uploadStore.delete(taskId)
    
    // Remove associated chunks
    const chunkStore = transaction.objectStore('chunks')
    const index = chunkStore.index('taskId')
    const request = index.getAllKeys(taskId)
    
    request.onsuccess = () => {
      const chunks = request.result
      chunks.forEach(chunkId => {
        chunkStore.delete(chunkId)
      })
    }
  }

  private async loadPendingUploads() {
    if (!this.db) return

    const transaction = this.db.transaction(['uploads'], 'readonly')
    const store = transaction.objectStore('uploads')
    const request = store.getAll()
    
    request.onsuccess = () => {
      const uploads = request.result
      uploads.forEach((upload: UploadTask) => {
        if (upload.status === 'uploading' || upload.status === 'pending') {
          upload.status = 'paused' // Convert to paused state
          this.tasks.set(upload.id, upload)
        }
      })
      
      this.notifyListeners()
    }
  }

  private async saveChunkProgress(payload: any) {
    if (!this.db) return

    const transaction = this.db.transaction(['uploads'], 'readwrite')
    const store = transaction.objectStore('uploads')
    
    const task = this.tasks.get(payload.taskId)
    if (task) {
      store.put({
        ...task,
        uploadedChunks: payload.uploadedChunks,
        progress: payload.progress
      })
    }
  }

  private async saveState() {
    // Save current state of all active uploads
    const activeTasks = Array.from(this.tasks.values()).filter(
      task => task.status === 'uploading' || task.status === 'pending' || task.status === 'paused'
    )

    for (const task of activeTasks) {
      await this.saveTaskToDB(task)
    }
  }

  public clearCompleted() {
    const completed = Array.from(this.tasks.entries())
      .filter(([_, task]) => task.status === 'completed')
      .map(([id]) => id)

    completed.forEach(id => {
      this.tasks.delete(id)
      this.removeTaskFromDB(id)
    })

    this.notifyListeners()
  }

  public clearAll() {
    // Cancel all active uploads
    Array.from(this.tasks.keys()).forEach(id => {
      this.cancelUpload(id)
    })

    this.tasks.clear()
    this.uploadQueue = []
    this.notifyListeners()
  }

  private async checkForConflicts(files: File[], folderPrefix?: string): Promise<ConflictFile[]> {
    if (!this.accessToken) {
      return []
    }

    try {
      // Get existing files in the target directory
      const prefix = folderPrefix || ''
      const response = await fetch(`https://api.lyceum.technology/api/v2/external/storage/list-files?prefix=${encodeURIComponent(prefix)}&max_files=1000`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      if (!response.ok) {
        console.warn('Failed to check for file conflicts, proceeding with upload')
        return []
      }

      const existingFiles = await response.json()
      const existingFileNames = new Set(
        existingFiles.map((file: any) => {
          const key = file.key as string
          // Remove the prefix to get just the filename
          if (prefix && key.startsWith(prefix)) {
            const relativePath = key.substring(prefix.length)
            return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath
          }
          return key
        }).filter((name: string) => name && !name.includes('/')) // Only direct files, not subdirectories
      )

      const conflicts: ConflictFile[] = []
      
      for (const file of files) {
        if (existingFileNames.has(file.name)) {
          // Find the existing file data
          const existingFile = existingFiles.find((ef: any) => {
            const key = ef.key as string
            const fileName = prefix 
              ? key.substring(prefix.length).replace(/^\//, '')
              : key
            return fileName === file.name
          })

          conflicts.push({
            name: file.name,
            size: file.size,
            lastModified: existingFile?.last_modified,
            isFolder: false
          })
        }
      }

      return conflicts
    } catch (error) {
      console.warn('Error checking for file conflicts:', error)
      return []
    }
  }

  private async processFilesWithResolution(
    files: File[], 
    resolution: 'replace' | 'keep',
    folderPrefix?: string
  ): Promise<string[]> {
    const taskIds: string[] = []
    
    if (resolution === 'replace') {
      // Upload all files normally (they will overwrite existing ones)
      for (const file of files) {
        const taskId = await this.uploadFile(file, folderPrefix, false)
        taskIds.push(taskId)
      }
    } else if (resolution === 'keep') {
      // Rename conflicting files and upload
      const conflicts = await this.checkForConflicts(files, folderPrefix)
      const conflictNames = new Set(conflicts.map(c => c.name))
      
      for (const file of files) {
        if (conflictNames.has(file.name)) {
          // Create a new file with a unique name
          const uniqueName = await this.generateUniqueFileName(file.name, folderPrefix)
          const renamedFile = new File([file], uniqueName, { type: file.type })
          const taskId = await this.uploadFile(renamedFile, folderPrefix, false)
          taskIds.push(taskId)
        } else {
          // No conflict, upload normally
          const taskId = await this.uploadFile(file, folderPrefix, false)
          taskIds.push(taskId)
        }
      }
    }
    
    return taskIds
  }

  private async generateUniqueFileName(originalName: string, folderPrefix?: string): Promise<string> {
    const dotIndex = originalName.lastIndexOf('.')
    const name = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName
    const extension = dotIndex !== -1 ? originalName.substring(dotIndex) : ''
    
    let counter = 1
    let newName = `${name} (${counter})${extension}`
    
    // Keep checking until we find a unique name
    while (await this.fileExists(newName, folderPrefix)) {
      counter++
      newName = `${name} (${counter})${extension}`
    }
    
    return newName
  }

  private async fileExists(fileName: string, folderPrefix?: string): Promise<boolean> {
    if (!this.accessToken) {
      return false
    }

    try {
      const prefix = folderPrefix || ''
      const fullPath = prefix + fileName
      
      const response = await fetch(`https://api.lyceum.technology/api/v2/external/storage/list-files?prefix=${encodeURIComponent(fullPath)}&max_files=1`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      if (!response.ok) {
        return false
      }

      const files = await response.json()
      return files.some((file: any) => file.key === fullPath)
    } catch (error) {
      console.warn('Error checking if file exists:', error)
      return false
    }
  }
}

export default UploadManager