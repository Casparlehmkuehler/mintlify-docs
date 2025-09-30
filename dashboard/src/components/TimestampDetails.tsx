import React from 'react'
import { Clock, Play, Square, CheckCircle, XCircle } from 'lucide-react'

interface TimestampDetailsProps {
  timestamps: {
    created_at?: string
    execelet_start?: string
    start_time?: string
    end_time?: string
    finish_time?: string
  }
  status: string
}

const TimestampDetails: React.FC<TimestampDetailsProps> = ({ timestamps, status }) => {
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return 'N/A'
    const startTime = new Date(start)
    const endTime = new Date(end)
    const diffMs = endTime.getTime() - startTime.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    
    if (diffSecs < 60) return `${diffSecs}s`
    const minutes = Math.floor(diffSecs / 60)
    const seconds = diffSecs % 60
    return `${minutes}m ${seconds}s`
  }

  // Determine if job failed
  const isFailed = ['failed', 'error', 'cancelled'].includes(status.toLowerCase())
  const isCompleted = ['completed', 'success'].includes(status.toLowerCase())
  
  // Get the initial received time
  const receivedTime = timestamps.created_at || timestamps.start_time

  // Build phases based on execution status
  const phases = []
  if (receivedTime) {
    phases.push({
      name: 'Execution Received',
      timestamp: receivedTime,
      icon: Clock,
      status: 'started'
    })
  }
  
  // Only add Execution Started if we have execelet_start timestamp
  if (timestamps.execelet_start) {
    phases.push({
      name: 'Execution Started',
      timestamp: timestamps.execelet_start,
      icon: Play,
      description: 'Execution node received the job (pending → starting)',
      duration: formatDuration(receivedTime, timestamps.execelet_start),
      status: 'pending'
    })
  }

  // Add completion or failure phase
  if (isFailed) {
    // For failed jobs, use any available end timestamp
    const failureTime = timestamps.end_time || timestamps.finish_time
    // Always show failure phase for failed jobs, even without timestamp
    phases.push({
      name: 'Execution Failed',
      timestamp: failureTime || undefined, // Use undefined if no timestamp
      icon: XCircle,
      description: 'Job execution failed',
      duration: failureTime ? formatDuration(timestamps.execelet_start || timestamps.start_time || receivedTime, failureTime) : undefined,
      status: 'failed'
    })
  } else if (isCompleted) {
    // For successful jobs, add completion phases if we have the timestamps
    if (timestamps.end_time) {
      phases.push({
        name: 'Execution Finished',
        timestamp: timestamps.end_time,
        icon: Square,
        description: 'Job execution completed',
        duration: formatDuration(timestamps.execelet_start || timestamps.start_time, timestamps.end_time),
        status: 'finished'
      })
    }
    
    if (timestamps.finish_time) {
      phases.push({
        name: 'Callback Received',
        timestamp: timestamps.finish_time,
        icon: CheckCircle,
        description: 'Results processed by system',
        duration: formatDuration(timestamps.end_time || timestamps.start_time, timestamps.finish_time),
        status: 'callback'
      })
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-3">
        Execution Timeline
      </h4>
      
      <div className="space-y-2">
        {phases.map((phase, index) => {
          const Icon = phase.icon
          const hasTimestamp = !!phase.timestamp
          const isFailedPhase = phase.status === 'failed'
          
          // Choose colors based on phase type - prioritize failed status over timestamp availability
          let backgroundClasses, iconClasses, titleClasses, descriptionClasses, timestampClasses
          
          if (isFailedPhase) {
            // Red styling for all failed phases (with or without timestamp)
            backgroundClasses = 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
            iconClasses = 'text-red-600 dark:text-red-400'
            titleClasses = 'text-red-900 dark:text-red-100'
            descriptionClasses = 'text-red-700 dark:text-red-300'
            timestampClasses = hasTimestamp ? 'text-red-800 dark:text-red-200' : 'text-red-400 dark:text-red-500'
          } else if (hasTimestamp) {
            // Green styling for completed phases with timestamp
            backgroundClasses = 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
            iconClasses = 'text-green-600 dark:text-green-400'
            titleClasses = 'text-green-900 dark:text-green-100'
            descriptionClasses = 'text-green-700 dark:text-green-300'
            timestampClasses = 'text-green-800 dark:text-green-200'
          } else {
            // Gray styling for incomplete phases
            backgroundClasses = 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600'
            iconClasses = 'text-gray-400 dark:text-gray-500'
            titleClasses = 'text-gray-500 dark:text-gray-400'
            descriptionClasses = 'text-gray-400 dark:text-gray-500'
            timestampClasses = 'text-gray-400 dark:text-gray-500'
          }
          
          return (
            <div 
              key={index}
              className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${backgroundClasses}`}
            >
              <div className={`mt-0.5 ${iconClasses}`}>
                <Icon className="h-4 w-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${titleClasses}`}>
                      {phase.name}
                    </p>
                    <p className={`text-xs mt-1 ${descriptionClasses}`}>
                      {phase.description}
                    </p>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-mono ${timestampClasses}`}>
                      {formatTimestamp(phase.timestamp)}
                    </p>
                    {phase.duration && phase.duration !== 'N/A' && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-1">
                        +{phase.duration}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Total Duration */}
      {receivedTime && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-dark-border">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
              Total Duration:
            </span>
            <span className="text-sm font-mono text-blue-600 dark:text-blue-400">
              {(() => {
                // Calculate total duration based on status and available timestamps
                const startTime = receivedTime
                let endTime = null
                
                if (isFailed) {
                  // For failed jobs, use end_time or finish_time
                  endTime = timestamps.end_time || timestamps.finish_time
                } else if (isCompleted) {
                  // For completed jobs, use finish_time or end_time
                  endTime = timestamps.finish_time || timestamps.end_time
                } else {
                  // For running jobs, don't show total duration yet
                  return 'In Progress'
                }
                
                return formatDuration(startTime, endTime)
              })()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default TimestampDetails