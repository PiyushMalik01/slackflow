import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/db/client'
import { listWorkspacesForUser } from '@/lib/db/queries'
import { Building2, Plus, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Workspaces' }

export default async function WorkspacesPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspaces = await listWorkspacesForUser(user.id).catch(() => [])
  const params = await searchParams
  const toast = params.success ? 'success' : params.error ? 'error' : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage connected Slack workspaces</p>
        </div>
        <Link
          href="/api/slack/install"
          className="inline-flex w-full sm:w-auto justify-center items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add to Slack
        </Link>
      </div>

      {/* Toast */}
      {toast === 'success' && (
        <div className="flex items-center gap-2 bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 px-4 py-3 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Workspace connected successfully.
        </div>
      )}
      {toast === 'error' && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          Failed to connect workspace. Please try again.
        </div>
      )}

      {/* Workspace list */}
      {workspaces.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-2">No workspaces connected</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Connect your Slack workspace to start routing messages automatically.
          </p>
          <Link
            href="/api/slack/install"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add to Slack
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {workspaces.map((ws) => (
            <div key={ws.id} className="bg-card border border-border rounded-xl p-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center hover:border-border/80 transition-colors">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{ws.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Team ID: {ws.slack_team_id} · Connected {new Date(ws.installed_at).toLocaleDateString()}
                </div>
                {ws.monitored_channels?.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Monitoring: {ws.monitored_channels.join(', ')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full font-medium">
                  Connected
                </span>
                <Link
                  href="/dashboard/settings"
                  className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors"
                >
                  Configure roles
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
