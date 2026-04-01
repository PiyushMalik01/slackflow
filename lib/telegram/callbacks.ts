import { bot } from '@/lib/telegram/bot'
import { getServiceClient } from '@/lib/db/client'
import { getCompanyName } from '@/lib/db/queries'
import { startEditSession, getActiveSession, updateSessionState, deleteSession, startRoutingSession } from '@/lib/telegram/sessions'
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

  // Guard: already processed
  if (task.status === 'sent') {
    await bot.editMessageText('Already sent to Slack.', { chat_id: chatId, message_id: messageId }).catch(() => {})
    return
  }

  const textToSend = task.edited_text || task.draft_text
  if (!textToSend) {
    await bot.sendMessage(chatId, 'No draft available to approve.')
    return
  }

  await postReplyToSlack(taskId)

  await bot.editMessageText('Approved and sent to Slack.', { chat_id: chatId, message_id: messageId })

  // Notify team group
  const { data: workspace } = await supabase.from('workspaces').select('team_group_chat_id, name, owner_id').eq('id', task.workspace_id).maybeSingle()
  const { data: role } = task.role_id ? await supabase.from('roles').select('name').eq('id', task.role_id).maybeSingle() : { data: null }
  if (workspace?.team_group_chat_id) {
    const companyName = await getCompanyName(workspace.owner_id)
    await notifyTeamGroup({
      groupChatId: workspace.team_group_chat_id,
      workspaceName: workspace.name,
      companyName,
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
  const { data: task } = await supabase.from('tasks').select('workspace_id, channel, category, sender_name, role_id').eq('id', taskId).maybeSingle()
  if (task) {
    const { data: workspace } = await supabase.from('workspaces').select('team_group_chat_id, name, owner_id').eq('id', task.workspace_id).maybeSingle()
    const { data: role } = task.role_id ? await supabase.from('roles').select('name').eq('id', task.role_id).maybeSingle() : { data: null }
    if (workspace?.team_group_chat_id) {
      const companyName = await getCompanyName(workspace.owner_id)
      await notifyTeamGroup({
        groupChatId: workspace.team_group_chat_id,
        workspaceName: workspace.name,
        companyName,
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

  // Guard: already processed
  const { data: existingTask } = await supabase.from('tasks').select('status').eq('id', taskId).maybeSingle()
  if (existingTask?.status === 'sent') {
    await deleteSession(session.id)
    await bot.editMessageText('Already sent to Slack.', { chat_id: chatId, message_id: messageId }).catch(() => {})
    return
  }

  await supabase.from('tasks').update({ edited_text: session.draft_text, status: 'edited' }).eq('id', taskId)
  await postReplyToSlack(taskId)
  await deleteSession(session.id)
  await bot.editMessageText('Custom response sent to Slack.', { chat_id: chatId, message_id: messageId })

  // Notify team group
  const { data: task } = await supabase.from('tasks').select('workspace_id, channel, category, sender_name, role_id').eq('id', taskId).maybeSingle()
  if (task) {
    const { data: workspace } = await supabase.from('workspaces').select('team_group_chat_id, name, owner_id').eq('id', task.workspace_id).maybeSingle()
    const { data: role } = task.role_id ? await supabase.from('roles').select('name').eq('id', task.role_id).maybeSingle() : { data: null }
    if (workspace?.team_group_chat_id) {
      const companyName = await getCompanyName(workspace.owner_id)
      await notifyTeamGroup({
        groupChatId: workspace.team_group_chat_id,
        workspaceName: workspace.name,
        companyName,
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

export async function handleSnooze(taskId: string, chatId: number, messageId: number): Promise<void> {
  const supabase = getServiceClient()

  const remindAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  await supabase.from('tasks').update({
    snooze_until: remindAt,
  }).eq('id', taskId)

  await bot.editMessageText('\u23f0 Snoozed \u2014 will remind you in 1 hour.', {
    chat_id: chatId,
    message_id: messageId,
  })

  await supabase.from('activity_log').insert({
    workspace_id: (await supabase.from('tasks').select('workspace_id').eq('id', taskId).maybeSingle()).data?.workspace_id,
    task_id: taskId,
    actor: 'telegram',
    action: 'task_snoozed',
    details: { remind_at: remindAt },
  })
}

export async function handleReassign(taskId: string, chatId: number, messageId: number): Promise<void> {
  const supabase = getServiceClient()

  await supabase.from('tasks').update({
    role_id: null,
    status: 'pending' as const,
  }).eq('id', taskId)

  await bot.editMessageText('\u21a9 Task unassigned \u2014 admin will reassign it.', {
    chat_id: chatId,
    message_id: messageId,
  })

  const { data: task } = await supabase.from('tasks').select('workspace_id, channel, category, sender_name, role_id').eq('id', taskId).maybeSingle()
  if (task) {
    await supabase.from('activity_log').insert({
      workspace_id: task.workspace_id,
      task_id: taskId,
      actor: 'telegram',
      action: 'task_reassign_requested',
      details: { reason: 'Team member declined' },
    })

    const { data: workspace } = await supabase.from('workspaces').select('team_group_chat_id, name, owner_id').eq('id', task.workspace_id).maybeSingle()
    const { data: role } = task.role_id ? await supabase.from('roles').select('name').eq('id', task.role_id).maybeSingle() : { data: null }
    if (workspace?.team_group_chat_id) {
      const companyName = await getCompanyName(workspace.owner_id)
      await notifyTeamGroup({
        groupChatId: workspace.team_group_chat_id,
        workspaceName: workspace.name,
        companyName,
        channel: task.channel,
        category: task.category || 'General',
        categoryEmoji: '',
        assigneeName: role?.name || 'Team Member',
        senderName: task.sender_name || 'Unknown',
        action: 'dismissed',
      })
    }
  }
}

// Helper: get all linked team members who can receive Telegram messages
// Includes roles from ALL workspace members (shared workspace support)
async function getRoutableMembers(taskId: string) {
  const supabase = getServiceClient()
  const { data: task } = await supabase.from('tasks').select('workspace_id').eq('id', taskId).maybeSingle()
  if (!task) return null

  // Get all members of this workspace
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', task.workspace_id)

  if (!members || members.length === 0) return null

  const ownerIds = members.map(m => m.user_id)

  // Get all linked roles from all workspace members that have telegram_chat_id
  const { data: roles } = await supabase
    .from('roles')
    .select('id, name, type, is_authority, telegram_chat_id, status')
    .in('owner_id', ownerIds)
    .eq('status', 'linked')
    .not('telegram_chat_id', 'is', null)
    .order('is_authority', { ascending: false })
    .order('name')

  return roles && roles.length > 0 ? roles : null
}

export async function handleRoute(taskId: string, chatId: number, messageId: number): Promise<void> {
  const roles = await getRoutableMembers(taskId)

  if (!roles) {
    await bot.sendMessage(chatId, 'No linked team members available to route to.')
    return
  }

  const roleIds = roles.map(r => r.id)
  await startRoutingSession(String(chatId), taskId, 'routing', JSON.stringify(roleIds))

  const memberButtons = roles.slice(0, 10).map((r, i) => ([{
    text: `${r.is_authority ? '\u2b50 ' : ''}${r.name} (${r.type})`,
    callback_data: `${taskId}:r_${i}`,
  }]))
  memberButtons.push([{ text: 'Cancel', callback_data: `${taskId}:r_cancel` }])

  await bot.sendMessage(chatId, '<b>Route to:</b>\nSelect a team member to hand this task to:', {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: memberButtons },
  })
}

export async function handleRedirect(taskId: string, chatId: number, messageId: number): Promise<void> {
  const roles = await getRoutableMembers(taskId)

  if (!roles) {
    await bot.sendMessage(chatId, 'No linked team members available.')
    return
  }

  const roleIds = roles.map(r => r.id)
  await startRoutingSession(String(chatId), taskId, 'redirecting', JSON.stringify(roleIds))

  const memberButtons = roles.slice(0, 10).map((r, i) => ([{
    text: `${r.is_authority ? '\u2b50 ' : ''}${r.name} (${r.type})`,
    callback_data: `${taskId}:r_${i}`,
  }]))
  memberButtons.push([{ text: 'Cancel', callback_data: `${taskId}:r_cancel` }])

  await bot.sendMessage(chatId, '<b>Redirect to:</b>\nSelect a team member. They will be notified and the task will be reassigned:', {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: memberButtons },
  })
}

export async function handleRouteSelect(taskId: string, chatId: number, messageId: number, index: number): Promise<void> {
  const session = await getActiveSession(String(chatId))
  if (!session || !session.target_action) {
    await bot.editMessageText('Session expired. Please try again from the task notification.', { chat_id: chatId, message_id: messageId })
    return
  }

  const roleIds: string[] = JSON.parse(session.target_action)
  if (index < 0 || index >= roleIds.length) {
    await bot.editMessageText('Invalid selection.', { chat_id: chatId, message_id: messageId })
    await deleteSession(session.id)
    return
  }

  const targetRoleId = roleIds[index]
  const supabase = getServiceClient()

  const { data: targetRole } = await supabase.from('roles').select('id, name, telegram_chat_id').eq('id', targetRoleId).maybeSingle()
  if (!targetRole) {
    await bot.editMessageText('Member not found.', { chat_id: chatId, message_id: messageId })
    await deleteSession(session.id)
    return
  }

  const { data: task } = await supabase.from('tasks').select('*, workspaces(name, owner_id), categories(emoji)').eq('id', taskId).maybeSingle()
  const wsData = task?.workspaces as { name: string; owner_id: string } | null
  const companyName = wsData?.owner_id ? await getCompanyName(wsData.owner_id) : 'SlackFlow'

  if (session.state === 'routing') {
    // ROUTE: Hand the task to someone else. You're done with it.
    await supabase.from('tasks').update({ role_id: targetRoleId, status: 'pending' }).eq('id', taskId)
    await bot.editMessageText(`Routed to <b>${targetRole.name}</b>. Task handed off.`, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' })

  } else {
    // REDIRECT: Reassign but also notify the original person that someone else is now handling it.
    const oldRoleId = task?.role_id
    await supabase.from('tasks').update({ role_id: targetRoleId, status: 'pending' }).eq('id', taskId)
    await bot.editMessageText(`Redirected to <b>${targetRole.name}</b>. You'll be kept in the loop.`, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' })

    // Notify the original sender (current user) with a confirmation
    await bot.sendMessage(chatId, `You redirected a task from <b>#${task?.channel || 'unknown'}</b> to <b>${targetRole.name}</b>. They'll take it from here.`, { parse_mode: 'HTML' })
  }

  // Notify the target person with full task context
  if (targetRole.telegram_chat_id && task) {
    const { notifyAssignee } = await import('@/lib/telegram/notify')
    await notifyAssignee({
      chatId: targetRole.telegram_chat_id,
      taskId: task.id,
      workspaceName: wsData?.name || 'Unknown',
      companyName,
      channel: task.channel,
      senderName: task.sender_name || 'Unknown',
      category: task.category || 'General',
      categoryEmoji: (task.categories as { emoji: string } | null)?.emoji || '',
      confidence: task.category_confidence || 0,
      originalText: task.original_text,
      draftText: task.draft_text,
    })
  }

  // Log activity
  if (task) {
    await supabase.from('activity_log').insert({
      workspace_id: task.workspace_id,
      task_id: taskId,
      actor: 'telegram',
      action: session.state === 'routing' ? 'task_routed' : 'task_redirected',
      details: { target_role: targetRole.name },
    })
  }

  await deleteSession(session.id)
}

export async function handleRouteCancel(taskId: string, chatId: number, messageId: number): Promise<void> {
  const session = await getActiveSession(String(chatId))
  if (session) await deleteSession(session.id)
  await bot.editMessageText('Routing cancelled.', { chat_id: chatId, message_id: messageId })
}
