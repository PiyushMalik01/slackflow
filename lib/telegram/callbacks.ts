import { getTaskById, updateTaskStatus, logActivity } from '@/lib/db/queries'
import { postReplyToSlack } from '@/lib/slack/egress'
import { editTelegramMessage } from './notify'
import { logger } from '@/lib/utils/logger'

// In-memory store for "edit mode" — user is typing their custom reply
// In production, use Supabase or Redis instead
const editModeStore = new Map<string, string>() // chatId → taskId

export async function handleApprove(taskId: string, chatId: string, messageId: number) {
  const log = logger.child({ taskId, fn: 'handleApprove' })
  try {
    const task = await getTaskById(taskId)
    await postReplyToSlack({
      id: task.id,
      workspace_id: task.workspace_id,
      channel: task.channel,
      thread_ts: task.thread_ts,
      draft_text: task.draft_text,
      edited_text: null,
    })
    await editTelegramMessage(chatId, messageId, '✅ <b>Approved and sent to Slack.</b>')
    log.info('Task approved and sent')
  } catch (error) {
    log.error({ error }, 'Approve flow failed')
    await editTelegramMessage(chatId, messageId, '❌ <b>Failed to send. Please check the dashboard.</b>')
  }
}

export async function handleEdit(taskId: string, chatId: string, messageId: number) {
  const log = logger.child({ taskId, fn: 'handleEdit' })
  // Enter edit mode
  editModeStore.set(chatId, taskId)
  await editTelegramMessage(
    chatId,
    messageId,
    `✏️ <b>Send your edited reply now.</b>\n<i>Type and send your message in this chat.</i>`
  )
  log.info('Edit mode activated')
}

export async function handleDismiss(taskId: string, chatId: string, messageId: number) {
  const log = logger.child({ taskId, fn: 'handleDismiss' })
  try {
    const task = await getTaskById(taskId)
    await updateTaskStatus(taskId, 'dismissed')
    await logActivity({
      task_id: taskId,
      workspace_id: task.workspace_id,
      actor: `telegram:${chatId}`,
      action: 'dismissed',
    })
    await editTelegramMessage(chatId, messageId, '❌ <b>Dismissed.</b> No reply sent to Slack.')
    log.info('Task dismissed')
  } catch (error) {
    log.error({ error }, 'Dismiss flow failed')
  }
}

export async function handleEditReply(chatId: string, editedText: string) {
  const log = logger.child({ chatId, fn: 'handleEditReply' })
  const taskId = editModeStore.get(chatId)
  if (!taskId) return false // Not in edit mode

  editModeStore.delete(chatId)

  try {
    const task = await getTaskById(taskId)
    await postReplyToSlack({
      id: task.id,
      workspace_id: task.workspace_id,
      channel: task.channel,
      thread_ts: task.thread_ts,
      draft_text: task.draft_text,
      edited_text: editedText,
    })
    log.info('Edited reply sent to Slack')
    return true
  } catch (error) {
    log.error({ error }, 'Edit reply failed')
    return false
  }
}

export function isInEditMode(chatId: string): boolean {
  return editModeStore.has(chatId)
}
