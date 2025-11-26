/**
 * MFA Service
 *
 * Service for managing Multi-Factor Authentication using TOTP.
 * Integrates with backend API at /api/v2/external/mfa/
 */

import { buildApiUrl } from '../lib/api'

export interface MFAEnrollmentData {
  secret: string
  qr_code: string
  backup_codes: string[]
}

export interface MFAStatus {
  enabled: boolean
  enrolled_at?: string
}

export interface MFAVerifyResponse {
  success: boolean
  message: string
  remaining_backup_codes?: number
}

export interface MFARegenerateResponse {
  success: boolean
  message: string
  backup_codes: string[]
}

export class MFAService {
  /**
   * Start MFA enrollment and get QR code
   * @param jwtToken - User's JWT token
   * @returns Enrollment data with QR code and backup codes
   */
  static async enroll(jwtToken: string): Promise<MFAEnrollmentData> {
    const response = await fetch(buildApiUrl('/api/v2/external/mfa/enroll'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to enroll in MFA' }))
      throw new Error(error.detail || 'Failed to enroll in MFA')
    }

    return response.json()
  }

  /**
   * Verify enrollment and activate MFA
   * @param jwtToken - User's JWT token
   * @param code - 6-digit TOTP code
   */
  static async verifyEnrollment(jwtToken: string, code: string): Promise<MFAVerifyResponse> {
    const response = await fetch(buildApiUrl('/api/v2/external/mfa/verify-enrollment'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to verify MFA code' }))
      throw new Error(error.detail || 'Failed to verify MFA code')
    }

    return response.json()
  }

  /**
   * Verify MFA code during login
   * @param jwtToken - User's JWT token
   * @param code - 6-digit TOTP code or 8-character backup code
   */
  static async verify(jwtToken: string, code: string): Promise<MFAVerifyResponse> {
    const response = await fetch(buildApiUrl('/api/v2/external/mfa/verify'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Invalid verification code' }))
      throw new Error(error.detail || 'Invalid verification code')
    }

    return response.json()
  }

  /**
   * Check if MFA is enabled for the user
   * @param jwtToken - User's JWT token
   */
  static async getStatus(jwtToken: string): Promise<MFAStatus> {
    const response = await fetch(buildApiUrl('/api/v2/external/mfa/status'), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get MFA status' }))
      throw new Error(error.detail || 'Failed to get MFA status')
    }

    return response.json()
  }

  /**
   * Disable MFA for the user
   * @param jwtToken - User's JWT token
   * @param code - Current 6-digit TOTP code for verification
   */
  static async disable(jwtToken: string, code: string): Promise<MFAVerifyResponse> {
    const response = await fetch(buildApiUrl('/api/v2/external/mfa/disable'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to disable MFA' }))
      throw new Error(error.detail || 'Failed to disable MFA')
    }

    return response.json()
  }

  /**
   * Regenerate backup codes
   * @param jwtToken - User's JWT token
   * @param code - Current 6-digit TOTP code for verification
   */
  static async regenerateBackupCodes(
    jwtToken: string,
    code: string
  ): Promise<MFARegenerateResponse> {
    const response = await fetch(buildApiUrl('/api/v2/external/mfa/regenerate-backup-codes'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to regenerate backup codes' }))
      throw new Error(error.detail || 'Failed to regenerate backup codes')
    }

    return response.json()
  }
}
