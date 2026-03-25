import { NextRequest } from 'next/server'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json401, json403, json500 } from '@/lib/utils/api-helpers'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  const { id } = await params

  try {
    const svc = getServiceClient()

    // Check if user is a member of this workspace
    const { data: membership } = await svc
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return json403('Not a member of this workspace')

    const { data: ws } = await svc
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', id)
      .maybeSingle()
    if (!ws) return json403('Workspace not found')

    if (ws.owner_id === user.id) {
      // Owner disconnecting — check for other members
      const { data: otherMembers } = await svc
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', id)
        .neq('user_id', user.id)

      if (otherMembers && otherMembers.length > 0) {
        // Transfer ownership to first other member
        await svc.from('workspaces').update({ owner_id: otherMembers[0].user_id }).eq('id', id)
        await svc.from('workspace_members').delete().eq('workspace_id', id).eq('user_id', user.id)
      } else {
        // No other members — delete everything (cascades to tasks, workspace_roles, activity_log, etc.)
        await svc.from('workspaces').delete().eq('id', id)
      }
    } else {
      // Just a member — remove membership
      await svc.from('workspace_members').delete().eq('workspace_id', id).eq('user_id', user.id)
    }

    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
