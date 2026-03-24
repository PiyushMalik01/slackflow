import { bot } from '@/lib/telegram/bot'
import { getServiceClient } from '@/lib/db/client'
import { startEditSession, getActiveSession, updateSessionState, deleteSession } from '@/lib/telegram/sessions'
import { postReplyToSlack } from '@/lib/slack/egress'
import { notifyTeamGroup } from '@/lib/telegram/group-notify'
import { logger } from '@/lib/utils/logger'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function handleApprove(taskId: string, chatId: number, messageId: number): Promise<void> {
  const supabase = getServiceClient()
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single()
  if (!task) return

  const textToSend = task.edited_text || task.draft_text
  if (!textToSend) {
    await bot.sendMessage(chatId, 'No draft available to approve.')
    return
  }

  await postReplyToSlack(taskId)

  await bot.editMessageText('Approved and sent to Slack.', { chat_id: chatId, message_id: messageId })

  // Notify team group
  const { data: workspace } = await supabase.from('workspaces').select('team_group_chat_id, name').eq('id', task.workspace_id).maybeSingle()
  const { data: role } = await supabase.from('roles').select('name').eq('telegram_chat_id', String(chatId)).maybeSingle()
  if (workspace?.team_group_chat_id) {
    await notifyTeamGroup({
      groupChatId: workspace.team_group_chat_id,
      workspaceName: workspace.name,
      channel: task.channel,
      category: task.category || 'General',
      categoryEmoji: '',
      assigneeName: role?.name || 'Unknown',
      senderName: task.sender_name || 'Unknown',
      action: 'approved',
    })
  }
}

export async function handleEdit(taskId: string, chatId: number, messageId: number): Promise<void> {
  await startEditSession(String(chatId), taskId)
  await bot.sendMessage(chatId, 'Send your edited response (or /cancel to abort):')
}

export async function handleDismiss(taskId: string, chatId: number, messageId: number): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('tasks').update({ status: 'dismissed' }).eq('id', taskId)
  await bot.editMessageText('Task dismissed.', { chat_id: chatId, message_id: messageId })

  // Notify team group
  const { data: task } = await supabase.from('tasks').select('workspace_id, channel, category, sender_name').eq('id', taskId).maybeSingle()
  if (task) {
    const { data: workspace } = await supabase.from('workspaces').select('team_group_chat_id, name').eq('id', task.workspace_id).maybeSingle()
    const { data: role } = await supabase.from('roles').select('name').eq('telegram_chat_id', String(chatId)).maybeSingle()
    if (workspace?.team_group_chat_id) {
      await notifyTeamGroup({
        groupChatId: workspace.team_group_chat_id,
        workspaceName: workspace.name,
        channel: task.channel,
        category: task.category || 'General',
        categoryEmoji: '',
        assigneeName: role?.name || 'Unknown',
        senderName: task.sender_name || 'Unknown',
        action: 'dismissed',
      })
    }
  }

  await supabase.from('activity_log').insert({
    workspace_id: task?.workspace_id, task_id: taskId, actor: 'telegram', action: 'task_dismissed', details: {},
  })
}

export async function handleViewOriginal(taskId: string, chatId: number): Promise<void> {
  const supabase = getServiceClient()
  const { data: task } = await supabase.from('tasks').select('original_text, sender_name, channel').eq('id', taskId).maybeSingle()
  if (!task) {
    await bot.sendMessage(chatId, 'Task not found.')
    return
  }
  await bot.sendMessage(chatId, `<b>Original message</b> from ${escapeHtml(task.sender_name || 'Unknown')} in #${escapeHtml(task.channel)}:\n\n${escapeHtml(task.original_text || '')}`, { parse_mode: 'HTML' })
}

export async function handleEditReply(chatId: number, text: string): Promise<void> {
  const session = await getActiveSession(String(chatId))
  if (!session) {
    await bot.sendMessage(chatId, 'No active edit session. Use a task button to start.')
    return
  }

  if (text === '/cancel') {
    await deleteSession(session.id)
    await bot.sendMessage(chatId, 'Edit cancelled.')
    return
  }

  // Show preview with confirm/cancel
  await updateSessionState(session.id, 'confirming', text)
  await bot.sendMessage(chatId, `<b>Preview:</b>\n\n${escapeHtml(text)}\n\nConfirm this response?`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: 'Confirm', callback_data: `${session.task_id}:confirm_edit` },
        { text: 'Cancel', callback_data: `${session.task_id}:cancel_edit` },
      ]],
    },
  })
}

export async function handleEditConfirm(taskId: string, chatId: number, messageId: number): Promise<void> {
  const session = await getActiveSession(String(chatId))
  if (!session || !session.draft_text) {
    await bot.sendMessage(chatId, 'No edit to confirm.')
    return
  }

  const supabase = getServiceClient()
  await supabase.from('tasks').update({ edited_text: session.draft_text, status: 'edited' }).eq('id', taskId)
  await postReplyToSlack(taskId)
  await deleteSession(session.id)
  await bot.editMessageText('Custom response sent to Slack.', { chat_id: chatId, message_id: messageId })

  // Notify team group
  const { data: task } = await supabase.from('tasks').select('workspace_id, channel, category, sender_name').eq('id', taskId).maybeSingle()
  if (task) {
    const { data: workspace } = await supabase.from('workspaces').select('team_group_chat_id, name').eq('id', task.workspace_id).maybeSingle()
    const { data: role } = await supabase.from('roles').select('name').eq('telegram_chat_id', String(chatId)).maybeSingle()
    if (workspace?.team_group_chat_id) {
      await notifyTeamGroup({
        groupChatId: workspace.team_group_chat_id,
        workspaceName: workspace.name,
        channel: task.channel,
        category: task.category || 'General',
        categoryEmoji: '',
        assigneeName: role?.name || 'Unknown',
        senderName: task.sender_name || 'Unknown',
        action: 'edited',
      })
    }
  }
}

export async function handleEditCancel(taskId: string, chatId: number, messageId: number): Promise<void> {
  const session = await getActiveSession(String(chatId))
  if (session) await deleteSession(session.id)
  await bot.editMessageText('Edit cancelled.', { chat_id: chatId, message_id: messageId })
}
