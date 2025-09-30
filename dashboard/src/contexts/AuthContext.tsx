import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { analytics, ANALYTICS_EVENTS } from '../services/analytics'

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
        
        // Track OAuth login success
        if (event === 'SIGNED_IN' && session?.user) {
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