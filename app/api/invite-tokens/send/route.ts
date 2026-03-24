import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { generateInviteToken } from '@/lib/telegram/commands'
import { bot } from '@/lib/telegram/bot'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'
import { logger } from '@/lib/utils/logger'

const sendSchema = z.object({
  role_id: z.string().uuid(),
  telegram_username: z.string().min(1).max(100),
})

export async function POST(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const body = await req.json()
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) return json400(parsed.error.issues[0]?.message || 'Invalid input')

    // Verify role belongs to user
    const svc = getServiceClient()
    const { data: role } = await svc.from('roles').select('id, name, owner_id').eq('id', parsed.data.role_id).maybeSingle()
    if (!role || role.owner_id !== user.id) return json403('Role not found')

    // Generate invite token
    const token = generateInviteToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data: inviteToken, error } = await svc
      .from('invite_tokens')
      .insert({ role_id: parsed.data.role_id, token, expires_at: expiresAt })
      .select()
      .single()

    if (error) throw error

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'SlackFlow_bot'
    const deepLink = `https://t.me/${botUsername}?start=${token}`

    // Try to send the invite directly via Telegram
    // Telegram Bot API can't send messages by username — we need chat_id
    // But we CAN use the deep link approach: send the user a message IF we know their chat_id
    // For username-based invite, we'll try to resolve via bot's getChat
    let sent = false
    let telegramError = ''

    const username = parsed.data.telegram_username.replace(/^@/, '') // strip @ if present

    try {
      // Try sending directly using @username (works if user has messaged the bot before)
      await bot.sendMessage(`@${username}`,
        `You've been invited to join <b>${role.name}</b> on SlackFlow!\n\n` +
        `Click the link below to accept:\n${deepLink}`,
        { parse_mode: 'HTML' }
      )
      sent = true
    } catch (err: any) {
      // Telegram can't message users who haven't started the bot
      // This is a Telegram limitation — fall back to link sharing
      telegramError = err?.response?.body?.description || err?.message || 'Could not send direct message'
      logger.warn({ username, err: telegramError }, 'Could not send Telegram invite directly')
    }

    return jsonOk({
      ...inviteToken,
      deep_link: deepLink,
      sent_directly: sent,
      telegram_error: sent ? undefined : telegramError,
    }, 201)
  } catch (err) {
    logger.error({ err }, 'Failed to send invite')
    return json500()
  }
}
