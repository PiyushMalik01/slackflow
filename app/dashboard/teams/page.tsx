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
  const [{ data: myRoles }, workspacesFull, categories] = await Promise.all([
    svc
      .from('roles')
      .select('*, invite_tokens(token, expires_at, used_at)')
      .eq('owner_id', user!.id)
      .order('created_at'),
    listWorkspacesForUser(user!.id),
    getCategories(user!.id),
  ])
  const workspaces = workspacesFull.map(w => ({ id: w.id, name: w.name, owner_id: w.owner_id }))

  // For shared workspaces: load workspace owner's categories and roles for routing tab
  const ownerIds = [...new Set(workspaces.map((w: any) => w.owner_id))]
  const workspaceCategoryMap: Record<string, any[]> = {}
  const workspaceRolesMap: Record<string, any[]> = {}
  await Promise.all(ownerIds.map(async (oid: string) => {
    const [ownerCats, { data: ownerRoles }] = await Promise.all([
      getCategories(oid),
      svc.from('roles').select('*, invite_tokens(token, expires_at, used_at)').eq('owner_id', oid).order('created_at'),
    ])
    // Map categories and roles to each workspace owned by this user
    for (const ws of workspaces) {
      if (ws.owner_id === oid) {
        workspaceCategoryMap[ws.id] = ownerCats
        workspaceRolesMap[ws.id] = ownerRoles || []
      }
    }
  }))

  // Build combined roles list: user's own roles + all roles visible via shared workspaces
  // This lets the Members tab show ALL team members the user can see
  const allVisibleRoles: any[] = [...(myRoles || [])]
  const seenRoleIds = new Set(allVisibleRoles.map(r => r.id))

  for (const oid of ownerIds) {
    if (oid === user!.id) continue // already have our own
    const rolesForOwner = workspaceRolesMap[workspaces.find(w => w.owner_id === oid)?.id || ''] || []
    for (const r of rolesForOwner) {
      if (!seenRoleIds.has(r.id)) {
        seenRoleIds.add(r.id)
        allVisibleRoles.push({ ...r, _shared_from: oid })
      }
    }
  }

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
      {!myRoles || myRoles.length === 0 ? (
        <GuideTip
          id="teams-no-roles"
          title="Add team members"
          description="Add team members who will receive task notifications on Telegram. Share invite links via QR code, WhatsApp, or email."
        />
      ) : myRoles.some((r: any) => r.status !== 'linked') && (
        <GuideTip
          id="teams-unlinked-members"
          title="Team members haven't connected yet"
          description="Share their invite links so they can link their Telegram account and start receiving notifications."
        />
      )}

      <TeamsClient
        initialRoles={allVisibleRoles}
        workspaces={workspaces || []}
        workspaceRoles={workspaceRoles || []}
        categories={categories || []}
        workspaceCategoryMap={workspaceCategoryMap}
        workspaceRolesMap={workspaceRolesMap}
      />
    </div>
  )
}
