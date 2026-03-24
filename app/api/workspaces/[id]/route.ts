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
    // Verify ownership
    const { data: ws } = await svc.from('workspaces').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle()
    if (!ws) return json403('Workspace not found')

    // Delete workspace (cascades to tasks, workspace_roles, activity_log, etc.)
    await svc.from('workspaces').delete().eq('id', id)

    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
