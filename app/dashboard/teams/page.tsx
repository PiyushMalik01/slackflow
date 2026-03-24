import { getAuthUser, getServiceClient } from '@/lib/db/client'
import { getCategories } from '@/lib/db/queries'
import { TeamsClient } from '@/components/teams-interactive'

export const metadata = { title: 'Teams' }

export default async function TeamsPage() {
  // Layout already validates auth and redirects — just get user ID for queries
  const user = await getAuthUser()

  const svc = getServiceClient()

  // Parallelize independent queries
  const [{ data: roles }, { data: workspaces }, categories] = await Promise.all([
    svc
      .from('roles')
      .select('*, invite_tokens(token, expires_at, used_at)')
      .eq('owner_id', user!.id)
      .order('created_at'),
    svc
      .from('workspaces')
      .select('id, name')
      .eq('owner_id', user!.id),
    getCategories(user!.id),
  ])

  // Load workspace role mappings (depends on workspaces result)
  const wsIds = (workspaces || []).map((w: { id: string }) => w.id)
  const { data: workspaceRoles } = wsIds.length > 0
    ? await svc.from('workspace_roles').select('*').in('workspace_id', wsIds)
    : { data: [] }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <p className="text-muted-foreground">Manage team members and task routing.</p>
      </div>
      <TeamsClient
        initialRoles={roles || []}
        workspaces={workspaces || []}
        workspaceRoles={workspaceRoles || []}
        categories={categories || []}
      />
    </div>
  )
}
