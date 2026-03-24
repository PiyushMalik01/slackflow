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

export async function resolveRole(workspaceId: string, categoryId: string) {
  const db = getServiceClient()
  const { data } = await db
    .from('workspace_roles')
    .select('*, roles(*)')
    .eq('workspace_id', workspaceId)
    .eq('category_id', categoryId)
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

export async function setWorkspaceRole(workspaceId: string, categoryId: string, roleId: string) {
  const db = getServiceClient()
  const { error } = await db
    .from('workspace_roles')
    .upsert({ workspace_id: workspaceId, category_id: categoryId, role_id: roleId }, { onConflict: 'workspace_id,category_id' })
  if (error) throw new DbError('workspace_role_set_failed', error.message)
}

export async function removeWorkspaceRole(workspaceId: string, categoryId: string) {
  const db = getServiceClient()
  const { error } = await db
    .from('workspace_roles')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('category_id', categoryId)
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

export async function getDashboardMetrics(ownerId: string, workspaceId?: string) {
  const supabase = getServiceClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let query = supabase.from('tasks').select('id, status, created_at, sent_at', { count: 'exact' })

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId)
  } else {
    // Filter by owner's workspaces
    const { data: workspaces } = await supabase.from('workspaces').select('id').eq('owner_id', ownerId)
    const wsIds = workspaces?.map(w => w.id) || []
    if (wsIds.length === 0) return { tasksToday: 0, approvalRate: 0, pendingCount: 0, totalTasks: 0 }
    query = query.in('workspace_id', wsIds)
  }

  const { data: allTasks } = await query
  const tasks = allTasks || []

  const todayStr = today.toISOString()
  const tasksToday = tasks.filter(t => t.created_at >= todayStr).length
  const approved = tasks.filter(t => ['approved', 'edited', 'sent'].includes(t.status)).length
  const approvalRate = tasks.length > 0 ? Math.round((approved / tasks.length) * 100) : 0
  const pendingCount = tasks.filter(t => ['pending', 'draft_ready'].includes(t.status)).length

  return { tasksToday, approvalRate, pendingCount, totalTasks: tasks.length }
}

export async function getRecentTasks(ownerId: string, workspaceId?: string, limit = 10) {
  const supabase = getServiceClient()
  let query = supabase.from('tasks').select('*, workspaces(name, accent_color), roles(name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId)
  } else {
    const { data: workspaces } = await supabase.from('workspaces').select('id').eq('owner_id', ownerId)
    const wsIds = workspaces?.map(w => w.id) || []
    if (wsIds.length > 0) query = query.in('workspace_id', wsIds)
  }

  const { data } = await query
  return data || []
}

export async function getSetupStatus(ownerId: string) {
  const supabase = getServiceClient()
  const { data: workspaces } = await supabase.from('workspaces').select('id').eq('owner_id', ownerId)
  const { data: roles } = await supabase.from('roles').select('id, status').eq('owner_id', ownerId)
  const { data: categories } = await supabase.from('categories').select('id').eq('owner_id', ownerId)

  return {
    hasWorkspace: (workspaces?.length || 0) > 0,
    hasRoles: (roles?.length || 0) > 0,
    hasLinkedMembers: roles?.some(r => r.status === 'linked') || false,
    hasCategories: (categories?.length || 0) > 0,
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

// ── Categories ────────────────────────────────────────────────────────────────
export async function getCategories(ownerId: string) {
  const { data, error } = await getServiceClient()
    .from('categories')
    .select('*')
    .eq('owner_id', ownerId)
    .order('is_default', { ascending: false })
    .order('name')
  if (error) throw new DbError('categories_list_failed', 'Failed to load categories')
  return data
}

export async function getCategoryByName(ownerId: string, name: string) {
  const { data } = await getServiceClient()
    .from('categories')
    .select('*')
    .eq('owner_id', ownerId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle()
  return data
}

export async function createCategory(data: {
  owner_id: string
  name: string
  description?: string
  color?: string
  emoji?: string
  is_default?: boolean
}) {
  const { data: cat, error } = await getServiceClient()
    .from('categories')
    .insert(data)
    .select()
    .single()
  if (error) throw new DbError('category_create_failed', 'Failed to create category')
  return cat
}

export async function updateCategory(id: string, data: {
  name?: string
  description?: string
  color?: string
  emoji?: string
}) {
  const { error } = await getServiceClient()
    .from('categories')
    .update(data)
    .eq('id', id)
  if (error) throw new DbError('category_update_failed', 'Failed to update category')
}

export async function deleteCategory(id: string) {
  const { error } = await getServiceClient()
    .from('categories')
    .delete()
    .eq('id', id)
  if (error) throw new DbError('category_delete_failed', 'Failed to delete category')
}

export async function seedDefaultCategories(ownerId: string) {
  const defaults = [
    { owner_id: ownerId, name: 'Bug', description: 'Bug reports, errors, crashes, and broken functionality', emoji: '🐛', color: '#EF4444', is_default: true },
    { owner_id: ownerId, name: 'Feature', description: 'Feature requests, enhancements, and new functionality ideas', emoji: '✨', color: '#8B5CF6', is_default: true },
    { owner_id: ownerId, name: 'General', description: 'General questions, discussions, and miscellaneous messages', emoji: '💬', color: '#6B7280', is_default: true },
  ]
  for (const cat of defaults) {
    await getServiceClient()
      .from('categories')
      .upsert(cat, { onConflict: 'owner_id,name' })
  }
}
