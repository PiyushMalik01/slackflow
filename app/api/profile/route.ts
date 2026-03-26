import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

const updateSchema = z.object({
  company_name: z.string().max(200).optional(),
  display_name: z.string().max(200).optional(),
})

export async function GET() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const svc = getServiceClient()

    // Try to get existing profile
    let { data: profile } = await svc
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // Auto-create if doesn't exist
    if (!profile) {
      const { data: created } = await svc
        .from('user_profiles')
        .insert({ user_id: user.id, display_name: '', company_name: '' })
        .select()
        .single()
      profile = created
    }

    return jsonOk({ profile, email: user.email })
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

    const svc = getServiceClient()

    // Upsert profile
    const { data: profile, error } = await svc
      .from('user_profiles')
      .upsert(
        {
          user_id: user.id,
          ...parsed.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) return json500()

    return jsonOk({ profile })
  } catch {
    return json500()
  }
}

export async function DELETE() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const svc = getServiceClient()

    // Delete in order (cascade handles most, but be explicit)
    await svc.from('user_profiles').delete().eq('user_id', user.id)
    await svc.from('ai_settings').delete().eq('owner_id', user.id)
    await svc.from('workspace_members').delete().eq('user_id', user.id)
    // Roles cascade to invite_tokens and workspace_roles
    await svc.from('roles').delete().eq('owner_id', user.id)
    await svc.from('categories').delete().eq('owner_id', user.id)
    // Workspaces owned by this user where no other members exist
    const { data: ownedWs } = await svc.from('workspaces').select('id').eq('owner_id', user.id)
    for (const ws of ownedWs || []) {
      const { data: otherMembers } = await svc.from('workspace_members').select('user_id').eq('workspace_id', ws.id)
      if (!otherMembers || otherMembers.length === 0) {
        await svc.from('workspaces').delete().eq('id', ws.id)
      }
    }
    // Finally delete the auth user
    await svc.auth.admin.deleteUser(user.id)

    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
