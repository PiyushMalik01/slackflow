import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { upsertRole, updateRole, deleteRole, seedDefaultCategories, getCompanyName } from '@/lib/db/queries'
import { generateInviteToken } from '@/lib/telegram/commands'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  telegram_chat_id: z.string().max(50).optional().nullable(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  type: z.string().min(1).max(50).optional(),
  telegram_chat_id: z.string().max(50).optional().nullable(),
})

export async function POST(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const contentType = req.headers.get('content-type') ?? ''
    let rawBody: Record<string, unknown>

    if (contentType.includes('application/json')) {
      rawBody = await req.json()
    } else {
      const formData = await req.formData()
      rawBody = {
        name: String(formData.get('name') ?? '').trim() || undefined,
        type: String(formData.get('type') ?? '').trim() || undefined,
        telegram_chat_id: String(formData.get('telegram_chat_id') ?? '').trim() || null,
      }
    }

    const parsed = createSchema.safeParse(rawBody)
    if (!parsed.success) return json400(parsed.error.issues[0]?.message || 'Invalid input')

    const role = await upsertRole({
      owner_id: user.id,
      name: parsed.data.name,
      type: parsed.data.type || 'BUILDER',
      telegram_chat_id: parsed.data.telegram_chat_id || null,
      status: 'pending_link',
    })

    // Idempotently seed default categories for this user
    await seedDefaultCategories(user.id)

    // Generate an invite token for the new role
    const svc = getServiceClient()
    const token = generateInviteToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { data: inviteToken } = await svc
      .from('invite_tokens')
      .insert({ role_id: role.id, token, expires_at: expiresAt })
      .select()
      .single()

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'SlackFlowBot'
    const deepLink = inviteToken ? `https://t.me/${botUsername}?start=${token}` : null

    if (!contentType.includes('application/json')) {
      return NextResponse.redirect(new URL('/dashboard/settings', req.url))
    }

    return jsonOk({ ...role, invite_token: inviteToken, deep_link: deepLink }, 201)
  } catch {
    return json500()
  }
}

export async function PUT(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return json400(parsed.error.issues[0]?.message || 'Invalid input')

    const { id, ...data } = parsed.data

    await updateRole(id, user.id, { ...data, telegram_chat_id: data.telegram_chat_id || null })
    return jsonOk({ success: true })
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

    // Before deleting, notify the member if they have a linked Telegram
    const svc = getServiceClient()
    const { data: role } = await svc
      .from('roles')
      .select('telegram_chat_id, name')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (role?.telegram_chat_id) {
      try {
        const companyName = await getCompanyName(user.id)
        const { bot } = await import('@/lib/telegram/bot')
        await bot.sendMessage(
          role.telegram_chat_id,
          `You have been removed from ${companyName}'s team on SlackFlow. You will no longer receive task notifications.`,
        )
      } catch { /* ignore send errors */ }
    }

    await deleteRole(id, user.id)
    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
