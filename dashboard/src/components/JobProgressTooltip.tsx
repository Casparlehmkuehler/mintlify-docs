import React from 'react'
import type { JobTiming } from '../lib/utils'

interface JobProgressTooltipProps {
  timing: JobTiming
  className?: string
}

const JobProgressTooltip: React.FC<JobProgressTooltipProps> = ({ timing, className = '' }) => {
  const phases = [
    { 
      name: 'Job Request Sent', 
      start: timing.jobRequestSent, 
      end: timing.queued, 
      color: 'bg-gray-300',
      billed: false
    },
    { 
      name: 'Queued', 
      start: timing.queued, 
      end: timing.launchingContainer, 
      color: 'bg-yellow-400',
      billed: false
    },
    { 
      name: 'Launching Docker Container', 
      start: timing.launchingContainer, 
      end: timing.executingJob, 
      color: 'bg-blue-400',
      billed: true
    },
    { 
      name: 'Executing Job', 
      start: timing.executingJob, 
      end: timing.shuttingDown, 
      color: 'bg-green-400',
      billed: true
    },
    { 
      name: 'Shutting Down', 
      start: timing.shuttingDown, 
      end: timing.total, 
      color: 'bg-red-400',
      billed: true
    }
  ]

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className={`bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg p-4 w-80 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-text mb-3">Job Execution Timeline</h3>
      
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex h-6 bg-gray-100 dark:bg-dark-accent/20 rounded-full overflow-hidden">
          {phases.map((phase, index) => {
            const duration = phase.end - phase.start
            const percentage = (duration / timing.total) * 100
            
            return (
              <div
                key={index}
                className={`${phase.color} relative`}
                style={{ width: `${percentage}%` }}
                title={`${phase.name}: ${formatTime(duration)}`}
              >
                {phase.billed && (
                  <div 
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.6) 3px, rgba(255,255,255,0.6) 6px)'
                    }}
                  ></div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-dark-text-secondary mt-1">
          <span>0s</span>
          <span>{formatTime(timing.total)}</span>
        </div>
      </div>

      {/* Phase Details */}
      <div className="space-y-2">
        {phases.map((phase, index) => {
          const duration = phase.end - phase.start
          return (
            <div key={index} className="flex items-center justify-between text-xs">
              <div className="flex items-center">
                <div className={`w-3 h-3 ${phase.color} rounded-sm mr-2 ${phase.billed ? 'relative' : ''}`}>
                  {phase.billed && (
                    <div className="absolute inset-0 opacity-50" style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 4px)'
                    }}></div>
                  )}
                </div>
                <span className="text-gray-700 dark:text-dark-text-secondary">{phase.name}</span>
              </div>
              <span className="text-gray-600 dark:text-dark-text-secondary font-mono">{formatTime(duration)}</span>
            </div>
          )
        })}
      </div>

      {/* Billing Legend */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-dark-border">
        <h4 className="text-xs font-semibold text-gray-700 dark:text-dark-text-secondary mb-2">Billing</h4>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-400 rounded-sm mr-2"></div>
            <span className="text-gray-600 dark:text-dark-text-secondary">Not Billed</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-600 rounded-sm mr-2 relative">
              <div className="absolute inset-0 opacity-50" style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 4px)'
              }}></div>
            </div>
            <span className="text-gray-600 dark:text-dark-text-secondary">Billed</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JobProgressTooltip