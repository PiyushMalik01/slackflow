import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/db/client'
import { getServiceClient } from '@/lib/db/client'
import { listWorkspacesForUser } from '@/lib/db/queries'
import { Activity } from 'lucide-react'

export const metadata = { title: 'Activity' }

const actionIcon: Record<string, string> = {
  task_created: '📥',
  draft_generated: '🤖',
  draft_failed: '❌',
  approved_and_sent: '✅',
  edited_and_sent: '✏️',
  dismissed: '🚫',
  telegram_notified: '📲',
}

export default async function ActivityPage() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspaces = await listWorkspacesForUser(user.id).catch(() => [])
  const workspaceIds = workspaces.map((w) => w.id)

  const db = getServiceClient()
  const { data: logs } = workspaceIds.length > 0
    ? await db
        .from('activity_log')
        .select('id, action, actor, details, created_at')
        .in('workspace_id', workspaceIds)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">Full audit trail of all pipeline events</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {!logs || logs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="px-4 md:px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3 hover:bg-muted/30 transition-colors">
                <span className="text-lg flex-shrink-0 mt-0.5">{actionIcon[log.action] ?? '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium capitalize">{log.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.actor}
                    {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                      <> · {JSON.stringify(log.details).slice(0, 80)}</>
                    )}
                  </p>
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 sm:mt-0.5">
                  {new Date(log.created_at).toLocaleString()}
                </time>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
