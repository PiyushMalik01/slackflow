import { getServiceClient } from '@/lib/db/client'

export async function checkAndIncrementRateLimit(
  key: string,
  maxCount: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const db = getServiceClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowMs)

  const { data } = await db.from('rate_limits').select('*').eq('key', key).single()

  if (!data || new Date(data.window_start) < windowStart) {
    await db.from('rate_limits').upsert(
      { key, count: 1, window_start: now.toISOString() },
      { onConflict: 'key' }
    )
    return { allowed: true, remaining: maxCount - 1 }
  }

  if (data.count >= maxCount) {
    return { allowed: false, remaining: 0 }
  }

  await db.from('rate_limits').update({ count: data.count + 1 }).eq('key', key)
  return { allowed: true, remaining: maxCount - data.count - 1 }
}

export const RATE_LIMITS = {
  slackInstall: { maxCount: 5, windowMs: 60 * 60 * 1000 },
  slackEvents: { maxCount: 60, windowMs: 60 * 1000 },
  telegramWebhook: { maxCount: 100, windowMs: 60 * 1000 },
  apiMutation: { maxCount: 30, windowMs: 60 * 1000 },
  aiDraft: { maxCount: 30, windowMs: 60 * 1000 },
} as const
