import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { getCompanyName } from '@/lib/db/queries'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

const updateSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid().optional(),
  category: z.string().optional(),
  status: z.enum(['pending', 'draft_ready', 'approved', 'edited', 'dismissed', 'sent', 'failed']).optional(),
  role_id: z.string().uuid().optional().nullable(),
  edited_text: z.string().optional(),
  send_to_slack: z.boolean().optional(),
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

    // Get the FULL task before updating (to know old role_id and for notifications)
    const { data: fullTask } = await svc.from('tasks').select('*, workspaces(name), categories(emoji)').eq('id', id).single()
    if (!fullTask) return json403('Task not found')

    // Verify task belongs to a workspace the user is a member of
    const { data: membership } = await svc.from('workspace_members').select('workspace_id').eq('workspace_id', fullTask.workspace_id).eq('user_id', user.id).maybeSingle()
    if (!membership) return json403('Not authorized')

    // Store old role for reassignment notification
    const oldRoleId = fullTask.role_id

    // Strip non-column flags before writing to DB
    const { send_to_slack, ...dbUpdates } = updates
    await svc.from('tasks').update(dbUpdates).eq('id', id)

    // Log the activity
    await svc.from('activity_log').insert({
      workspace_id: fullTask.workspace_id,
      task_id: id,
      actor: 'admin',
      action: 'task_updated',
      details: dbUpdates,
    })

    // If role_id was updated, handle notifications
    if (updates.role_id && fullTask) {
      // Notify OLD assignee that task was reassigned (if there was one and it changed)
      if (oldRoleId && oldRoleId !== updates.role_id) {
        try {
          const { data: oldRole } = await svc.from('roles').select('telegram_chat_id, name').eq('id', oldRoleId).maybeSingle()
          const { data: newRole } = await svc.from('roles').select('name').eq('id', updates.role_id).maybeSingle()

          if (oldRole?.telegram_chat_id) {
            const companyName = await getCompanyName(user.id)
            const { bot } = await import('@/lib/telegram/bot')
            await bot.sendMessage(
              oldRole.telegram_chat_id,
              `↩ <b>Task reassigned</b> (${companyName})\n\nThe task from <b>#${fullTask.channel}</b> has been reassigned to <b>${newRole?.name || 'another member'}</b>. No action needed from you.`,
              { parse_mode: 'HTML' }
            )
          }
        } catch (err) {
          console.error('Failed to notify old assignee:', err)
        }
      }

      // Notify NEW assignee
      try {
        const { data: newRole } = await svc.from('roles').select('telegram_chat_id, name').eq('id', updates.role_id).maybeSingle()
        if (newRole?.telegram_chat_id) {
          const taskCompanyName = await getCompanyName(user.id)
          const { notifyAssignee } = await import('@/lib/telegram/notify')
          const msgId = await notifyAssignee({
            chatId: newRole.telegram_chat_id,
            taskId: id,
            workspaceName: (fullTask.workspaces as { name: string } | null)?.name || 'Unknown',
            companyName: taskCompanyName,
            channel: fullTask.channel,
            senderName: fullTask.sender_name || 'Unknown',
            category: fullTask.category || 'General',
            categoryEmoji: (fullTask.categories as { emoji: string } | null)?.emoji || '',
            confidence: fullTask.category_confidence || 0,
            originalText: fullTask.original_text,
            draftText: fullTask.draft_text,
          })
          if (msgId) {
            await svc.from('tasks').update({ telegram_message_id: msgId }).eq('id', id)
          }
        }
      } catch (err) {
        console.error('Failed to send assignment notification:', err)
      }
    }

    // If send_to_slack flag is set, post the reply to Slack
    if (send_to_slack) {
      try {
        const { postReplyToSlack } = await import('@/lib/slack/egress')
        await postReplyToSlack(id)
      } catch (err) {
        console.error('Failed to post to Slack:', err)
      }
    }

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
          const { data: mem } = await svc.from('workspace_members').select('workspace_id').eq('workspace_id', task.workspace_id).eq('user_id', user.id).maybeSingle()
          if (!mem) return json403('Not authorized for task ' + taskId)
        }
      }
      await svc.from('tasks').delete().in('id', idList)
      return jsonOk({ success: true, deleted: idList.length })
    }

    if (!id) return json400('Missing id')

    const { data: task } = await svc.from('tasks').select('workspace_id').eq('id', id).maybeSingle()
    if (task) {
      const { data: mem } = await svc.from('workspace_members').select('workspace_id').eq('workspace_id', task.workspace_id).eq('user_id', user.id).maybeSingle()
      if (!mem) return json403('Not authorized')
    }

    await svc.from('tasks').delete().eq('id', id)
    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
