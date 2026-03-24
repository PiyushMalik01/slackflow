/**
 * OpenAI disconnect endpoint.
 *
 * POST /api/auth/openai/disconnect
 *
 * Removes all OpenAI-related credentials from the user's ai_settings.
 *
 * @module app/api/auth/openai/disconnect/route
 */

import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json401, json500 } from '@/lib/utils/api-helpers'

export async function POST(request: Request) {
  if (!(await validateOrigin())) return json401()

  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const svc = getServiceClient()
    await svc.from('ai_settings').update({
      openai_api_key_enc: null,
      openai_api_key_iv: null,
      openai_refresh_token_enc: null,
      openai_refresh_token_iv: null,
      openai_email: null,
      openai_plan_type: null,
      openai_auth_method: null,
      openai_connected_at: null,
      openai_token_expires: null,
      updated_at: new Date().toISOString(),
    }).eq('owner_id', user.id)

    return jsonOk({ success: true })
  } catch (error) {
    console.error('OpenAI disconnect error:', error)
    return json500()
  }
}
