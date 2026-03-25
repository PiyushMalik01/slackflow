import { getServiceClient } from '@/lib/db/client'
import { notifyAssignee } from '@/lib/telegram/notify'
import { logger } from '@/lib/utils/logger'

export async function GET() {
  const supabase = getServiceClient()

  // Find tasks with snooze_until in the past that haven't been resolved
  const { data: snoozedTasks, error } = await supabase
    .from('tasks')
    .select('*, roles(telegram_chat_id, name), workspaces(name)')
    .not('snooze_until', 'is', null)
    .lte('snooze_until', new Date().toISOString())
    .in('status', ['pending', 'draft_ready'])

  if (error) {
    logger.error({ error }, 'Failed to query snoozed tasks')
    return new Response('Error', { status: 500 })
  }

  let processed = 0

  for (const task of snoozedTasks || []) {
    const chatId = (task.roles as { telegram_chat_id: string | null; name: string } | null)?.telegram_chat_id
    if (!chatId) continue

    try {
      await notifyAssignee({
        chatId,
        taskId: task.id,
        workspaceName: (task.workspaces as { name: string } | null)?.name || 'Unknown',
        channel: task.channel,
        senderName: task.sender_name || 'Unknown',
        category: task.category || 'General',
        categoryEmoji: '',
        confidence: task.category_confidence || 0,
        originalText: task.original_text,
        draftText: task.draft_text,
      })

      // Clear the snooze
      await supabase.from('tasks').update({ snooze_until: null }).eq('id', task.id)
      processed++
    } catch (err) {
      logger.error({ err, taskId: task.id }, 'Failed to re-notify snoozed task')
    }
  }

  return new Response(`Processed ${processed} snooze reminders`)
}
