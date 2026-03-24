/**
 * OpenAI Codex OAuth Device Code flow utilities.
 *
 * Adapted from the expense-tracker reference implementation.
 * Implements:
 * 1. Device code request (user enters code at auth.openai.com)
 * 2. Device token polling
 * 3. Authorization code -> OAuth token exchange
 * 4. Token refresh
 * 5. JWT claims parsing
 * 6. API key validation (manual entry fallback)
 *
 * @module lib/ai/openai-oauth
 */

import { createHash, randomBytes } from 'crypto'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** OpenAI Codex public client ID (same one used by Codex CLI, Roo Code, OpenClaw). */
export const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'

/** OpenAI auth endpoints. */
export const OPENAI_TOKEN_URL = 'https://auth.openai.com/oauth/token'

/** Device code flow endpoints. */
export const OPENAI_DEVICE_CODE_URL = 'https://auth.openai.com/api/accounts/deviceauth/usercode'
export const OPENAI_DEVICE_TOKEN_URL = 'https://auth.openai.com/api/accounts/deviceauth/token'
export const OPENAI_DEVICE_VERIFICATION_URL = 'https://auth.openai.com/codex/device'
export const OPENAI_DEVICE_CALLBACK_URI = 'https://auth.openai.com/deviceauth/callback'

/** OpenAI API base URL. */
export const OPENAI_API_BASE = 'https://api.openai.com/v1'

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/** Base64url-encode a buffer (no padding). */
function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OAuthTokens {
  accessToken: string
  idToken: string
  refreshToken: string
  expiresIn: number
}

export interface DeviceCodeResponse {
  deviceAuthId: string
  userCode: string
  verificationUrl: string
  expiresIn: number
  interval: number
}

export interface DeviceTokenPollResult {
  status: 'pending' | 'authorized' | 'expired'
  authorizationCode?: string
  codeVerifier?: string
}

// ---------------------------------------------------------------------------
// Device Code Flow (RFC 8628)
// ---------------------------------------------------------------------------

/**
 * Step 1: Request a device code from OpenAI.
 *
 * The user must visit the verification URL and enter the user code.
 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(OPENAI_DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CODEX_CLIENT_ID }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Device code request failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  return {
    deviceAuthId: data.device_auth_id,
    userCode: data.user_code || data.usercode,
    verificationUrl: OPENAI_DEVICE_VERIFICATION_URL,
    expiresIn: data.expires_in || 900,
    interval: typeof data.interval === 'string' ? parseInt(data.interval, 10) : (data.interval || 5),
  }
}

/**
 * Step 2: Poll for user authorization.
 *
 * Call this repeatedly (every 5s) until the user has entered the code.
 */
export async function pollDeviceToken(
  deviceAuthId: string,
  userCode: string
): Promise<DeviceTokenPollResult> {
  const response = await fetch(OPENAI_DEVICE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_auth_id: deviceAuthId,
      user_code: userCode,
    }),
  })

  // 403 or 404 = user hasn't authorized yet
  if (response.status === 403 || response.status === 404) {
    return { status: 'pending' }
  }

  // 410 = expired
  if (response.status === 410) {
    return { status: 'expired' }
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.warn(`[pollDeviceToken] Unexpected (${response.status}): ${errorText}`)
    return { status: 'pending' }
  }

  const data = await response.json()

  return {
    status: 'authorized',
    authorizationCode: data.authorization_code,
    codeVerifier: data.code_verifier,
  }
}

/**
 * Step 3: Exchange the device authorization code for OAuth tokens.
 */
export async function exchangeDeviceCodeForTokens(
  authorizationCode: string,
  codeVerifier: string
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: OPENAI_DEVICE_CALLBACK_URI,
    client_id: CODEX_CLIENT_ID,
    code_verifier: codeVerifier,
  })

  const response = await fetch(OPENAI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Device token exchange failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
  }
}

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

/**
 * Refresh OAuth tokens using a refresh_token.
 */
export async function refreshOAuthTokens(refreshToken: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CODEX_CLIENT_ID,
  })

  const response = await fetch(OPENAI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token refresh failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || 3600,
  }
}

// ---------------------------------------------------------------------------
// JWT claims parser (lightweight, no verification)
// ---------------------------------------------------------------------------

/**
 * Decode JWT claims without verification (we trust OpenAI's auth server).
 */
export function parseJWTClaims(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return {}
  }
}

/**
 * Parse OpenAI auth claims from a JWT, extracting nested auth claims.
 *
 * OpenAI nests auth-specific claims (chatgpt_account_id, chatgpt_plan_type, etc.)
 * under the `https://api.openai.com/auth` key in the JWT payload.
 */
export function parseOpenAIAuthClaims(token: string): Record<string, unknown> {
  const claims = parseJWTClaims(token)
  const nested = claims['https://api.openai.com/auth']
  if (nested && typeof nested === 'object') {
    return { ...claims, ...(nested as Record<string, unknown>) }
  }
  return claims
}

// ---------------------------------------------------------------------------
// API key validation (for manual key entry fallback)
// ---------------------------------------------------------------------------

/**
 * Validate an OpenAI API key by calling /v1/models.
 */
export async function validateOpenAIKey(
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return { valid: false, error: 'API key must start with "sk-"' }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    const response = await fetch(`${OPENAI_API_BASE}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      if (response.status === 401) return { valid: false, error: 'Invalid API key' }
      if (response.status === 429) return { valid: false, error: 'Rate limited — try again later' }
      const text = await response.text()
      return { valid: false, error: `OpenAI API error (${response.status}): ${text.slice(0, 200)}` }
    }

    return { valid: true }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { valid: false, error: 'Validation timed out' }
    }
    return { valid: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
