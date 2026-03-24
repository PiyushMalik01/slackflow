import { getServiceClient } from './client'
import { DbError } from '@/lib/utils/errors'
import type { Database, TaskStatus, TaskCategory } from './types'

type Task = Database['public']['Tables']['tasks']['Row']
type TaskInsert = Database['public']['Tables']['tasks']['Insert']
type WorkspaceInsert = Database['public']['Tables']['workspaces']['Insert']
type RoleInsert = Database['public']['Tables']['roles']['Insert']

// ── Workspaces ────────────────────────────────────────────────────────────────

export async function getWorkspaceByTeamId(teamId: string) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .eq('slack_team_id', teamId)
    .single()
  if (error || !data) throw new DbError('workspace_not_found', error?.message ?? 'Not found')
  return data
}

export async function getWorkspaceById(id: string) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) throw new DbError('workspace_not_found', error?.message ?? 'Not found')
  return data
}

export async function upsertWorkspace(workspace: WorkspaceInsert) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('workspaces')
    .upsert(workspace, { onConflict: 'slack_team_id' })
    .select()
    .single()
  if (error) throw new DbError('workspace_upsert_failed', error.message)
  return data
}

export async function listWorkspacesForUser(userId: string) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId)
    .order('installed_at', { ascending: false })
  if (error) throw new DbError('workspaces_list_failed', error.message)
  return data ?? []
}

export async function deleteWorkspace(id: string) {
  const db = getServiceClient()
  const { error } = await db.from('workspaces').delete().eq('id', id)
  if (error) throw new DbError('workspace_delete_failed', error.message)
}

// ── Roles ─────────────────────────────────────────────────────────────────────

export async function listRolesForUser(ownerId: string) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('roles')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true })
  if (error) throw new DbError('roles_list_failed', error.message)
  return data ?? []
}

export async function upsertRole(role: RoleInsert) {
  const db = getServiceClient()
  const { data, error } = await db.from('roles').insert(role).select().single()
  if (error) throw new DbError('role_create_failed', error.message)
  return data
}

export async function updateRole(
  id: string,
  update: Partial<Pick<RoleInsert, 'name' | 'type' | 'telegram_chat_id'>>
) {
  const db = getServiceClient()
  const { error } = await db.from('roles').update(update).eq('id', id)
  if (error) throw new DbError('role_update_failed', error.message)
}

export async function deleteRole(id: string) {
  const db = getServiceClient()
  const { error } = await db.from('roles').delete().eq('id', id)
  if (error) throw new DbError('role_delete_failed', error.message)
}

export async function resolveRole(workspaceId: string, category: TaskCategory) {
  const db = getServiceClient()
  const { data } = await db
    .from('workspace_roles')
    .select('*, roles(*)')
    .eq('workspace_id', workspaceId)
    .eq('category', category)
    .single()
  // Null if no role configured — caller handles gracefully
  return (data as { roles: Database['public']['Tables']['roles']['Row'] } | null)?.roles ?? null
}

export async function getWorkspaceRoles(workspaceId: string) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('workspace_roles')
    .select('*, roles(*)')
    .eq('workspace_id', workspaceId)
  if (error) throw new DbError('workspace_roles_fetch_failed', error.message)
  return data ?? []
}

export async function setWorkspaceRole(workspaceId: string, category: TaskCategory, roleId: string) {
  const db = getServiceClient()
  const { error } = await db
    .from('workspace_roles')
    .upsert({ workspace_id: workspaceId, category, role_id: roleId }, { onConflict: 'workspace_id,category' })
  if (error) throw new DbError('workspace_role_set_failed', error.message)
}

export async function removeWorkspaceRole(workspaceId: string, category: TaskCategory) {
  const db = getServiceClient()
  const { error } = await db
    .from('workspace_roles')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('category', category)
  if (error) throw new DbError('workspace_role_remove_failed', error.message)
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createTask(task: Record<string, any>) {
  const db = getServiceClient()
  const { data, error } = await db.from('tasks').insert(task).select().single()
  if (error) throw new DbError('task_create_failed', error.message)
  return data as Database['public']['Tables']['tasks']['Row']
}

export async function updateTaskStatus(id: string, status: TaskStatus, extra?: Partial<Task>) {
  const db = getServiceClient()
  const { error } = await db
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString(), ...(extra ?? {}) })
    .eq('id', id)
  if (error) throw new DbError('task_update_failed', error.message)
}

export async function getTaskById(id: string) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) throw new DbError('task_not_found', error?.message ?? 'Task not found')
  return data
}

export async function listTasks(filters: {
  workspaceId?: string
  status?: TaskStatus
  category?: TaskCategory
  search?: string
  limit?: number
  offset?: number
}) {
  const db = getServiceClient()
  let q = db.from('tasks').select('*, workspaces(name, slack_team_id), roles(name, type)', { count: 'exact' })
  if (filters.workspaceId) q = q.eq('workspace_id', filters.workspaceId)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.category) q = q.eq('category', filters.category)
  if (filters.search) q = q.ilike('original_text', `%${filters.search}%`)
  q = q.order('created_at', { ascending: false })
       .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 25) - 1)
  const { data, error, count } = await q
  if (error) throw new DbError('tasks_list_failed', error.message)
  return { tasks: data ?? [], total: count ?? 0 }
}

export async function getTasksByTelegramMessageId(telegramMessageId: number) {
  const db = getServiceClient()
  const { data } = await db
    .from('tasks')
    .select('*')
    .eq('telegram_message_id', telegramMessageId)
    .single()
  return data
}

export async function getStaleTasks(olderThanMinutes: number) {
  const db = getServiceClient()
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString()
  const { data } = await db
    .from('tasks')
    .select('*, roles(*)')
    .eq('status', 'draft_ready')
    .lt('draft_generated_at', cutoff)
  return data ?? []
}

export async function getDashboardMetrics(ownerId: string) {
  const db = getServiceClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const workspaces = await listWorkspacesForUser(ownerId)
  const workspaceIds = workspaces.map((w) => w.id)

  if (workspaceIds.length === 0) {
    return { tasksToday: 0, approvalRate: 0, activeWorkspaces: 0, pendingTasks: 0 }
  }

  const { count: tasksToday } = await db
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .in('workspace_id', workspaceIds)
    .gte('created_at', todayStart.toISOString())

  const { count: totalSent } = await db
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .in('workspace_id', workspaceIds)
    .in('status', ['sent'])

  const { count: totalProcessed } = await db
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .in('workspace_id', workspaceIds)
    .in('status', ['sent', 'dismissed'])

  const { count: pendingTasks } = await db
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .in('workspace_id', workspaceIds)
    .in('status', ['pending', 'draft_ready'])

  const approvalRate = totalProcessed && totalProcessed > 0
    ? Math.round(((totalSent ?? 0) / totalProcessed) * 100)
    : 0

  return {
    tasksToday: tasksToday ?? 0,
    approvalRate,
    activeWorkspaces: workspaces.length,
    pendingTasks: pendingTasks ?? 0,
  }
}

// ── Activity Log ──────────────────────────────────────────────────────────────

export async function logActivity(entry: {
  workspace_id?: string | null
  task_id?: string | null
  actor: string
  action: string
  details?: Record<string, unknown>
}) {
  const db = getServiceClient()
  await db.from('activity_log').insert({
    workspace_id: entry.workspace_id ?? null,
    task_id: entry.task_id ?? null,
    actor: entry.actor,
    action: entry.action,
    details: entry.details ?? null,
  })
  // Non-throwing — activity logging should never break the main flow
}

export async function listActivityLog(filters: {
  workspaceIds?: string[]
  limit?: number
  offset?: number
}) {
  const db = getServiceClient()
  let q = db
    .from('activity_log')
    .select('*, tasks(original_text, category, status)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1)
  if (filters.workspaceIds?.length) q = q.in('workspace_id', filters.workspaceIds)
  const { data, error, count } = await q
  if (error) throw new DbError('activity_log_list_failed', error.message)
  return { logs: data ?? [], total: count ?? 0 }
}

// ── Deduplication ─────────────────────────────────────────────────────────────

export async function checkDuplicate(workspaceId: string, channel: string, threadTs: string) {
  const db = getServiceClient()
  const since = new Date(Date.now() - 60_000).toISOString() // within last 60s
  const { data } = await db
    .from('tasks')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('channel', channel)
    .eq('thread_ts', threadTs)
    .gte('created_at', since)
    .limit(1)
  return (data?.length ?? 0) > 0
}
