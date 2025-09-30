import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { JobTiming } from '../lib/utils'

interface JobProgressBarProps {
  timing: JobTiming
  showLegend?: boolean
}

const JobProgressBar: React.FC<JobProgressBarProps> = ({ timing, showLegend = true }) => {
  const [showDetails, setShowDetails] = useState(false)

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
    <div>
      {/* Progress Bar */}
      <div className="mb-2">
        <div className="flex h-4 bg-gray-100 dark:bg-dark-bg rounded-full overflow-hidden">
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
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 4px)'
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

      {/* Expandable Legend */}
      {showLegend && (
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-left text-xs text-gray-600 dark:text-dark-text-secondary hover:text-gray-800 dark:hover:text-dark-text py-1"
          >
            <span>Timeline Details</span>
            {showDetails ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          
          {showDetails && (
            <div className="mt-2 space-y-2">
              {/* Phase Details */}
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
              
              {/* Billing Legend */}
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-dark-border">
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
          )}
        </div>
      )}
    </div>
  )
}

export default JobProgressBar