import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/db/client'
import {
  listWorkspacesForUser,
  listRolesForUser,
  getWorkspaceRoles,
} from '@/lib/db/queries'
import { Settings } from 'lucide-react'
import { RoleList, WorkspaceRoleSelect, RoleTypeInput, WorkspaceCategoryList } from '@/components/settings-interactive'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [workspaces, roles] = await Promise.all([
    listWorkspacesForUser(user.id).catch(() => []),
    listRolesForUser(user.id).catch(() => []),
  ])

  // Get role mappings for each workspace
  const workspaceRoles = await Promise.all(
    workspaces.map(async (ws) => ({
      workspace: ws,
      mappings: await getWorkspaceRoles(ws.id).catch(() => []),
    }))
  )

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure role routing and notifications</p>
      </div>

      {/* Create role section */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold mb-4">Team Roles</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Roles define who gets notified on Telegram for each message category.
          Each role needs a Telegram chat ID (send <code className="bg-muted px-1 rounded">/start</code> to your bot to get yours).
        </p>

        {/* Role list */}
        <RoleList initialRoles={roles} />

        {/* Create role form */}
        <form action="/api/roles" method="POST" className="space-y-3">
          <input type="hidden" name="owner_id" value={user.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Role name</label>
              <input
                name="name"
                placeholder="e.g. Alice, Bob, Front-end Team"
                required
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <RoleTypeInput />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Telegram Chat ID</label>
            <input
              name="telegram_chat_id"
              placeholder="e.g. 123456789"
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Get your chat ID by sending <code className="bg-muted px-1 rounded">/start</code> to{' '}
              <code className="bg-muted px-1 rounded">@userinfobot</code> on Telegram.
            </p>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors"
          >
            Create role
          </button>
        </form>
      </div>

      {/* Workspace role mapping */}
      {workspaceRoles.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold mb-2">Route categories to roles</h2>
          <p className="text-sm text-muted-foreground mb-5">
            For each workspace, choose which role receives BUG, FEATURE, and GENERAL messages.
          </p>
          <div className="space-y-6">
            {workspaceRoles.map(({ workspace, mappings }) => {
              const getMappedRole = (category: string) =>
                mappings.find((m) => m.category === category)
              return (
                <div key={workspace.id} className="border border-border rounded-lg p-4">
                  <h3 className="font-medium text-sm mb-4">{workspace.name}</h3>
                  <WorkspaceCategoryList workspaceId={workspace.id} initialMappings={mappings} roles={roles} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {workspaces.length === 0 && roles.length === 0 && (
        <div className="bg-card border border-border rounded-xl py-12 text-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Connect a workspace first to configure routing.</p>
        </div>
      )}
    </div>
  )
}
