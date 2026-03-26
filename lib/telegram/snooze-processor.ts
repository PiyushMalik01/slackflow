import { getServiceClient } from '@/lib/db/client'
import { getCompanyName } from '@/lib/db/queries'
import { notifyAssignee } from '@/lib/telegram/notify'
import { logger } from '@/lib/utils/logger'

export async function processDueSnoozes(): Promise<number> {
  const supabase = getServiceClient()

  const { data: snoozedTasks, error } = await supabase
    .from('tasks')
    .select('*, roles(telegram_chat_id, name), workspaces(name, owner_id)')
    .not('snooze_until', 'is', null)
    .lte('snooze_until', new Date().toISOString())
    .in('status', ['pending', 'draft_ready'])

  if (error || !snoozedTasks?.length) return 0

  let processed = 0

  for (const task of snoozedTasks) {
    const chatId = (task.roles as { telegram_chat_id: string | null } | null)?.telegram_chat_id
    if (!chatId) continue

    try {
      const wsData = task.workspaces as { name: string; owner_id: string } | null
      const companyName = wsData?.owner_id ? await getCompanyName(wsData.owner_id) : 'SlackFlow'

      await notifyAssignee({
        chatId,
        taskId: task.id,
        workspaceName: wsData?.name || 'Unknown',
        companyName,
        channel: task.channel,
        senderName: task.sender_name || 'Unknown',
        category: task.category || 'General',
        categoryEmoji: '',
        confidence: task.category_confidence || 0,
        originalText: task.original_text,
        draftText: task.draft_text,
      })

      await supabase.from('tasks').update({ snooze_until: null }).eq('id', task.id)
      processed++
    } catch (err) {
      logger.error({ err, taskId: task.id }, 'Failed to re-notify snoozed task')
    }
  }

  return processed
}
