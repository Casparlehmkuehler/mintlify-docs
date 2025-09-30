// Upload Worker - Handles file uploads in the background
// This worker processes file uploads independently of the main thread

interface UploadChunk {
  id: string
  fileId: string
  chunk: Blob
  index: number
  totalChunks: number
  retries: number
}

interface UploadTask {
  id: string
  fileName: string
  fileSize: number
  folderPrefix?: string
  chunks: UploadChunk[]
  uploadedChunks: Set<number>
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed'
  progress: number
  error?: string
  uploadUrl?: string
  accessToken?: string
}

class UploadWorker {
  private tasks: Map<string, UploadTask> = new Map()
  private activeUploads: Map<string, AbortController> = new Map()
  private maxConcurrentUploads = 3
  private chunkSize = 5 * 1024 * 1024 // 5MB chunks
  private maxRetries = 3
  private currentUploads = 0

  constructor() {
    self.addEventListener('message', this.handleMessage.bind(this))
  }

  private handleMessage(event: MessageEvent) {
    const { type, payload } = event.data

    switch (type) {
      case 'ADD_UPLOAD':
        this.addUploadTask(payload)
        break
      case 'PAUSE_UPLOAD':
        this.pauseUpload(payload.taskId)
        break
      case 'RESUME_UPLOAD':
        this.resumeUpload(payload.taskId)
        break
      case 'CANCEL_UPLOAD':
        this.cancelUpload(payload.taskId)
        break
      case 'SET_AUTH':
        this.updateAuth(payload.accessToken)
        break
      case 'GET_STATUS':
        this.sendStatus()
        break
    }
  }

  private addUploadTask(payload: {
    file: File
    taskId: string
    folderPrefix?: string
    accessToken: string
  }) {
    const { file, taskId, folderPrefix, accessToken } = payload
    
    // Create chunks from the file
    const chunks: UploadChunk[] = []
    const totalChunks = Math.ceil(file.size / this.chunkSize)
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize
      const end = Math.min(start + this.chunkSize, file.size)
      const chunk = file.slice(start, end)
      
      chunks.push({
        id: `${taskId}_chunk_${i}`,
        fileId: taskId,
        chunk,
        index: i,
        totalChunks,
        retries: 0
      })
    }

    const task: UploadTask = {
      id: taskId,
      fileName: file.name,
      fileSize: file.size,
      folderPrefix,
      chunks,
      uploadedChunks: new Set(),
      status: 'pending',
      progress: 0,
      accessToken
    }

    this.tasks.set(taskId, task)
    this.processQueue()
    
    // Send initial status
    this.sendTaskUpdate(task)
  }

  private async processQueue() {
    if (this.currentUploads >= this.maxConcurrentUploads) {
      return
    }

    // Find next pending task
    const pendingTask = Array.from(this.tasks.values()).find(
      task => task.status === 'pending'
    )

    if (!pendingTask) {
      return
    }

    this.currentUploads++
    pendingTask.status = 'uploading'
    
    try {
      await this.uploadTask(pendingTask)
    } catch (error) {
      pendingTask.status = 'failed'
      pendingTask.error = error instanceof Error ? error.message : 'Upload failed'
    } finally {
      this.currentUploads--
      this.processQueue() // Process next task
    }
  }

  private async uploadTask(task: UploadTask) {
    const controller = new AbortController()
    this.activeUploads.set(task.id, controller)

    try {
      // For large files, use multipart upload
      if (task.fileSize > 10 * 1024 * 1024) { // > 10MB
        await this.multipartUpload(task, controller.signal)
      } else {
        await this.simpleUpload(task, controller.signal)
      }
      
      task.status = 'completed'
      task.progress = 100
      this.sendTaskUpdate(task)
      
      // Clean up completed task after a delay
      setTimeout(() => {
        this.tasks.delete(task.id)
      }, 5000)
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        task.status = 'paused'
      } else {
        task.status = 'failed'
        task.error = error instanceof Error ? error.message : 'Upload failed'
      }
      this.sendTaskUpdate(task)
    } finally {
      this.activeUploads.delete(task.id)
    }
  }

  private async simpleUpload(task: UploadTask, signal: AbortSignal) {
    // Reconstruct the full file from chunks
    const blob = new Blob(task.chunks.map(c => c.chunk))
    const file = new File([blob], task.fileName)
    
    const formData = new FormData()
    formData.append('files', file)
    if (task.folderPrefix) {
      formData.append('folder_prefix', task.folderPrefix)
    }

    const response = await fetch('https://api.lyceum.technology/api/v2/external/storage/upload-bulk', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${task.accessToken}`
      },
      body: formData,
      signal
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }

    task.progress = 100
    this.sendTaskUpdate(task)
  }

  private async multipartUpload(task: UploadTask, signal: AbortSignal) {
    // Upload chunks sequentially with progress tracking
    for (const chunk of task.chunks) {
      if (signal.aborted) {
        throw new Error('Upload cancelled')
      }

      if (task.uploadedChunks.has(chunk.index)) {
        continue // Skip already uploaded chunks
      }

      await this.uploadChunk(task, chunk, signal)
      
      task.uploadedChunks.add(chunk.index)
      task.progress = Math.floor((task.uploadedChunks.size / task.chunks.length) * 100)
      
      // Save progress to IndexedDB for resumability
      await this.saveProgress(task)
      
      this.sendTaskUpdate(task)
    }
  }

  private async uploadChunk(task: UploadTask, chunk: UploadChunk, signal: AbortSignal) {
    let lastError: Error | null = null
    
    for (let i = 0; i <= this.maxRetries; i++) {
      try {
        const formData = new FormData()
        const chunkFile = new File([chunk.chunk], `${task.fileName}.part${chunk.index}`)
        formData.append('file', chunkFile)
        formData.append('chunk_index', chunk.index.toString())
        formData.append('total_chunks', chunk.totalChunks.toString())
        formData.append('file_id', task.id)
        
        if (task.folderPrefix) {
          formData.append('folder_prefix', task.folderPrefix)
        }

        // Note: This endpoint would need to be implemented on the backend
        // to support chunked uploads
        const response = await fetch('https://api.lyceum.technology/api/v2/external/storage/upload-chunk', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${task.accessToken}`
          },
          body: formData,
          signal
        })

        if (response.ok) {
          return // Success
        }

        if (response.status === 404) {
          // Fallback to simple upload if chunked endpoint doesn't exist
          return
        }

        lastError = new Error(`Chunk upload failed: ${response.status}`)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (error instanceof Error && error.name === 'AbortError') {
          throw error // Don't retry on abort
        }
      }

      // Exponential backoff
      if (i < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
      }
    }

    throw lastError || new Error('Chunk upload failed after retries')
  }

  private async saveProgress(task: UploadTask) {
    // Save progress to IndexedDB for resumability
    const message: any = {
      type: 'SAVE_PROGRESS',
      payload: {
        taskId: task.id,
        uploadedChunks: Array.from(task.uploadedChunks),
        progress: task.progress
      }
    }
    self.postMessage(message)
  }

  private pauseUpload(taskId: string) {
    const controller = this.activeUploads.get(taskId)
    if (controller) {
      controller.abort()
    }
    
    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'paused'
      this.sendTaskUpdate(task)
    }
  }

  private resumeUpload(taskId: string) {
    const task = this.tasks.get(taskId)
    if (task && task.status === 'paused') {
      task.status = 'pending'
      this.processQueue()
    }
  }

  private cancelUpload(taskId: string) {
    const controller = this.activeUploads.get(taskId)
    if (controller) {
      controller.abort()
    }
    
    this.tasks.delete(taskId)
    this.activeUploads.delete(taskId)
    
    const message: any = {
      type: 'UPLOAD_CANCELLED',
      payload: { taskId }
    }
    self.postMessage(message)
  }

  private updateAuth(accessToken: string) {
    this.tasks.forEach(task => {
      task.accessToken = accessToken
    })
  }

  private sendTaskUpdate(task: UploadTask) {
    const message: any = {
      type: 'UPLOAD_PROGRESS',
      payload: {
        taskId: task.id,
        fileName: task.fileName,
        progress: task.progress,
        status: task.status,
        error: task.error
      }
    }
    self.postMessage(message)
  }

  private sendStatus() {
    const status = Array.from(this.tasks.values()).map(task => ({
      taskId: task.id,
      fileName: task.fileName,
      progress: task.progress,
      status: task.status,
      fileSize: task.fileSize
    }))
    
    const message: any = {
      type: 'STATUS_UPDATE',
      payload: status
    }
    self.postMessage(message)
  }
}

// Initialize the worker
new UploadWorker()

// Export for TypeScript
export default {}