import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { Building2, Plus, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WorkspaceCard } from '@/components/workspace-card'

export const metadata = { title: 'Workspaces' }

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  // Layout already validates auth and redirects — just get user ID for queries
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  const svc = getServiceClient()

  // Load workspaces with channel info
  const { data: workspaces } = await svc
    .from('workspaces')
    .select('*')
    .eq('owner_id', user!.id)
    .order('installed_at', { ascending: false })

  const params = await searchParams
  const toast = params.success ? 'success' : params.error ? 'error' : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground">Manage your connected Slack workspaces.</p>
        </div>
        <Button asChild>
          <Link href="/api/slack/install">
            <Plus className="size-4" />
            Add to Slack
          </Link>
        </Button>
      </div>

      {/* Toast notifications */}
      {toast === 'success' && (
        <div className="flex items-center gap-2 bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 px-4 py-3 rounded-lg text-sm">
          <CheckCircle className="size-4 flex-shrink-0" />
          Workspace connected successfully.
        </div>
      )}
      {toast === 'error' && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg text-sm">
          <XCircle className="size-4 flex-shrink-0" />
          Failed to connect workspace. Please try again.
        </div>
      )}

      {/* Workspace list */}
      {!workspaces || workspaces.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="size-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="size-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">No workspaces connected</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Connect your Slack workspace to start routing messages automatically.
            </p>
            <Button asChild>
              <Link href="/api/slack/install">
                <Plus className="size-4" />
                Add to Slack
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workspaces.map((ws) => (
            <WorkspaceCard key={ws.id} workspace={ws} />
          ))}

          {/* Add workspace CTA */}
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Connect another Slack workspace
              </p>
              <Button variant="outline" asChild>
                <Link href="/api/slack/install">
                  <Plus className="size-4" />
                  Add Workspace
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
