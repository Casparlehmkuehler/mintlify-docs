// Upload Progress Component
// Displays the status of all file uploads with controls

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  Pause, 
  Play, 
  X, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ChevronUp,
  ChevronDown,
  RotateCw,
  Trash2
} from 'lucide-react'
import UploadManager, { UploadTask } from '../services/UploadManager'

interface UploadProgressProps {
  uploadManager: UploadManager
  className?: string
}

const UploadProgress: React.FC<UploadProgressProps> = ({ uploadManager, className = '' }) => {
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [isMinimized, setIsMinimized] = useState(false)
  const [showCompleted, setShowCompleted] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Subscribe to upload manager updates
    const unsubscribe = uploadManager.subscribe((updatedTasks) => {
      setTasks(updatedTasks)
      
      // Check if we should show or hide the modal
      const hasActiveTasks = updatedTasks.some(t => 
        t.status === 'uploading' || t.status === 'pending' || t.status === 'paused' || t.status === 'failed'
      )
      
      if (hasActiveTasks) {
        setIsVisible(true)
        // Clear any pending hide timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current)
          hideTimeoutRef.current = null
        }
      } else if (updatedTasks.length > 0) {
        // All tasks are completed, hide after a delay
        if (!hideTimeoutRef.current) {
          hideTimeoutRef.current = setTimeout(() => {
            setIsVisible(false)
            // Also clear completed tasks after hiding
            uploadManager.clearCompleted()
            hideTimeoutRef.current = null
          }, 3000) // Hide after 3 seconds
        }
      } else {
        // No tasks at all
        setIsVisible(false)
      }
    })

    // Get initial tasks
    const initialTasks = uploadManager.getTasks()
    setTasks(initialTasks)
    setIsVisible(initialTasks.length > 0)

    return () => {
      unsubscribe()
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [uploadManager])

  const activeTasks = tasks.filter(t => 
    t.status === 'uploading' || t.status === 'pending' || t.status === 'paused'
  )
  
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const failedTasks = tasks.filter(t => t.status === 'failed')

  const displayedTasks = showCompleted 
    ? tasks 
    : tasks.filter(t => t.status !== 'completed')

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`
  }

  const estimateTimeRemaining = (task: UploadTask): string => {
    if (!task.uploadSpeed || task.uploadSpeed === 0) return '...'
    
    const remainingBytes = task.fileSize * (1 - task.progress / 100)
    const remainingSeconds = Math.ceil(remainingBytes / task.uploadSpeed)
    
    if (remainingSeconds < 60) {
      return `${remainingSeconds}s`
    } else if (remainingSeconds < 3600) {
      const minutes = Math.floor(remainingSeconds / 60)
      const seconds = remainingSeconds % 60
      return `${minutes}m ${seconds}s`
    } else {
      const hours = Math.floor(remainingSeconds / 3600)
      const minutes = Math.floor((remainingSeconds % 3600) / 60)
      return `${hours}h ${minutes}m`
    }
  }

  const getStatusIcon = (status: UploadTask['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />
      default:
        return <Upload className="h-4 w-4 text-gray-400" />
    }
  }

  const handlePauseResume = (task: UploadTask) => {
    if (task.status === 'paused') {
      uploadManager.resumeUpload(task.id)
    } else if (task.status === 'uploading') {
      uploadManager.pauseUpload(task.id)
    }
  }

  const handleRetry = (task: UploadTask) => {
    uploadManager.retryUpload(task.id)
  }

  const handleCancel = (task: UploadTask) => {
    uploadManager.cancelUpload(task.id)
  }

  const handleClearCompleted = () => {
    uploadManager.clearCompleted()
  }

  const handleClearAll = () => {
    // If there are active uploads, show a warning
    if (activeTasks.length > 0) {
      if (window.confirm('Cancel all active uploads? This cannot be undone.')) {
        uploadManager.clearAll()
      }
    } else {
      // No active uploads, just close the modal
      setIsVisible(false)
      uploadManager.clearCompleted()
    }
  }

  // Don't show if not visible
  if (!isVisible) {
    return null
  }

  // Calculate overall progress
  const totalProgress = tasks.length > 0
    ? tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length
    : 0

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className={`fixed bottom-4 right-4 bg-white dark:bg-dark-card rounded-lg shadow-xl border border-gray-200 dark:border-dark-border z-[10000] ${className}`}
        style={{ width: isMinimized ? '300px' : '400px', maxHeight: '500px' }}
      >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center space-x-2">
          <Upload className="h-5 w-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-text">
            Uploads ({activeTasks.length} active)
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          {completedTasks.length > 0 && (
            <button
              onClick={handleClearCompleted}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
              title="Clear completed"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
          >
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={handleClearAll}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Cancel all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Overall Progress */}
      {activeTasks.length > 1 && !isMinimized && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-dark-border">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-text-secondary mb-1">
            <span>Overall Progress</span>
            <span>{Math.round(totalProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-dark-accent/20 rounded-full h-1.5">
            <motion.div
              className="bg-blue-500 h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Task List */}
      {!isMinimized && (
        <div className="overflow-y-auto" style={{ maxHeight: '350px' }}>
          <AnimatePresence>
            {displayedTasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-3 border-b border-gray-100 dark:border-dark-border last:border-b-0"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start space-x-2 flex-1 min-w-0">
                    <div className="mt-0.5">{getStatusIcon(task.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-dark-text truncate" title={task.fileName}>
                        {task.fileName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-dark-text-secondary">
                        {formatBytes(task.fileSize)}
                        {task.status === 'uploading' && task.uploadSpeed && (
                          <span> • {formatSpeed(task.uploadSpeed)} • {estimateTimeRemaining(task)} left</span>
                        )}
                      </div>
                      {task.error && (
                        <div className="text-xs text-red-500 mt-1">{task.error}</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center space-x-1 ml-2">
                    {task.status === 'uploading' && (
                      <button
                        onClick={() => handlePauseResume(task)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
                        title="Pause upload"
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {task.status === 'paused' && (
                      <button
                        onClick={() => handlePauseResume(task)}
                        className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                        title="Resume upload"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {task.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(task)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Retry upload"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {(task.status === 'uploading' || task.status === 'pending' || task.status === 'paused') && (
                      <button
                        onClick={() => handleCancel(task)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Cancel upload"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {(task.status === 'uploading' || task.status === 'paused') && (
                  <div className="w-full bg-gray-200 dark:bg-dark-accent/20 rounded-full h-1.5">
                    <motion.div
                      className={`h-1.5 rounded-full ${
                        task.status === 'paused' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${task.progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Footer Summary */}
      {!isMinimized && tasks.length > 3 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-dark-border text-xs text-gray-500 dark:text-dark-text-secondary">
          <div className="flex justify-between">
            <span>
              {activeTasks.length > 0 && `${activeTasks.length} active`}
              {completedTasks.length > 0 && ` • ${completedTasks.length} completed`}
              {failedTasks.length > 0 && ` • ${failedTasks.length} failed`}
            </span>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="text-blue-500 hover:text-blue-600 transition-colors"
            >
              {showCompleted ? 'Hide' : 'Show'} completed
            </button>
          </div>
        </div>
      )}
    </motion.div>
    </AnimatePresence>
  )
}

export default UploadProgress