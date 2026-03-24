import OpenAI from 'openai'
import { getServiceClient } from '@/lib/db/client'
import { decrypt, encrypt } from '@/lib/utils/security'
import { logger } from '@/lib/utils/logger'

export async function getOpenAIClient(ownerId?: string): Promise<OpenAI> {
  // 1. Try user's stored credentials first
  if (ownerId) {
    const supabase = getServiceClient()
    const { data: settings } = await supabase
      .from('ai_settings')
      .select('openai_api_key_enc, openai_api_key_iv, openai_token_expires, openai_refresh_token_enc, openai_refresh_token_iv')
      .eq('owner_id', ownerId)
      .maybeSingle()

    if (settings?.openai_api_key_enc) {
      try {
        // Check if token needs refresh (within 5 min of expiry)
        if (settings.openai_token_expires && settings.openai_refresh_token_enc) {
          const expiresAt = new Date(settings.openai_token_expires)
          const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)
          if (expiresAt < fiveMinFromNow) {
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
        logger.error({ err }, 'Failed to decrypt user AI key')
        // Don't fall through to server key — this user HAS a key but it failed
      }
    }
  }

  // 2. Fall back to server env key
  const serverKey = process.env.OPENAI_API_KEY
  if (serverKey) {
    return new OpenAI({ apiKey: serverKey, maxRetries: 3, timeout: 30_000 })
  }

  // 3. No key available anywhere
  throw new Error('No AI credentials available. Connect ChatGPT in Settings or set OPENAI_API_KEY.')
}

// Backward compat — lazy getter that checks env at call time, not module load
export function getServerOpenAIClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')
  return new OpenAI({ apiKey: key, maxRetries: 3, timeout: 30_000 })
}

export const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'
