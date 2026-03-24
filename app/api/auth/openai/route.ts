/**
 * OpenAI connection endpoint.
 *
 * POST /api/auth/openai
 *
 * Two modes:
 * - `{ mode: "device-code" }` — Initiates the device code flow.
 * - `{ mode: "api-key", apiKey: "sk-..." }` — Manual API key entry.
 *
 * @module app/api/auth/openai/route
 */

import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json500 } from '@/lib/utils/api-helpers'
import { encrypt } from '@/lib/utils/security'
import { requestDeviceCode, validateOpenAIKey } from '@/lib/ai/openai-oauth'

export async function POST(request: Request) {
  if (!(await validateOrigin())) return json401()

  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const body = await request.json()

    // -- Device Code Flow --
    if (body.mode === 'device-code') {
      const deviceCode = await requestDeviceCode()

      // Store device auth session in a temporary table (or we use in-memory via the client polling pattern)
      // For simplicity we return the session data to the client which will poll with it
      const svc = getServiceClient()

      // Upsert a pending device session into ai_settings
      await svc.from('ai_settings').upsert({
        owner_id: user.id,
        openai_auth_method: null as unknown as string,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_id' })

      return jsonOk({
        flow: 'device-code',
        deviceAuthId: deviceCode.deviceAuthId,
        userCode: deviceCode.userCode,
        verificationUrl: deviceCode.verificationUrl,
        expiresIn: deviceCode.expiresIn,
        interval: deviceCode.interval,
      })
    }

    // -- Manual API Key Mode --
    if (body.mode === 'api-key') {
      const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''

      if (!apiKey) {
        return json400('API key is required.')
      }

      const validation = await validateOpenAIKey(apiKey)
      if (!validation.valid) {
        return json400(validation.error || 'Invalid API key')
      }

      const { enc, iv } = encrypt(apiKey)
      const svc = getServiceClient()

      await svc.from('ai_settings').upsert({
        owner_id: user.id,
        openai_api_key_enc: enc,
        openai_api_key_iv: iv,
        openai_refresh_token_enc: null,
        openai_refresh_token_iv: null,
        openai_email: null,
        openai_plan_type: null,
        openai_auth_method: 'api-key',
        openai_connected_at: new Date().toISOString(),
        openai_token_expires: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_id' })

      return jsonOk({ message: 'OpenAI API key connected successfully.' })
    }

    return json400('Invalid mode. Use "device-code" or "api-key".')
  } catch (error) {
    console.error('OpenAI connect error:', error)
    return json500()
  }
}
