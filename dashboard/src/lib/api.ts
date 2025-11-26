// API configuration utilities

export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'https://devel.api.lyceum.technology'
}

export const buildApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${cleanPath}`
}

// Types for Logs API
export interface LogEntry {
  timestamp: string
  message: string
  level: string | null
  execution_id: string | null
  user_id: string | null
  hostname: string | null
  labels: Record<string, string>
}

export interface LogsResponse {
  logs: LogEntry[]
  total: number
}

export interface FetchLogsOptions {
  executionId: string
  accessToken: string
  limit?: number
  hours?: number
}

/**
 * Fetches logs for a specific execution from the observability API
 * @param options - Configuration options for fetching logs
 * @returns Promise resolving to the logs response
 */
export const fetchExecutionLogs = async ({
  executionId,
  accessToken,
  limit = 1000,
  hours = 24
}: FetchLogsOptions): Promise<LogsResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    hours: hours.toString()
  })

  const response = await fetch(
    buildApiUrl(`/api/v2/external/logs/execution/${executionId}?${params}`),
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch logs: ${response.statusText}`)
  }

  return response.json()
}