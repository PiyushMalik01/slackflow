import { getAuthUser, getServiceClient } from '@/lib/db/client'
import { listWorkspacesForUser, getCategories, listRolesForUser } from '@/lib/db/queries'
import { Card, CardContent } from '@/components/ui/card'
import { ListChecks } from 'lucide-react'
import Link from 'next/link'
import type { TaskStatus } from '@/lib/db/types'
import { TaskFilters } from './task-filters'
import { TaskListClient } from './task-list-client'
import { GuideTip } from '@/components/guide-tip'

export const metadata = { title: 'Tasks' }

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; search?: string; page?: string }>
}) {
  // Layout already validates auth and redirects — just get user ID for queries
  const user = await getAuthUser()

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const limit = 25
  const offset = (page - 1) * limit

  // Get user's workspaces, categories, and roles for filtering/assignment
  const [workspaces, categories, roles] = await Promise.all([
    listWorkspacesForUser(user!.id).catch(() => []),
    getCategories(user!.id).catch(() => []),
    listRolesForUser(user!.id).catch(() => []),
  ])
  const workspaceIds = workspaces.map(w => w.id)

  // Build query
  const db = getServiceClient()
  let q = db
    .from('tasks')
    .select(`
      id, original_text, draft_text, edited_text, final_text, channel, category,
      category_id, status, sender_name, created_at, workspace_id, role_id,
      workspaces(name, accent_color),
      roles(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Enforce data isolation
  if (workspaceIds.length > 0) {
    q = q.in('workspace_id', workspaceIds)
  } else {
    q = q.eq('workspace_id', '00000000-0000-0000-0000-000000000000')
  }

  if (params.status) q = q.eq('status', params.status as TaskStatus)
  if (params.category) q = q.eq('category', params.category)
  if (params.search) q = q.ilike('original_text', `%${params.search}%`)

  const { data: tasks, count } = await q
  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)

  // Map tasks for TaskCard props
  const mappedTasks = (tasks || []).map((task: any) => ({
    id: task.id,
    original_text: task.original_text,
    draft_text: task.draft_text,
    edited_text: task.edited_text,
    final_text: task.final_text,
    category: task.category || 'Uncategorized',
    category_id: task.category_id,
    status: task.status,
    channel: task.channel,
    sender_name: task.sender_name,
    created_at: task.created_at,
    workspace_id: task.workspace_id,
    role_id: task.role_id,
    workspace_name: task.workspaces?.name,
    workspace_color: task.workspaces?.accent_color,
    role_name: task.roles?.name,
    category_emoji: undefined,
    category_color: undefined,
  }))

  // Match category colors/emojis
  if (categories && categories.length > 0) {
    for (const t of mappedTasks) {
      const cat = categories.find(c => c.name.toLowerCase() === t.category?.toLowerCase())
      if (cat) {
        t.category_emoji = cat.emoji ?? undefined
        t.category_color = cat.color ?? undefined
      }
    }
  }

  // Build category options for filter
  const categoryOptions = (categories || []).map(c => ({ value: c.name, label: `${c.emoji || ''} ${c.name}`.trim() }))

  // Build pagination links
  function buildPageUrl(p: number) {
    const sp = new URLSearchParams()
    if (params.status) sp.set('status', params.status)
    if (params.category) sp.set('category', params.category)
    if (params.search) sp.set('search', params.search)
    sp.set('page', String(p))
    return `?${sp.toString()}`
  }

  // Build status breakdown
  const statusCounts: Record<string, number> = {}
  for (const t of mappedTasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1
  }

  const STATUS_DOT_COLORS: Record<string, string> = {
    pending: '#F59E0B',
    draft_ready: '#8B5CF6',
    approved: '#22C55E',
    sent: '#22C55E',
    edited: '#10B981',
    dismissed: '#6B7280',
    failed: '#EF4444',
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header with status breakdown */}
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-sm text-muted-foreground">{total} total task{total !== 1 ? 's' : ''}</span>
          {Object.entries(statusCounts).length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground/40">|</span>
              {Object.entries(statusCounts).map(([status, count]) => (
                <span key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_DOT_COLORS[status] || '#6B7280' }}
                  />
                  {count} {status.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contextual guide tip */}
      {mappedTasks.length === 0 && !params.status && !params.category && !params.search && (
        <GuideTip
          id="tasks-empty"
          title="No tasks yet"
          description="Tasks will appear here when messages come in from your monitored Slack channels. Make sure you've connected a workspace and toggled on channels."
        />
      )}

      {/* Filters */}
      <TaskFilters
        currentStatus={params.status}
        currentCategory={params.category}
        currentSearch={params.search}
        categoryOptions={categoryOptions}
      />

      {/* Task List */}
      {mappedTasks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <ListChecks className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No tasks found</p>
            {(params.status || params.category || params.search) && (
              <Link href="/dashboard/tasks" className="text-xs text-primary hover:underline mt-2 inline-block">
                Clear filters
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <TaskListClient
          tasks={mappedTasks}
          categories={(categories || []).map(c => ({
            id: c.id,
            name: c.name,
            emoji: c.emoji || '',
            color: c.color || '#6B7280',
          }))}
          roles={(roles || []).map(r => ({
            id: r.id,
            name: r.name,
            type: r.type,
            status: r.status ?? undefined,
          }))}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildPageUrl(page - 1)}
                className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageUrl(page + 1)}
                className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
