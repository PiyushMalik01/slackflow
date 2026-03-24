import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/db/client'
import { getServiceClient } from '@/lib/db/client'
import { listWorkspacesForUser, getCategories } from '@/lib/db/queries'
import { Card, CardContent } from '@/components/ui/card'
import { TaskCard } from '@/components/task-card'
import { ListChecks } from 'lucide-react'
import Link from 'next/link'
import type { TaskStatus } from '@/lib/db/types'
import { TaskFilters } from './task-filters'

export const metadata = { title: 'Tasks' }

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; search?: string; page?: string }>
}) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const limit = 25
  const offset = (page - 1) * limit

  // Get user's workspaces and categories for filtering
  const [workspaces, categories] = await Promise.all([
    listWorkspacesForUser(user.id).catch(() => []),
    getCategories(user.id).catch(() => []),
  ])
  const workspaceIds = workspaces.map(w => w.id)

  // Build query
  const db = getServiceClient()
  let q = db
    .from('tasks')
    .select(`
      id, original_text, draft_text, edited_text, final_text, channel, category,
      category_id, status, sender_name, created_at,
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} total task{total !== 1 ? 's' : ''}</p>
      </div>

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
        <div className="space-y-2">
          {mappedTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
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
