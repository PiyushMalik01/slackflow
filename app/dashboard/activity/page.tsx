import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { listWorkspacesForUser, listActivityLog } from '@/lib/db/queries'
import {
  Activity, Plus, Sparkles, Check, X, AlertTriangle,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const metadata = { title: 'Activity' }

const ACTION_CONFIG: Record<string, { icon: typeof Plus; label: string; className: string }> = {
  task_created: {
    icon: Plus,
    label: 'Task Created',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  draft_generated: {
    icon: Sparkles,
    label: 'Draft Generated',
    className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  approved_and_sent: {
    icon: Check,
    label: 'Approved & Sent',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  task_approved: {
    icon: Check,
    label: 'Task Approved',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  edited_and_sent: {
    icon: Check,
    label: 'Edited & Sent',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  dismissed: {
    icon: X,
    label: 'Dismissed',
    className: 'bg-muted text-muted-foreground',
  },
  task_dismissed: {
    icon: X,
    label: 'Dismissed',
    className: 'bg-muted text-muted-foreground',
  },
  draft_failed: {
    icon: AlertTriangle,
    label: 'Draft Failed',
    className: 'bg-destructive/10 text-destructive',
  },
  task_failed: {
    icon: AlertTriangle,
    label: 'Task Failed',
    className: 'bg-destructive/10 text-destructive',
  },
  telegram_notified: {
    icon: Check,
    label: 'Telegram Notified',
    className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
}

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] || {
    icon: Activity,
    label: action.replace(/_/g, ' '),
    className: 'bg-muted text-muted-foreground',
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const then = new Date(dateStr)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return then.toLocaleDateString()
}

const PAGE_SIZE = 50

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>
}) {
  // Layout already validates auth and redirects — just get user ID for queries
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const actionFilter = params.action || ''

  const workspaces = await listWorkspacesForUser(user!.id).catch(() => [])
  const workspaceIds = workspaces.map(w => w.id)
  const workspaceMap = Object.fromEntries(workspaces.map(w => [w.id, w]))

  // Build a map of telegram chat IDs to role names for actor display
  const actorNameMap: Record<string, string> = {}
  if (workspaceIds.length > 0) {
    const db = getServiceClient()
    const { data: roles } = await db
      .from('roles')
      .select('name, telegram_chat_id')
      .in('workspace_id', workspaceIds)
      .not('telegram_chat_id', 'is', null)
    if (roles) {
      for (const r of roles) {
        if (r.telegram_chat_id) actorNameMap[r.telegram_chat_id] = r.name
      }
    }
  }

  function formatActor(actor: string | null): string {
    if (!actor) return ''
    if (actor === 'system') return 'System'
    if (actor === 'ai') return 'AI Assistant'
    if (actor === 'admin') return 'Admin'
    if (actor === 'telegram') return 'Team Member'
    // Handle "telegram:XXXXX" format
    if (actor.startsWith('telegram:')) {
      const chatId = actor.replace('telegram:', '')
      return actorNameMap[chatId] || 'Team Member'
    }
    return actor
  }

  let logs: any[] = []
  let total = 0

  if (workspaceIds.length > 0) {
    const result = await listActivityLog({
      workspaceIds,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
    logs = result.logs
    total = result.total
  }

  // Filter by action type if specified
  if (actionFilter && logs.length > 0) {
    logs = logs.filter(l => l.action === actionFilter)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-muted-foreground">Full audit trail of all pipeline events.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterLink href="/dashboard/activity" active={!actionFilter}>
          All
        </FilterLink>
        <FilterLink href="/dashboard/activity?action=task_created" active={actionFilter === 'task_created'}>
          Created
        </FilterLink>
        <FilterLink href="/dashboard/activity?action=draft_generated" active={actionFilter === 'draft_generated'}>
          Drafted
        </FilterLink>
        <FilterLink href="/dashboard/activity?action=approved_and_sent" active={actionFilter === 'approved_and_sent'}>
          Approved
        </FilterLink>
        <FilterLink href="/dashboard/activity?action=dismissed" active={actionFilter === 'dismissed'}>
          Dismissed
        </FilterLink>
        <FilterLink href="/dashboard/activity?action=task_failed" active={actionFilter === 'task_failed'}>
          Failed
        </FilterLink>
      </div>

      {/* Timeline */}
      {logs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <div className="size-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-1">No activity yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Activity will appear here once messages start flowing through the pipeline.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {logs.map((log) => {
              const config = getActionConfig(log.action)
              const Icon = config.icon
              const ws = log.workspace_id ? workspaceMap[log.workspace_id] : null

              return (
                <div
                  key={log.id}
                  className="px-4 md:px-5 py-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                >
                  {/* Icon */}
                  <div className={`size-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.className}`}>
                    <Icon className="size-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{config.label}</span>
                      {ws && (
                        <Badge variant="secondary" className="text-[10px]">
                          {ws.name}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {log.actor && <span>{formatActor(log.actor)}</span>}
                      {log.tasks?.original_text && (
                        <span className="ml-1">
                          &mdash; {log.tasks.original_text.slice(0, 80)}
                          {log.tasks.original_text.length > 80 ? '...' : ''}
                        </span>
                      )}
                      {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && !log.tasks?.original_text && (
                        <span className="ml-1">
                          &mdash; {JSON.stringify(log.details).slice(0, 100)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <time
                    className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5"
                    title={new Date(log.created_at).toLocaleString()}
                  >
                    {timeAgo(log.created_at)}
                  </time>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex items-center gap-1">
                {page > 1 && (
                  <Button variant="ghost" size="xs" asChild>
                    <Link href={`/dashboard/activity?page=${page - 1}${actionFilter ? `&action=${actionFilter}` : ''}`}>
                      <ChevronLeft className="size-3.5" />
                      Previous
                    </Link>
                  </Button>
                )}
                {page < totalPages && (
                  <Button variant="ghost" size="xs" asChild>
                    <Link href={`/dashboard/activity?page=${page + 1}${actionFilter ? `&action=${actionFilter}` : ''}`}>
                      Next
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-primary font-medium'
          : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </Link>
  )
}
