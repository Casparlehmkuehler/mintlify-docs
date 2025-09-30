import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Activity, Circle, AlertCircle, CheckCircle } from 'lucide-react'

interface StreamingLogsProps {
  streamingUrl: string
  executionId: string
  onClose: () => void
}

interface StreamingEvent {
  type: 'connected' | 'status' | 'output' | 'completed' | 'error' | 'ping' | 'pong'
  execution_id?: string
  status?: string
  content?: string
  message?: string
  output?: {
    timestamp?: string
    channel?: string
    output?: string
  }
  status_update?: {
    execution_id?: string
    status?: string
    exit_code?: number
    error?: string
  }
}

const StreamingLogs: React.FC<StreamingLogsProps> = ({ streamingUrl, executionId, onClose }) => {
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<string>('connecting')
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [logs])

  useEffect(() => {
    const connectToStream = async () => {
      try {
        abortControllerRef.current = new AbortController()
        setStatus('connecting')
        setError(null)

        console.log(`Connecting to streaming URL: ${streamingUrl}`)

        const response = await fetch(streamingUrl, {
          method: 'POST',
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          signal: abortControllerRef.current.signal
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        setIsConnected(true)
        setStatus('connected')

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('Failed to get response reader')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            console.log('Stream ended')
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventDataString = line.slice(6)
                
                // Handle plain text completion messages
                if (eventDataString === 'Stream complete' || eventDataString.includes('complete')) {
                  setLogs(prev => [...prev, `[System] ${eventDataString}`])
                  continue
                }
                
                const rawEvent = JSON.parse(eventDataString)
                let event: StreamingEvent

                // Transform gRPC format to our StreamingEvent format
                if (rawEvent.Message) {
                  const message = rawEvent.Message
                  if (message.Output) {
                    const content = message.Output.content || ''
                    setLogs(prev => [...prev, content])
                    event = {
                      type: 'output',
                      content: content,
                      output: message.Output
                    }
                  } else if (message.StatusUpdate) {
                    const statusUpdate = message.StatusUpdate
                    const statusNum = statusUpdate.status
                    let statusStr = 'running'
                    
                    if (statusNum === 3) statusStr = 'completed'
                    else if (statusNum === 4) statusStr = 'error'
                    
                    setStatus(statusStr)
                    setLogs(prev => [...prev, `[Status] ${statusUpdate.message || statusStr}`])
                    
                    event = {
                      type: statusStr === 'error' ? 'error' : 'status',
                      message: statusUpdate.message || statusStr,
                      status: statusStr
                    }
                  } else if (message.JobFinished) {
                    const jobFinished = message.JobFinished
                    const job = jobFinished.job
                    const jobResult = job.result
                    const returnCode = jobResult.return_code

                    setStatus('completed')
                    setLogs(prev => [...prev, `[System] Job finished with exit code: ${returnCode}`])
                    
                    event = {
                      type: 'completed',
                      status_update: {
                        exit_code: returnCode,
                      }
                    }
                  } else {
                    console.log('Unknown gRPC message:', rawEvent)
                    continue
                  }
                } else if (rawEvent.output) {
                  const content = rawEvent.output.output || ''
                  setLogs(prev => [...prev, content])
                  
                  event = {
                    type: 'output',
                    content: content,
                    output: rawEvent.output
                  }
                } else if (rawEvent.status_update) {
                  const statusStr = rawEvent.status_update.status?.toLowerCase()
                  setStatus(statusStr || 'running')
                  setLogs(prev => [...prev, `[Status] ${rawEvent.status_update.error || statusStr}`])
                  
                  event = {
                    type: statusStr === 'failed' || statusStr === 'aborted' ? 'error' : 'status',
                    status: statusStr,
                    status_update: rawEvent.status_update
                  }
                } else {
                  event = rawEvent
                }
                
                // Handle ping/pong events
                if (event.type === 'ping' || event.type === 'pong') {
                  console.log(`[Keepalive] Received ${event.type} from server`)
                  continue
                }

                if (event.type === 'completed') {
                  setStatus('completed')
                  setLogs(prev => [...prev, '[System] Execution completed'])
                } else if (event.type === 'error') {
                  setStatus('error')
                  setLogs(prev => [...prev, `[Error] ${event.message || 'Execution failed'}`])
                }

              } catch (parseError) {
                console.error('Failed to parse SSE event:', parseError, line)
                setLogs(prev => [...prev, `[Parse Error] ${line}`])
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Stream connection aborted')
        } else {
          console.error('Stream connection error:', err)
          setError(err.message)
          setStatus('error')
          setLogs(prev => [...prev, `[Connection Error] ${err.message}`])
        }
      } finally {
        setIsConnected(false)
      }
    }

    connectToStream()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [streamingUrl])

  const getStatusIcon = () => {
    switch (status) {
      case 'connecting':
        return <Circle className="h-4 w-4 text-yellow-500 animate-pulse" />
      case 'connected':
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Circle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connecting':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'connected':
      case 'running':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] bg-black bg-opacity-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="fixed inset-4 bg-white dark:bg-dark-card rounded-lg shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {getStatusIcon()}
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                Live Logs - {executionId}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-400 dark:text-dark-text-secondary hover:text-gray-600 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-accent/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Connection Info */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-dark-accent/20 border-b border-gray-200 dark:border-dark-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-dark-text-secondary">
                {isConnected ? 'Connected to stream' : 'Disconnected'}
              </span>
              <span className="text-gray-500 dark:text-dark-text-secondary font-mono">
                {logs.length} events
              </span>
            </div>
            {error && (
              <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                Error: {error}
              </div>
            )}
          </div>

          {/* Logs Area */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full bg-gray-900 text-gray-100 overflow-y-auto p-4 font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500 italic">
                  {status === 'connecting' ? 'Connecting to stream...' : 'No logs yet'}
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap break-words mb-1">
                    {log}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-accent/20">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-dark-text-secondary">
              <span>Streaming from: {streamingUrl}</span>
              <button
                onClick={onClose}
                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

export default StreamingLogs