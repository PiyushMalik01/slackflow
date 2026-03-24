import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { getCategories, seedDefaultCategories } from '@/lib/db/queries'
import { SettingsClient } from '@/components/settings-interactive'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  // Layout already validates auth and redirects — just get user ID for queries
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  const svc = getServiceClient()

  // Parallelize initial loads
  let [categories, { data: workspaces }] = await Promise.all([
    getCategories(user!.id),
    svc
      .from('workspaces')
      .select('id, name, accent_color, team_group_chat_id, daily_digest_time')
      .eq('owner_id', user!.id),
  ])

  // Seed defaults if empty (sequential — depends on categories result)
  if (categories.length === 0) {
    await seedDefaultCategories(user!.id)
    categories = await getCategories(user!.id)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage categories and platform preferences.</p>
      </div>
      <SettingsClient
        initialCategories={categories || []}
        workspaces={workspaces || []}
      />
    </div>
  )
}
