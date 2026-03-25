import { getAuthUser, getServiceClient } from '@/lib/db/client'
import { getCategories, listWorkspacesForUser } from '@/lib/db/queries'
import { TeamsClient } from '@/components/teams-interactive'
import { GuideTip } from '@/components/guide-tip'

export const metadata = { title: 'Teams' }

export default async function TeamsPage() {
  // Layout already validates auth and redirects — just get user ID for queries
  const user = await getAuthUser()

  const svc = getServiceClient()

  // Parallelize independent queries
  const [{ data: roles }, workspacesFull, categories] = await Promise.all([
    svc
      .from('roles')
      .select('*, invite_tokens(token, expires_at, used_at)')
      .eq('owner_id', user!.id)
      .order('created_at'),
    listWorkspacesForUser(user!.id),
    getCategories(user!.id),
  ])
  const workspaces = workspacesFull.map(w => ({ id: w.id, name: w.name }))

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
      {/* Contextual guide tips */}
      {!roles || roles.length === 0 ? (
        <GuideTip
          id="teams-no-roles"
          title="Add team members"
          description="Add team members who will receive task notifications on Telegram. Share invite links via QR code, WhatsApp, or email."
        />
      ) : roles.some((r: any) => r.status !== 'linked') && (
        <GuideTip
          id="teams-unlinked-members"
          title="Team members haven't connected yet"
          description="Share their invite links so they can link their Telegram account and start receiving notifications."
        />
      )}

      <TeamsClient
        initialRoles={roles || []}
        workspaces={workspaces || []}
        workspaceRoles={workspaceRoles || []}
        categories={categories || []}
      />
    </div>
  )
}
