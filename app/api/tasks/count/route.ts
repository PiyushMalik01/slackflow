import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { listWorkspacesForUser } from '@/lib/db/queries'
import { jsonOk, json401 } from '@/lib/utils/api-helpers'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  const cookieStore = await cookies()
  const selectedWorkspace = cookieStore.get('selected_workspace')?.value || null

  const svc = getServiceClient()

  let workspaceIds: string[]
  if (selectedWorkspace) {
    workspaceIds = [selectedWorkspace]
  } else {
    const workspaces = await listWorkspacesForUser(user.id).catch(() => [])
    workspaceIds = workspaces.map((w: any) => w.id)
  }

  if (workspaceIds.length === 0) {
    return jsonOk({ count: 0 })
  }

  const { count } = await svc
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .in('workspace_id', workspaceIds)
    .in('status', ['pending', 'draft_ready'])

  return jsonOk({ count: count || 0 })
}
