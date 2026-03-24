import OpenAI from 'openai'
import { getServiceClient } from '@/lib/db/client'
import { decrypt, encrypt } from '@/lib/utils/security'
import { logger } from '@/lib/utils/logger'

// Fallback server-side client (for when no user key is available)
const serverClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'not-set',
  maxRetries: 3,
  timeout: 30_000,
})

export async function getOpenAIClient(ownerId?: string): Promise<OpenAI> {
  if (!ownerId) return serverClient

  const supabase = getServiceClient()
  const { data: settings } = await supabase
    .from('ai_settings')
    .select('openai_api_key_enc, openai_api_key_iv, openai_token_expires, openai_refresh_token_enc, openai_refresh_token_iv')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!settings?.openai_api_key_enc) {
    // No user key — fall back to server key
    return serverClient
  }

  try {
    // Check if token needs refresh (within 5 min of expiry)
    if (settings.openai_token_expires) {
      const expiresAt = new Date(settings.openai_token_expires)
      const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)
      if (expiresAt < fiveMinFromNow && settings.openai_refresh_token_enc) {
        try {
          const refreshToken = decrypt(settings.openai_refresh_token_enc, settings.openai_refresh_token_iv!)
          const { refreshOAuthTokens } = await import('@/lib/ai/openai-oauth')
          const newTokens = await refreshOAuthTokens(refreshToken)
          if (newTokens?.accessToken) {
            const apiKeyEnc = encrypt(newTokens.accessToken)
            const refreshEnc = encrypt(newTokens.refreshToken)
            await supabase.from('ai_settings').update({
              openai_api_key_enc: apiKeyEnc.enc,
              openai_api_key_iv: apiKeyEnc.iv,
              openai_refresh_token_enc: refreshEnc.enc,
              openai_refresh_token_iv: refreshEnc.iv,
              openai_token_expires: new Date(Date.now() + newTokens.expiresIn * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('owner_id', ownerId)
            return new OpenAI({ apiKey: newTokens.accessToken, maxRetries: 3, timeout: 30_000 })
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to refresh OpenAI token, using existing key')
        }
      }
    }

    const apiKey = decrypt(settings.openai_api_key_enc, settings.openai_api_key_iv!)
    return new OpenAI({ apiKey, maxRetries: 3, timeout: 30_000 })
  } catch (err) {
    logger.error({ err }, 'Failed to decrypt user AI key, falling back to server key')
    return serverClient
  }
}

// Keep backward compat export for simple cases
export const openai = serverClient

export const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'
