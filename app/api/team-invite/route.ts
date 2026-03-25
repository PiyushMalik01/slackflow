import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json401, json403, json500 } from '@/lib/utils/api-helpers'

function generateCode(): string {
  return crypto.randomBytes(8).toString('base64url')
}

export async function GET(_req: NextRequest) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const svc = getServiceClient()

    // Check for existing link
    const { data: existing } = await svc
      .from('team_invite_links')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (existing) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://slackflow.app'
      return jsonOk({
        code: existing.code,
        url: `${appUrl}/join/${existing.code}`,
        is_active: existing.is_active,
        join_count: existing.join_count,
        max_joins: existing.max_joins,
      })
    }

    // Generate new link
    const code = generateCode()
    const { data: newLink, error } = await svc
      .from('team_invite_links')
      .insert({ owner_id: user.id, code })
      .select()
      .single()

    if (error) return json500()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://slackflow.app'
    return jsonOk({
      code: newLink.code,
      url: `${appUrl}/join/${newLink.code}`,
      is_active: newLink.is_active,
      join_count: newLink.join_count,
      max_joins: newLink.max_joins,
    })
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
    const { action } = await req.json()
    const svc = getServiceClient()

    const { data: existing } = await svc
      .from('team_invite_links')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!existing) return json403('No invite link found')

    if (action === 'regenerate') {
      const code = generateCode()
      const { data: updated, error } = await svc
        .from('team_invite_links')
        .update({ code, join_count: 0 })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) return json500()

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://slackflow.app'
      return jsonOk({
        code: updated.code,
        url: `${appUrl}/join/${updated.code}`,
        is_active: updated.is_active,
        join_count: updated.join_count,
        max_joins: updated.max_joins,
      })
    }

    if (action === 'toggle') {
      const { data: updated, error } = await svc
        .from('team_invite_links')
        .update({ is_active: !existing.is_active })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) return json500()

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://slackflow.app'
      return jsonOk({
        code: updated.code,
        url: `${appUrl}/join/${updated.code}`,
        is_active: updated.is_active,
        join_count: updated.join_count,
        max_joins: updated.max_joins,
      })
    }

    return json403('Invalid action')
  } catch {
    return json500()
  }
}
