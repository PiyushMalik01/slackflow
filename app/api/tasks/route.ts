import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

const updateSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid().optional(),
  category: z.string().optional(),
  status: z.enum(['pending', 'draft_ready', 'approved', 'edited', 'dismissed', 'sent', 'failed']).optional(),
  role_id: z.string().uuid().optional().nullable(),
})

export async function PUT(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return json400(parsed.error.issues[0]?.message || 'Invalid input')

    const { id, ...updates } = parsed.data
    const svc = getServiceClient()

    // Verify task belongs to user's workspace
    const { data: task } = await svc.from('tasks').select('id, workspace_id').eq('id', id).maybeSingle()
    if (!task) return json403('Task not found')
    const { data: ws } = await svc.from('workspaces').select('id').eq('id', task.workspace_id).eq('owner_id', user.id).maybeSingle()
    if (!ws) return json403('Not authorized')

    await svc.from('tasks').update(updates).eq('id', id)

    // Log the activity
    await svc.from('activity_log').insert({
      workspace_id: task.workspace_id,
      task_id: id,
      actor: 'admin',
      action: 'task_updated',
      details: updates,
    })

    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const ids = searchParams.get('ids') // comma-separated for bulk

    const svc = getServiceClient()

    if (ids) {
      // Bulk delete
      const idList = ids.split(',').map(i => i.trim()).filter(Boolean)
      // Verify ownership of all tasks
      for (const taskId of idList) {
        const { data: task } = await svc.from('tasks').select('workspace_id').eq('id', taskId).maybeSingle()
        if (task) {
          const { data: ws } = await svc.from('workspaces').select('id').eq('id', task.workspace_id).eq('owner_id', user.id).maybeSingle()
          if (!ws) return json403('Not authorized for task ' + taskId)
        }
      }
      await svc.from('tasks').delete().in('id', idList)
      return jsonOk({ success: true, deleted: idList.length })
    }

    if (!id) return json400('Missing id')

    const { data: task } = await svc.from('tasks').select('workspace_id').eq('id', id).maybeSingle()
    if (task) {
      const { data: ws } = await svc.from('workspaces').select('id').eq('id', task.workspace_id).eq('owner_id', user.id).maybeSingle()
      if (!ws) return json403('Not authorized')
    }

    await svc.from('tasks').delete().eq('id', id)
    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
