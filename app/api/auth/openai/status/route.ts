/**
 * OpenAI connection status endpoint.
 *
 * GET /api/auth/openai/status
 *
 * Returns whether the authenticated user has a connected ChatGPT account.
 *
 * @module app/api/auth/openai/status/route
 */

import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { jsonOk, json401, json500 } from '@/lib/utils/api-helpers'

export async function GET() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const svc = getServiceClient()
    const { data: settings } = await svc
      .from('ai_settings')
      .select('openai_api_key_enc, openai_email, openai_plan_type, openai_auth_method, openai_connected_at')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (settings?.openai_api_key_enc) {
      return jsonOk({
        connected: true,
        email: settings.openai_email || null,
        planType: settings.openai_plan_type || null,
        authMethod: settings.openai_auth_method || 'api-key',
        connectedAt: settings.openai_connected_at || null,
      })
    }

    return jsonOk({ connected: false })
  } catch (error) {
    console.error('OpenAI status check error:', error)
    return json500()
  }
}
