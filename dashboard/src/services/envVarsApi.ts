import { supabase } from '../lib/supabase'

export interface EnvVar {
  id: string
  name: string
  value: string
  created_at: string
  updated_at: string
}

export interface CreateEnvVarRequest {
  name: string
  value: string
}

export interface UpsertEnvVarsRequest {
  environment_variables: CreateEnvVarRequest[]
}

export interface EnvVarResponse {
  environment_variables: EnvVar[]
}

class EnvVarsApi {
  private readonly baseUrl = 'https://api.lyceum.technology'

  private async getAuthHeaders() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  }

  async getAllEnvVars(): Promise<EnvVar[]> {
    const headers = await this.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/api/v2/external/environment-variables/`, {
      headers
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Failed to fetch environment variables: ${response.statusText}`)
    }

    const data: EnvVarResponse = await response.json()
    return data.environment_variables || []
  }

  async createEnvVar(envVar: CreateEnvVarRequest): Promise<EnvVar> {
    // Use the upsert endpoint for single variable creation
    const result = await this.createMultipleEnvVars([envVar])
    return result[0]
  }

  async createMultipleEnvVars(envVars: CreateEnvVarRequest[]): Promise<EnvVar[]> {
    const headers = await this.getAuthHeaders()

    const requestBody: UpsertEnvVarsRequest = {
      environment_variables: envVars
    }
    
    const response = await fetch(`${this.baseUrl}/api/v2/external/environment-variables/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Failed to create environment variables: ${response.statusText}`)
    }

    const data: EnvVarResponse = await response.json()
    return data.environment_variables || []
  }

  async updateEnvVar(_id: string, name: string, value: string): Promise<EnvVar> {
    // Use upsert endpoint to update - the API will update based on user_id + name
    // The id parameter is not used since the new API uses name for upsert logic
    const result = await this.createMultipleEnvVars([{ name, value }])
    return result[0]
  }

  async deleteEnvVar(id: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/api/v2/external/environment-variables/${id}`, {
      method: 'DELETE',
      headers
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Failed to delete environment variable: ${response.statusText}`)
    }
  }

  async deleteAllEnvVars(): Promise<void> {
    const headers = await this.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/api/v2/external/environment-variables/`, {
      method: 'DELETE',
      headers
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Failed to delete all environment variables: ${response.statusText}`)
    }
  }
}

export const envVarsApi = new EnvVarsApi()