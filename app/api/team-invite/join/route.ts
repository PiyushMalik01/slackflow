import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/db/client'
import { generateInviteToken } from '@/lib/telegram/commands'
import { jsonOk, json400, json403, json500 } from '@/lib/utils/api-helpers'

const joinSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(100),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = joinSchema.safeParse(body)
    if (!parsed.success) return json400('Invalid input')

    const svc = getServiceClient()

    // Validate the invite link
    const { data: invite } = await svc
      .from('team_invite_links')
      .select('*')
      .eq('code', parsed.data.code)
      .eq('is_active', true)
      .maybeSingle()

    if (!invite) return json403('Invalid or inactive invite link')
    if (invite.join_count >= invite.max_joins) return json403('Invite link has reached maximum joins')

    // Create the role under the link owner
    const { data: role, error: roleError } = await svc
      .from('roles')
      .insert({
        owner_id: invite.owner_id,
        name: parsed.data.name,
        type: parsed.data.type,
        status: 'pending_link',
      })
      .select()
      .single()

    if (roleError) return json500()

    // Generate a Telegram invite token for this role
    const token = generateInviteToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days for self-service

    await svc.from('invite_tokens').insert({
      role_id: role.id,
      token,
      expires_at: expiresAt,
    })

    // Increment join count
    await svc.from('team_invite_links').update({
      join_count: invite.join_count + 1,
    }).eq('id', invite.id)

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'SlackFlowBot'
    const telegramLink = `https://t.me/${botUsername}?start=${token}`

    return jsonOk({
      success: true,
      role_id: role.id,
      telegram_link: telegramLink,
    })
  } catch {
    return json500()
  }
}
