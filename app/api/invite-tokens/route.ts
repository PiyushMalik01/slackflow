import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { generateInviteToken } from '@/lib/telegram/commands'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

const createSchema = z.object({
  role_id: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return json400('Invalid input')

    // Verify role belongs to user
    const svc = getServiceClient()
    const { data: role } = await svc.from('roles').select('id, owner_id').eq('id', parsed.data.role_id).maybeSingle()
    if (!role || role.owner_id !== user.id) return json403('Role not found')

    const token = generateInviteToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data: inviteToken, error } = await svc
      .from('invite_tokens')
      .insert({ role_id: parsed.data.role_id, token, expires_at: expiresAt })
      .select()
      .single()

    if (error) throw error

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'SlackFlowBot'
    const deepLink = `https://t.me/${botUsername}?start=${token}`

    return jsonOk({ ...inviteToken, deep_link: deepLink }, 201)
  } catch {
    return json500()
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return json400('Missing id')

    const svc = getServiceClient()
    await svc.from('invite_tokens').delete().eq('id', id)
    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
