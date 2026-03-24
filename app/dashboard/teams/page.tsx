import { redirect } from 'next/navigation'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { getCategories } from '@/lib/db/queries'
import { TeamsClient } from '@/components/teams-interactive'

export const metadata = { title: 'Teams' }

export default async function TeamsPage() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = getServiceClient()

  // Load roles with invite tokens
  const { data: roles } = await svc
    .from('roles')
    .select('*, invite_tokens(token, expires_at, used_at)')
    .eq('owner_id', user.id)
    .order('created_at')

  // Load workspaces
  const { data: workspaces } = await svc
    .from('workspaces')
    .select('id, name')
    .eq('owner_id', user.id)

  // Load workspace role mappings (scoped to user's workspaces)
  const wsIds = (workspaces || []).map((w: { id: string }) => w.id)
  const { data: workspaceRoles } = wsIds.length > 0
    ? await svc.from('workspace_roles').select('*').in('workspace_id', wsIds)
    : { data: [] }

  // Load categories for routing tab
  const categories = await getCategories(user.id)

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
