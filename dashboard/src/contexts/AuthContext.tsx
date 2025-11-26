import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { analytics, ANALYTICS_EVENTS } from '../services/analytics'
import { MinIOSTSService } from '../services/MinIOSTSService'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Initialize user's MinIO storage bucket on first login
 * This ensures the bucket exists before the user visits the storage page
 */
async function initializeUserBucket(session: any): Promise<void> {
  try {
    console.log('🔧 Initializing MinIO bucket for user:', session.user.id)

    // Get JWT token from session
    const jwtToken = session.access_token
    if (!jwtToken) {
      throw new Error('No access token available in session')
    }

    // Generate S3 credentials and ensure bucket exists
    const credentials = await MinIOSTSService.generateS3Credentials(jwtToken)

    console.log('✅ MinIO bucket initialized successfully:', credentials.bucket)

    // Optionally test the credentials
    const isValid = await MinIOSTSService.testCredentials(credentials)
    if (isValid) {
      console.log('✅ MinIO credentials validated successfully')
    } else {
      console.warn('⚠️ MinIO credentials validation failed')
    }
  } catch (error) {
    console.error('❌ Failed to initialize MinIO bucket:', error)
    throw error
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      // Don't set user if MFA is pending
      const mfaPending = sessionStorage.getItem('mfa_pending')
      if (mfaPending === 'true') {
        console.log('🔐 MFA pending, not setting user in AuthContext')
        setUser(null)
      } else {
        setUser(session?.user ?? null)
      }
      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Don't set user if MFA is pending
        const mfaPending = sessionStorage.getItem('mfa_pending')
        if (mfaPending === 'true') {
          console.log('🔐 MFA pending, blocking auth state change')
          setUser(null)
        } else {
          setUser(session?.user ?? null)
        }
        setLoading(false)

        // Track OAuth login success (but not if MFA is pending)
        if (event === 'SIGNED_IN' && session?.user && mfaPending !== 'true') {
          const params = new URLSearchParams(window.location.search)
          const method = params.get('method') || 'unknown'
          const source = params.get('source') || sessionStorage.getItem('lyceum_auth_source') || 'web'

          // Track successful OAuth login
          analytics.track(ANALYTICS_EVENTS.LOGIN_SUCCESS, {
            user_id: session.user.id,
            email: session.user.email,
            method: method,
            source: source,
            provider: session.user.app_metadata?.provider || method
          })

          // Track Meta Pixel CompleteRegistration
          analytics.trackCompleteRegistration({
            user_id: session.user.id,
            login_method: method,
            source: source
          })

          // Track success flows based on source
          if (source === 'cli') {
            analytics.track(ANALYTICS_EVENTS.CLI_AUTH_SUCCESS, {
              user_id: session.user.id,
              method: method
            })
            analytics.trackSuccessFlow(4, 'cli_authenticated', {
              user_id: session.user.id
            })
          } else if (source === 'vscode') {
            analytics.track(ANALYTICS_EVENTS.VSCODE_AUTH_SUCCESS, {
              user_id: session.user.id,
              method: method
            })
            analytics.trackSuccessFlow(4, 'vscode_authenticated', {
              user_id: session.user.id
            })
          }

          // Identify user in PostHog
          analytics.identify(session.user.id, {
            email: session.user.email,
            name: session.user.user_metadata?.full_name,
            provider: session.user.app_metadata?.provider
          })

          // Initialize MinIO bucket on first login
          // This ensures the user's storage bucket exists even before submitting their first job
          initializeUserBucket(session).catch(error => {
            console.error('Failed to initialize user bucket:', error)
            // Non-blocking: authentication succeeds even if bucket setup fails
          })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    user,
    loading,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}