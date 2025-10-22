export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          username: string | null
          email_notifications: boolean
          dark_mode: boolean
          language: string
          onboarding_completed: boolean
          two_factor_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          username?: string | null
          email_notifications?: boolean
          dark_mode?: boolean
          language?: string
          onboarding_completed?: boolean
          two_factor_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          username?: string | null
          email_notifications?: boolean
          dark_mode?: boolean
          language?: string
          onboarding_completed?: boolean
          two_factor_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_credits: {
        Row: {
          user_id: string
          email: string
          available_credits: number
          used_credits: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email: string
          available_credits?: number
          used_credits?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email?: string
          available_credits?: number
          used_credits?: number
          created_at?: string
          updated_at?: string
        }
      }
      user_quotas: {
        Row: {
          user_id: string
          email: string
          cpu: boolean
          gpu: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email: string
          cpu?: boolean
          gpu?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email?: string
          cpu?: boolean
          gpu?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      execution: {
        Row: {
          execution_id: string
          user_id: string
          status: string
          python_code: string | null
          execution_type: string | null
          file_name: string | null
          created_at: string
          start_time: string | null
          end_time: string | null
          finish_time: string | null
          job_start: string | null
          job_end: string | null
          execelet_start: string | null
          fastapi_received: string | null
          hardware_profile: string | null
          billed: number | null
          combined_output: string | null
          stdout: string | null
          stderr: string | null
          return_code: number | null
          python_globals_out: string | null
          errors: string | null
          metadata: string | null
        }
        Insert: {
          execution_id: string
          user_id: string
          status: string
          python_code?: string | null
          execution_type?: string | null
          file_name?: string | null
          created_at?: string
          start_time?: string | null
          end_time?: string | null
          finish_time?: string | null
          job_start?: string | null
          job_end?: string | null
          execelet_start?: string | null
          fastapi_received?: string | null
          hardware_profile?: string | null
          billed?: number | null
          combined_output?: string | null
          stdout?: string | null
          stderr?: string | null
          return_code?: number | null
          python_globals_out?: string | null
          errors?: string | null
          metadata?: string | null
        }
        Update: {
          execution_id?: string
          user_id?: string
          status?: string
          python_code?: string | null
          execution_type?: string | null
          file_name?: string | null
          created_at?: string
          start_time?: string | null
          end_time?: string | null
          finish_time?: string | null
          job_start?: string | null
          job_end?: string | null
          execelet_start?: string | null
          fastapi_received?: string | null
          hardware_profile?: string | null
          billed?: number | null
          combined_output?: string | null
          stdout?: string | null
          stderr?: string | null
          return_code?: number | null
          python_globals_out?: string | null
          errors?: string | null
          metadata?: string | null
        }
      }
      user_environment_variables: {
        Row: {
          id: string
          user_id: string
          name: string
          value: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          value: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          value?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}