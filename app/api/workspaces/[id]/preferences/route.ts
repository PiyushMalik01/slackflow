import { NextRequest } from 'next/server'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  const { id } = await params

  let body: { accent_color?: string; team_group_chat_id?: string | null; daily_digest_time?: string | null }
  try {
    body = await req.json()
  } catch {
    return json400('Invalid JSON')
  }

  const svc = getServiceClient()

  // Verify ownership
  const { data: workspace } = await svc
    .from('workspaces')
    .select('id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) return json403('Workspace not found')

  const updateData: Record<string, unknown> = {}
  if (body.accent_color !== undefined) updateData.accent_color = body.accent_color
  if (body.team_group_chat_id !== undefined) updateData.team_group_chat_id = body.team_group_chat_id
  if (body.daily_digest_time !== undefined) updateData.daily_digest_time = body.daily_digest_time

  if (Object.keys(updateData).length === 0) {
    return json400('No fields to update')
  }

  try {
    const { error } = await svc
      .from('workspaces')
      .update(updateData)
      .eq('id', id)

    if (error) return json500()
    return jsonOk({ ok: true })
  } catch {
    return json500()
  }
}
