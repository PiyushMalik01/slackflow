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

  // Load workspaces for preferences tab
  const { data: workspaces } = await svc
    .from('workspaces')
    .select('id, name, accent_color, telegram_group_chat_id, daily_digest_time')
    .eq('owner_id', user.id)

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
