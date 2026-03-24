import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/db/client'
import { getServiceClient } from '@/lib/db/client'
import { listWorkspacesForUser } from '@/lib/db/queries'
import { ListChecks } from 'lucide-react'
import type { TaskStatus, TaskCategory } from '@/lib/db/types'

export const metadata = { title: 'Tasks' }

const statusColor: Record<string, string> = {
  sent: 'bg-green-500/10 text-green-600 dark:text-green-400',
  approved: 'bg-green-500/10 text-green-600 dark:text-green-400',
  draft_ready: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  dismissed: 'bg-muted text-muted-foreground',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  edited: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

const categoryColor: Record<string, string> = {
  BUG: 'bg-red-500/10 text-red-600 dark:text-red-400',
  FEATURE: 'bg-primary/10 text-primary',
  GENERAL: 'bg-muted text-muted-foreground',
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string; page?: string }>
}) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const page = parseInt(params.page ?? '1')
  const limit = 25
  const offset = (page - 1) * limit

  // Get user's workspaces for data isolation
  const workspaces = await listWorkspacesForUser(user.id).catch(() => [])
  const workspaceIds = workspaces.map(w => w.id)

  // We'll join workspaces and roles to get the friendly names
  const db = getServiceClient()
  let q = db
    .from('tasks')
    .select(`
      id, original_text, channel, category, status, draft_text, created_at,
      workspace:workspaces!workspace_id (id, name),
      role:roles!role_id (id, name, type)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Enforce data isolation
  if (workspaceIds.length > 0) {
    q = q.in('workspace_id', workspaceIds)
  } else {
    // If user has no workspaces, return empty result
    q = q.eq('workspace_id', '00000000-0000-0000-0000-000000000000') 
  }

  if (params.status) q = q.eq('status', params.status as TaskStatus)
  if (params.category) q = q.eq('category', params.category as TaskCategory)
  if (params.q) q = q.ilike('original_text', `%${params.q}%`)

  const { data: tasks, count } = await q
  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total tasks</p>
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="flex gap-2 flex-wrap">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search messages…"
          className="px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring flex-1 min-w-48"
        />
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All statuses</option>
          {['pending', 'draft_ready', 'approved', 'edited', 'sent', 'dismissed', 'failed'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={params.category ?? ''}
          className="px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All categories</option>
          <option value="BUG">Bug</option>
          <option value="FEATURE">Feature</option>
          <option value="GENERAL">General</option>
        </select>
        <button type="submit" className="px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors">
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {!tasks || tasks.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <ListChecks className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-3 font-medium">Message</th>
                  <th className="text-left px-4 py-3 font-medium">Workspace & Channel</th>
                  <th className="text-left px-4 py-3 font-medium">Category & Role</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.map((task: any) => (
                  <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm truncate">{task.original_text}</p>
                      {task.draft_text && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          Draft: {task.draft_text}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{task.workspace?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">#{task.channel}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {task.category ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColor[task.category] ?? ''}`}>
                            {task.category}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {task.role && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            {task.role.name} ({task.role.type})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[task.status] ?? ''}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(task.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <a href={`?page=${page - 1}&status=${params.status ?? ''}&category=${params.category ?? ''}&q=${params.q ?? ''}`}
                      className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors">
                      Previous
                    </a>
                  )}
                  {page < totalPages && (
                    <a href={`?page=${page + 1}&status=${params.status ?? ''}&category=${params.category ?? ''}&q=${params.q ?? ''}`}
                      className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors">
                      Next
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
