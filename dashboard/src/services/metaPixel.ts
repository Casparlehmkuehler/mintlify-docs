declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

interface MetaPixelConfig {
  pixelId: string;
  debug?: boolean;
}

class MetaPixelService {
  private initialized = false;

  init(config: MetaPixelConfig) {
    if (this.initialized) {
      console.warn('Meta Pixel already initialized');
      return;
    }

    // Initialize Facebook Pixel
    if (typeof window !== 'undefined') {
      (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function(...args: any[]) {
          n.callMethod ? n.callMethod(...args) : n.queue.push(args);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

      window.fbq('init', config.pixelId);
      window.fbq('track', 'PageView');

      if (config.debug) {
        console.log('Meta Pixel initialized with ID:', config.pixelId);
      }
    }

    this.initialized = true;
  }

  track(eventName: string, parameters?: Record<string, any>) {
    if (!this.initialized || typeof window === 'undefined' || !window.fbq) {
      console.warn('Meta Pixel not initialized');
      return;
    }

    try {
      if (parameters) {
        window.fbq('track', eventName, parameters);
      } else {
        window.fbq('track', eventName);
      }
    } catch (error) {
      console.error('Error tracking Meta Pixel event:', error);
    }
  }

  trackCustom(eventName: string, parameters?: Record<string, any>) {
    if (!this.initialized || typeof window === 'undefined' || !window.fbq) {
      console.warn('Meta Pixel not initialized');
      return;
    }

    try {
      if (parameters) {
        window.fbq('trackCustom', eventName, parameters);
      } else {
        window.fbq('trackCustom', eventName);
      }
    } catch (error) {
      console.error('Error tracking custom Meta Pixel event:', error);
    }
  }

  // Standard Meta Pixel Events
  trackPageView() {
    this.track('PageView');
  }

  trackViewContent(parameters?: { content_ids?: string[]; content_type?: string; value?: number; currency?: string }) {
    this.track('ViewContent', parameters);
  }

  trackSearch(parameters?: { search_string?: string; content_ids?: string[]; value?: number; currency?: string }) {
    this.track('Search', parameters);
  }

  trackAddToCart(parameters?: { content_ids?: string[]; content_type?: string; value?: number; currency?: string }) {
    this.track('AddToCart', parameters);
  }

  trackInitiateCheckout(parameters?: { value?: number; currency?: string; num_items?: number }) {
    this.track('InitiateCheckout', parameters);
  }

  trackPurchase(parameters: { value: number; currency: string; content_ids?: string[]; content_type?: string }) {
    this.track('Purchase', parameters);
  }

  trackLead(parameters?: { value?: number; currency?: string }) {
    this.track('Lead', parameters);
  }

  trackCompleteRegistration(parameters?: { value?: number; currency?: string; status?: string }) {
    this.track('CompleteRegistration', parameters);
  }

  // Custom events for the dashboard
  trackCTA(ctaName: string, parameters?: Record<string, any>) {
    this.trackCustom('CTA', { cta_name: ctaName, ...parameters });
  }

  trackSuccessFlow(flowNumber: number, flowName: string, parameters?: Record<string, any>) {
    this.trackCustom(`success_flow_${flowNumber}`, { flow_name: flowName, ...parameters });
  }

  isInitialized() {
    return this.initialized;
  }
}

export const metaPixel = new MetaPixelService();

// Meta Pixel Event Names for consistency
export const META_PIXEL_EVENTS = {
  // Standard Events
  PAGE_VIEW: 'PageView',
  VIEW_CONTENT: 'ViewContent',
  SEARCH: 'Search',
  ADD_TO_CART: 'AddToCart',
  INITIATE_CHECKOUT: 'InitiateCheckout',
  PURCHASE: 'Purchase',
  LEAD: 'Lead',
  COMPLETE_REGISTRATION: 'CompleteRegistration',

  // Custom Events
  CTA: 'CTA',
  SUCCESS_FLOW_1: 'success_flow_1', // Sign up
  SUCCESS_FLOW_2: 'success_flow_2', // First workload created
  SUCCESS_FLOW_3: 'success_flow_3', // API key generated
  SUCCESS_FLOW_4: 'success_flow_4', // CLI authenticated
  SUCCESS_FLOW_5: 'success_flow_5', // First deployment
} as const;

// CTA Names for tracking
export const CTA_NAMES = {
  // Auth CTAs
  SIGN_UP_BUTTON: 'sign_up_button',
  LOGIN_BUTTON: 'login_button',
  LOGOUT_BUTTON: 'logout_button',
  
  // Dashboard CTAs
  CREATE_WORKLOAD: 'create_workload',
  VIEW_WORKLOAD: 'view_workload',
  DELETE_WORKLOAD: 'delete_workload',
  
  // API Key CTAs
  CREATE_API_KEY: 'create_api_key',
  COPY_API_KEY: 'copy_api_key',
  DELETE_API_KEY: 'delete_api_key',
  
  // Settings CTAs
  UPDATE_PROFILE: 'update_profile',
  CHANGE_PASSWORD: 'change_password',
  
  // Navigation CTAs
  NAV_DASHBOARD: 'nav_dashboard',
  NAV_WORKLOADS: 'nav_workloads',
  NAV_API_KEYS: 'nav_api_keys',
  NAV_SETTINGS: 'nav_settings',
  NAV_DOCS: 'nav_docs',
  
  // File Upload CTAs
  UPLOAD_FILE: 'upload_file',
  CANCEL_UPLOAD: 'cancel_upload',
} as const;