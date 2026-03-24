import { redirect } from 'next/navigation'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { getCategories, seedDefaultCategories } from '@/lib/db/queries'
import { SettingsClient } from '@/components/settings-interactive'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = getServiceClient()

  // Load categories (seed defaults if empty)
  let categories = await getCategories(user.id)
  if (categories.length === 0) {
    await seedDefaultCategories(user.id)
    categories = await getCategories(user.id)
  }

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

  // Load workspace role mappings
  const { data: workspaceRoles } = await svc
    .from('workspace_roles')
    .select('*')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage categories, roles, and task routing.</p>
      </div>
      <SettingsClient
        initialCategories={categories || []}
        initialRoles={roles || []}
        workspaces={workspaces || []}
        workspaceRoles={workspaceRoles || []}
      />
    </div>
  )
}
