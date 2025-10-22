export interface JobTiming {
  total_duration?: number
  jobRequestSent: number
  queued: number
  launchingContainer: number
  executingJob: number
  shuttingDown: number
  total: number
  phases?: {
    [key: string]: {
      start_time: string
      end_time: string
      duration: number
    }
  }
}

export interface Run {
  id: string
  name: string
  status: string
  createdAt: string
  updatedAt: string
  description: string
  duration: string
  cost: number | null
  startTime: string
  configuration: string
  executionType: string
  combined_output?: string
  stdout?: string
  stderr?: string
  python_code?: string
  return_code?: number
  timing?: JobTiming
  timestamps?: any
  warnings?: string[]
  errors?: string[]
  systemErrors?: string[]
  errors_docker?: string
  install_logs?: string
  local_imports?: string[] | null
  [key: string]: any
}

function extractSystemErrors(combinedOutput?: string): string[] {
  if (!combinedOutput) return []
  
  const systemErrorPatterns = [
    /Error response from daemon: (.+)/gi,
    /Failed to create container.*err="([^"]+)"/gi,
    /Failed to run container.*err="([^"]+)"/gi,
    /Can't run container: (.+)/gi,
    /Docker error: (.+)/gi,
    /No such image: (.+)/gi,
    /level=ERROR.*msg="([^"]+)"/gi,
    /level=WARN.*error="([^"]+)"/gi
  ]
  
  const errors: string[] = []
  
  for (const pattern of systemErrorPatterns) {
    let match
    while ((match = pattern.exec(combinedOutput)) !== null) {
      const error = match[1]?.trim()
      if (error && !errors.includes(error)) {
        errors.push(error)
      }
    }
  }
  
  return errors
}

function calculateDuration(startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) {
    return '—'
  }
  
  const start = new Date(startTime)
  const end = new Date(endTime)
  const diffMs = end.getTime() - start.getTime()
  
  if (diffMs <= 0) {
    return '—'
  }
  
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  
  if (diffHours > 0) {
    const remainingMinutes = diffMinutes % 60
    return `${diffHours}h ${remainingMinutes}m`
  } else if (diffMinutes > 0) {
    const remainingSeconds = diffSeconds % 60
    return `${diffMinutes}m ${remainingSeconds}s`
  } else {
    return `${diffSeconds}s`
  }
}

export function convertExecutionToRun(execution: any): Run {
  const startTime = execution.start_time || execution.execelet_start || execution.created_at
  const endTime = execution.end_time || execution.finish_time
  const combinedOutput = execution.combined_output || execution.stdout || ''
  
  return {
    id: execution.execution_id || execution.id,
    name: execution.name || execution.file_name || 'Unnamed Run',
    status: execution.status || 'pending',
    createdAt: execution.created_at,
    updatedAt: execution.updated_at,
    description: execution.description || execution.file_name || '',
    duration: calculateDuration(startTime, endTime),
    cost: execution.cost || execution.billed || null,
    startTime: startTime || new Date().toISOString(),
    configuration: execution.hardware_profile || execution.configuration || 'unknown',
    executionType: execution.execution_type || 'unknown',
    warnings: execution.warnings || [],
    errors: execution.errors || [],
    systemErrors: extractSystemErrors(combinedOutput),
    ...execution
  }
}