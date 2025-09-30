import posthog from 'posthog-js'
import { metaPixel } from './metaPixel'

interface AnalyticsConfig {
  posthog?: {
    apiKey: string
    host?: string
  }
  metaPixel?: {
    pixelId: string
  }
  debug?: boolean
}

class AnalyticsService {
  private posthogInitialized = false
  private metaPixelInitialized = false
  private debug = false

  init(config: AnalyticsConfig) {
    this.debug = config.debug || false

    // Initialize PostHog if config provided
    if (config.posthog?.apiKey && !this.posthogInitialized) {
      console.log('🚀 Initializing PostHog with:', {
        apiKey: config.posthog.apiKey ? '***provided***' : 'missing',
        host: config.posthog.host || 'https://eu.i.posthog.com',
        debug: this.debug
      })
      
      posthog.init(config.posthog.apiKey, {
        api_host: config.posthog.host || 'https://eu.i.posthog.com',
        debug: this.debug,
        capture_pageview: false, // We'll handle this manually
        capture_pageleave: true,
        loaded: () => {
          console.log('✅ PostHog loaded successfully')
        }
      })
      this.posthogInitialized = true
    } else {
      console.log('❌ PostHog not initialized:', {
        hasApiKey: !!config.posthog?.apiKey,
        alreadyInitialized: this.posthogInitialized
      })
    }

    // Initialize Meta Pixel if config provided
    if (config.metaPixel?.pixelId && !this.metaPixelInitialized) {
      console.log('🚀 Initializing Meta Pixel with:', {
        pixelId: config.metaPixel.pixelId ? '***provided***' : 'missing',
        debug: this.debug
      })
      metaPixel.init({
        pixelId: config.metaPixel.pixelId,
        debug: this.debug
      })
      this.metaPixelInitialized = true
      console.log('✅ Meta Pixel initialization flag set')
    } else {
      console.log('❌ Meta Pixel not initialized:', {
        hasPixelId: !!config.metaPixel?.pixelId,
        alreadyInitialized: this.metaPixelInitialized
      })
    }
  }

  identify(userId: string, properties?: Record<string, any>) {
    if (this.posthogInitialized) {
      posthog.identify(userId, properties)
    }
    // Meta Pixel doesn't have a direct identify method, but we can track user properties
    if (this.metaPixelInitialized && properties) {
      metaPixel.trackCustom('UserIdentified', { user_id: userId, ...properties })
    }
  }

  track(event: string, properties?: Record<string, any>) {
    console.log('📊 Tracking event:', event, properties)
    
    // Track in PostHog
    if (this.posthogInitialized) {
      console.log('  → Sending to PostHog')
      posthog.capture(event, properties)
    } else {
      console.log('  → PostHog not initialized, skipping')
    }
    
    // Track in Meta Pixel with appropriate mapping
    if (this.metaPixelInitialized) {
      // Map common events to Meta Pixel standard events
      switch(event) {
        case ANALYTICS_EVENTS.LOGIN_SUCCESS:
          metaPixel.trackCustom('Login', properties)
          break
        case ANALYTICS_EVENTS.LOGOUT:
          metaPixel.trackCustom('Logout', properties)
          break
        case ANALYTICS_EVENTS.API_KEY_CREATED:
          metaPixel.trackLead(properties)
          break
        default:
          // Track as custom event if not a standard event
          if (!event.startsWith('$')) {
            metaPixel.trackCustom(event, properties)
          }
      }
    }
  }

  trackPageView(path?: string) {
    const url = path || window.location.href
    
    if (this.posthogInitialized) {
      posthog.capture('$pageview', {
        $current_url: url
      })
    }
    
    if (this.metaPixelInitialized) {
      metaPixel.trackPageView()
    }
  }

  // Track CTA clicks for Meta Pixel
  trackCTA(ctaName: string, properties?: Record<string, any>) {
    const eventProperties = {
      cta_name: ctaName,
      ...properties
    }
    
    // Track in both services
    this.track(`cta_${ctaName}`, eventProperties)
    
    // Specific Meta Pixel CTA tracking
    if (this.metaPixelInitialized) {
      metaPixel.trackCTA(ctaName, properties)
    }
  }

  // Track success flows for Meta Pixel
  trackSuccessFlow(flowNumber: number, flowName: string, properties?: Record<string, any>) {
    const eventProperties = {
      flow_number: flowNumber,
      flow_name: flowName,
      ...properties
    }
    
    // Track in PostHog
    this.track(`success_flow_${flowNumber}`, eventProperties)
    
    // Track in Meta Pixel
    if (this.metaPixelInitialized) {
      metaPixel.trackSuccessFlow(flowNumber, flowName, properties)
    }
  }

  // Track sign-up completion (success-flow-1)
  trackSignUp(userId: string, properties?: Record<string, any>) {
    const eventProperties = {
      user_id: userId,
      ...properties
    }
    
    console.log('📊 trackSignUp called - Meta Pixel initialized?', this.metaPixelInitialized)
    
    // Track in PostHog
    this.track(ANALYTICS_EVENTS.LOGIN_SUCCESS, eventProperties)
    
    // Track as success-flow-1 for Meta Pixel
    if (this.metaPixelInitialized) {
      console.log('  → Sending success_flow_1 to Meta Pixel')
      metaPixel.trackCompleteRegistration(properties)
      metaPixel.trackSuccessFlow(1, 'sign_up', eventProperties)
    } else {
      console.log('  ❌ Meta Pixel not initialized, skipping success_flow_1')
    }
  }

  // Track CompleteRegistration event for Meta Pixel
  trackCompleteRegistration(properties?: Record<string, any>) {
    if (this.metaPixelInitialized) {
      metaPixel.trackCompleteRegistration(properties)
    }
    // Also track in PostHog for consistency
    if (this.posthogInitialized) {
      posthog.capture('complete_registration', properties)
    }
  }

  // Track Purchase event for Meta Pixel
  trackPurchase(properties: { value: number; currency: string; content_ids?: string[]; content_type?: string }) {
    if (this.metaPixelInitialized) {
      metaPixel.trackPurchase(properties)
    }
    // Also track in PostHog for consistency
    if (this.posthogInitialized) {
      posthog.capture('purchase', properties)
    }
  }

  setUserProperties(properties: Record<string, any>) {
    if (this.posthogInitialized) {
      posthog.people.set(properties)
    }
    
    // Track user properties update in Meta Pixel
    if (this.metaPixelInitialized) {
      metaPixel.trackCustom('UserPropertiesUpdated', properties)
    }
  }

  reset() {
    if (this.posthogInitialized) {
      posthog.reset()
    }
    // Meta Pixel doesn't have a reset method
  }

  isInitialized() {
    return this.posthogInitialized || this.metaPixelInitialized
  }
}

export const analytics = new AnalyticsService()

// Re-export from metaPixel for convenience
export { CTA_NAMES, META_PIXEL_EVENTS } from './metaPixel'

// Common event names for consistency
export const ANALYTICS_EVENTS = {
  // Authentication
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  
  // Dashboard
  DASHBOARD_VIEWED: 'dashboard_viewed',
  WORKLOAD_CREATED: 'workload_created',
  WORKLOAD_VIEWED: 'workload_viewed',
  WORKLOAD_DELETED: 'workload_deleted',
  
  // API Keys
  API_KEY_CREATED: 'api_key_created',
  API_KEY_DELETED: 'api_key_deleted',
  
  // CLI/VSCode Integration
  CLI_AUTH_SUCCESS: 'cli_auth_success',
  VSCODE_AUTH_SUCCESS: 'vscode_auth_success',
  
  // General
  PAGE_VIEW: 'page_view',
  BUTTON_CLICK: 'button_click',
  ERROR_OCCURRED: 'error_occurred'
} as const