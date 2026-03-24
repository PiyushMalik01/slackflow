/**
 * OpenAI Device Code Flow polling endpoint.
 *
 * POST /api/auth/openai/poll
 *
 * The client calls this repeatedly (every 5s) after initiating the device code flow.
 * When the user completes authentication on auth.openai.com, this endpoint:
 * 1. Polls OpenAI's device token endpoint.
 * 2. Exchanges the authorization code for OAuth tokens.
 * 3. Stores the encrypted access_token + refresh_token in ai_settings.
 *
 * @module app/api/auth/openai/poll/route
 */

import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json500 } from '@/lib/utils/api-helpers'
import { encrypt } from '@/lib/utils/security'
import {
  pollDeviceToken,
  exchangeDeviceCodeForTokens,
  parseOpenAIAuthClaims,
} from '@/lib/ai/openai-oauth'

export async function POST(request: Request) {
  if (!(await validateOrigin())) return json401()

  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const body = await request.json()
    const { deviceAuthId, userCode } = body

    if (!deviceAuthId || !userCode) {
      return json400('deviceAuthId and userCode are required.')
    }

    // Poll OpenAI's device token endpoint
    const result = await pollDeviceToken(deviceAuthId, userCode)

    if (result.status === 'pending') {
      return jsonOk({ status: 'pending' })
    }

    if (result.status === 'expired') {
      return jsonOk({ status: 'expired', message: 'Device code expired. Please try again.' })
    }

    // -- Authorized: exchange for tokens --
    const { authorizationCode, codeVerifier } = result

    if (!authorizationCode || !codeVerifier) {
      return json500()
    }

    try {
      const tokens = await exchangeDeviceCodeForTokens(authorizationCode, codeVerifier)

      // Extract claims from JWT
      const claims = parseOpenAIAuthClaims(tokens.idToken)
      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString()

      // Encrypt tokens
      const apiKeyEnc = encrypt(tokens.accessToken)
      const refreshEnc = encrypt(tokens.refreshToken)

      const svc = getServiceClient()
      await svc.from('ai_settings').upsert({
        owner_id: user.id,
        openai_api_key_enc: apiKeyEnc.enc,
        openai_api_key_iv: apiKeyEnc.iv,
        openai_refresh_token_enc: refreshEnc.enc,
        openai_refresh_token_iv: refreshEnc.iv,
        openai_email: (claims.email as string) || null,
        openai_plan_type: (claims.chatgpt_plan_type as string) || null,
        openai_auth_method: 'oauth-device',
        openai_connected_at: new Date().toISOString(),
        openai_token_expires: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_id' })

      return jsonOk({
        status: 'connected',
        email: (claims.email as string) || null,
        planType: (claims.chatgpt_plan_type as string) || null,
      })
    } catch (exchangeError) {
      console.error('[OpenAI Poll] Exchange chain failed:', exchangeError)
      return jsonOk({
        status: 'exchange_failed',
        message: exchangeError instanceof Error ? exchangeError.message : 'Token exchange failed. Please try again.',
      })
    }
  } catch (error) {
    console.error('OpenAI device poll error:', error)
    return json500()
  }
}
