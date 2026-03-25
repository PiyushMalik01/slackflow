import { getAuthUser, getServiceClient } from '@/lib/db/client'
import { getCategories, seedDefaultCategories } from '@/lib/db/queries'
import { SettingsClient } from '@/components/settings-interactive'
import { GuideTip } from '@/components/guide-tip'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  // Layout already validates auth and redirects — just get user ID for queries
  const user = await getAuthUser()

  const svc = getServiceClient()

  // Parallelize initial loads
  let [categories, { data: workspaces }, { data: aiSettings }] = await Promise.all([
    getCategories(user!.id),
    svc
      .from('workspaces')
      .select('id, name, accent_color, team_group_chat_id, daily_digest_time')
      .eq('owner_id', user!.id),
    svc
      .from('ai_settings')
      .select('openai_email, openai_plan_type, openai_auth_method, openai_connected_at, openai_api_key_enc')
      .eq('owner_id', user!.id)
      .maybeSingle(),
  ])

  // Seed defaults if empty (sequential — depends on categories result)
  if (categories.length === 0) {
    await seedDefaultCategories(user!.id)
    categories = await getCategories(user!.id)
  }

  // Build AI status from DB row (never send encrypted key to client)
  const aiStatus = aiSettings?.openai_api_key_enc
    ? {
        connected: true as const,
        email: aiSettings.openai_email as string | null,
        planType: aiSettings.openai_plan_type as string | null,
        authMethod: (aiSettings.openai_auth_method as string) || 'api-key',
        connectedAt: aiSettings.openai_connected_at as string | null,
      }
    : { connected: false as const }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage categories, preferences, and AI configuration.</p>
      </div>
      <GuideTip
        id="settings-customize-categories"
        title="Customize your categories"
        description="Add draft prompts so the AI knows how to respond for each category. Tailor categories to match your workflow."
      />

      <SettingsClient
        initialCategories={categories || []}
        workspaces={workspaces || []}
        aiStatus={aiStatus}
      />
    </div>
  )
}
