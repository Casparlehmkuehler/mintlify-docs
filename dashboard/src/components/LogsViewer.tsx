import React, { useState, useEffect, useRef } from 'react'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchExecutionLogs, type LogEntry } from '../lib/api'

interface LogsViewerProps {
  executionId: string
  limit?: number
  hours?: number
}

const LogsViewer: React.FC<LogsViewerProps> = ({
  executionId,
  limit = 1000,
  hours = 24
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const fetchLogs = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw new Error('Please log in to view logs')
      }

      const data = await fetchExecutionLogs({
        executionId,
        accessToken: currentSession.access_token,
        limit,
        hours
      })

      setLogs(data.logs)
    } catch (err: any) {
      console.error('Error fetching logs:', err)
      setError(err.message || 'Failed to fetch logs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [executionId])

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const getLevelColor = (level: string | null): string => {
    if (!level) return 'text-gray-300'

    switch (level.toLowerCase()) {
      case 'error':
        return 'text-red-400'
      case 'warn':
      case 'warning':
        return 'text-yellow-400'
      case 'info':
        return 'text-blue-400'
      case 'debug':
        return 'text-gray-400'
      default:
        return 'text-gray-300'
    }
  }

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp)
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      const seconds = date.getSeconds().toString().padStart(2, '0')
      const ms = date.getMilliseconds().toString().padStart(3, '0')
      return `${hours}:${minutes}:${seconds}.${ms}`
    } catch {
      return timestamp
    }
  }

  if (loading) {
    return null
  }

  if (error) {
    return null
  }

  if (logs.length === 0) {
    return null
  }

  return (
    <div>
      <div
        className="flex items-center justify-between mb-2 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text flex items-center gap-2">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Execution Logs
          <span className="text-gray-500 dark:text-dark-text-secondary text-xs font-normal">
            ({logs.length} entries)
          </span>
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation()
            fetchLogs(true)
          }}
          disabled={refreshing}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isExpanded && (
        <div className={`bg-gray-900 rounded-lg p-4 overflow-y-auto overflow-x-auto ${isExpanded ? 'h-[600px]' : 'h-96'}`}>
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="font-mono text-sm leading-relaxed py-1 hover:bg-gray-800 px-2 rounded">
                <div className="flex gap-3 items-start">
                  <span className="text-gray-500 whitespace-nowrap flex-shrink-0 w-28">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  {log.level && (
                    <span className={`${getLevelColor(log.level)} uppercase whitespace-nowrap flex-shrink-0 w-14 text-center`}>
                      {log.level}
                    </span>
                  )}
                  {log.hostname && (
                    <span className="text-purple-400 whitespace-nowrap flex-shrink-0 max-w-xs truncate" title={log.hostname}>
                      {log.hostname}
                    </span>
                  )}
                  <span className="text-gray-300 flex-1 min-w-0 break-all">
                    {log.message}
                  </span>
                </div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}

export default LogsViewer
