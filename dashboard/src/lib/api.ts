// API configuration utilities

export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'https://api.lyceum.technology'
}

export const buildApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${cleanPath}`
}