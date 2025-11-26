import { buildApiUrl } from '../lib/api';

export interface EmailPreferences {
  email_marketing: boolean;
  email_transactional: boolean;
  email_security: boolean;
  email_job_notifications: boolean;
  email_billing: boolean;
}

export interface UpdateEmailPreferencesResponse {
  message: string;
  preferences: EmailPreferences;
}

export interface UnsubscribeRequest {
  email: string;
  categories: string[];
}

export interface UnsubscribeResponse {
  message: string;
  email: string;
  unsubscribed_categories: string[];
}

export interface ResubscribeResponse {
  message: string;
}

export class EmailPreferencesApi {
  private static readonly BASE_PATH = '/api/v2/external/email-preferences';

  /**
   * Gets the authenticated user's email preferences
   * @param token JWT token from Supabase session
   * @returns Email preferences object
   */
  static async getEmailPreferences(token: string): Promise<EmailPreferences> {
    const url = buildApiUrl(`${this.BASE_PATH}/`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to fetch email preferences');
    }

    return await response.json();
  }

  /**
   * Updates the authenticated user's email preferences
   * @param token JWT token from Supabase session
   * @param preferences Email preferences to update
   * @returns Updated preferences and success message
   */
  static async updateEmailPreferences(
    token: string,
    preferences: EmailPreferences
  ): Promise<UpdateEmailPreferencesResponse> {
    const url = buildApiUrl(`${this.BASE_PATH}/`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferences),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to update email preferences');
    }

    return await response.json();
  }

  /**
   * Unsubscribes a user from email categories without authentication
   * Used by the unsubscribe link in emails
   * @param email User's email address
   * @param categories Array of category strings to unsubscribe from
   * @returns Unsubscribe confirmation
   */
  static async unsubscribe(
    email: string,
    categories: string[]
  ): Promise<UnsubscribeResponse> {
    const url = buildApiUrl(`${this.BASE_PATH}/unsubscribe`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, categories }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to unsubscribe');
    }

    return await response.json();
  }

  /**
   * Resubscribes the authenticated user to all email categories
   * @param token JWT token from Supabase session
   * @returns Resubscribe confirmation
   */
  static async resubscribe(token: string): Promise<ResubscribeResponse> {
    const url = buildApiUrl(`${this.BASE_PATH}/resubscribe`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to resubscribe');
    }

    return await response.json();
  }
}
