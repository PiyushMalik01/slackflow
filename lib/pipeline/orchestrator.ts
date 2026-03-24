import { getServiceClient } from '@/lib/db/client'
import { tryClaimEvent } from '@/lib/utils/idempotency'
import { runAiPipeline } from '@/lib/ai/pipeline'
import { resolveSlackUser } from '@/lib/slack/user-cache'
import { notifyAssignee } from '@/lib/telegram/notify'
import { notifyTeamGroup } from '@/lib/telegram/group-notify'
import { getCategories, resolveRole } from '@/lib/db/queries'
import { decrypt } from '@/lib/utils/security'
import { logger } from '@/lib/utils/logger'
import { WebClient } from '@slack/web-api'

interface SlackEvent {
  type: string
  subtype?: string
  text: string
  user: string
  channel: string
  ts: string
  thread_ts?: string
  bot_id?: string
  bot_profile?: unknown
  event_id?: string
  team?: string
  username?: string
}

// Slack subtypes that are system/automated messages — never route these
const IGNORED_SUBTYPES = new Set([
  'bot_message',
  'channel_join',
  'channel_leave',
  'channel_topic',
  'channel_purpose',
  'channel_name',
  'channel_archive',
  'channel_unarchive',
  'group_join',
  'group_leave',
  'group_topic',
  'group_purpose',
  'group_name',
  'group_archive',
  'group_unarchive',
  'file_share',
  'file_comment',
  'file_mention',
  'pinned_item',
  'unpinned_item',
  'message_changed',
  'message_deleted',
  'message_replied',
  'ekm_access_denied',
  'me_message',
  'thread_broadcast',
  'tombstone',
  'joiner_notification',
  'slackbot_response',
])

export async function handleSlackMessage(event: SlackEvent, workspaceId: string): Promise<void> {
  const log = logger.child({ eventTs: event.ts, channel: event.channel })
  const supabase = getServiceClient()

  // Skip bot messages
  if (event.bot_id || event.bot_profile) {
    log.debug('Skipping bot message')
    return
  }

  // Skip system/automated messages (joins, leaves, topic changes, etc.)
  if (event.subtype && IGNORED_SUBTYPES.has(event.subtype)) {
    log.debug({ subtype: event.subtype }, 'Skipping system message')
    return
  }

  // Skip empty or whitespace-only messages
  if (!event.text || !event.text.trim()) {
    log.debug('Skipping empty message')
    return
  }

  // Skip messages that look like Slack system patterns (e.g. "<@U123> has joined the channel")
  const systemPatterns = [
    /^<@\w+>\s+has\s+(joined|left)\s+the\s+channel/i,
    /^<@\w+>\s+set\s+the\s+channel\s+(topic|purpose|description)/i,
    /^<@\w+>\s+(pinned|unpinned)\s+a\s+message/i,
    /^<@\w+>\s+(archived|unarchived)\s+the\s+channel/i,
    /^<@\w+>\s+renamed\s+the\s+channel/i,
    /^<@\w+>\s+was\s+added\s+to\s+the/i,
    /^<@\w+>\s+was\s+removed\s+from/i,
  ]
  if (systemPatterns.some(pattern => pattern.test(event.text.trim()))) {
    log.debug('Skipping system-pattern message')
    return
  }

  // Idempotency check
  const eventId = event.event_id || `${workspaceId}:${event.channel}:${event.ts}`
  const claimed = await tryClaimEvent(eventId, workspaceId)
  if (!claimed) {
    log.info('Duplicate event, skipping')
    return
  }

  // Load workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single()

  if (!workspace) {
    log.error('Workspace not found')
    return
  }

  // Check monitored channels
  const monitoredChannels = workspace.monitored_channels || []
  if (monitoredChannels.length > 0 && !monitoredChannels.includes(event.channel)) {
    log.debug('Channel not monitored, skipping')
    return
  }

  // Decrypt access token
  let accessToken: string
  try {
    accessToken = decrypt(workspace.access_token_enc, workspace.access_token_iv)
  } catch (err) {
    log.error({ err }, 'Failed to decrypt access token')
    return
  }

  // Resolve sender name (non-blocking)
  let senderName = event.username || event.user
  try {
    const cachedUser = await resolveSlackUser(accessToken, workspaceId, event.user)
    senderName = cachedUser.display_name
  } catch (err) {
    log.warn({ err }, 'Failed to resolve sender, using fallback')
  }

  // Fetch thread context if this is a thread reply
  let threadContext: string | null = null
  if (event.thread_ts && event.thread_ts !== event.ts) {
    try {
      const client = new WebClient(accessToken)
      const result = await client.conversations.replies({
        channel: event.channel,
        ts: event.thread_ts,
        limit: 1,
      })
      const parentMsg = result.messages?.[0]
      if (parentMsg?.text) {
        threadContext = parentMsg.text.substring(0, 500)
      }
    } catch (err) {
      log.warn({ err }, 'Failed to fetch thread context')
    }
  }

  // Load categories
  const categories = await getCategories(workspace.owner_id)

  // Create task first with status 'pending' so we have a real taskId for the AI pipeline
  const { data: task, error: taskError } = await supabase.from('tasks').insert({
    workspace_id: workspaceId,
    channel: event.channel,
    thread_ts: event.thread_ts || event.ts,
    original_text: event.text,
    sender_name: senderName,
    status: 'pending',
    ai_model: process.env.AI_MODEL || 'gpt-4o-mini',
    thread_context: threadContext,
  }).select().single()

  if (taskError || !task) {
    log.error({ taskError }, 'Failed to create task')
    return
  }

  // Run AI pipeline (classify + draft); it updates the task record in-place
  const aiResult = await runAiPipeline({
    taskId: task.id,
    workspaceId,
    ownerId: workspace.owner_id,
    message: event.text,
    senderName,
    channel: event.channel,
    threadContext,
  })

  // Resolve matched category from categories list
  const matchedCategory = categories.find(
    (c) => c.name.toLowerCase() === aiResult.category.toLowerCase()
  )
  const categoryId = matchedCategory?.id || null

  // Resolve role for this category (resolveRole returns a role row or null)
  let role: { id: string; telegram_chat_id: string | null; name: string } | null = null
  if (categoryId) {
    role = await resolveRole(workspaceId, categoryId)
  }

  // Update task with category + role info (AI pipeline already set draft/category fields)
  await supabase.from('tasks').update({
    category_id: categoryId,
    role_id: role?.id || null,
    sender_name: senderName,
  }).eq('id', task.id)

  // Notify assignee via Telegram
  if (role?.telegram_chat_id) {
    try {
      const msgId = await notifyAssignee({
        chatId: role.telegram_chat_id,
        taskId: task.id,
        workspaceName: workspace.name,
        channel: event.channel,
        senderName,
        category: aiResult.category,
        categoryEmoji: matchedCategory?.emoji || '',
        confidence: aiResult.confidence,
        originalText: event.text,
        draftText: aiResult.draft,
      })
      if (msgId) {
        await supabase.from('tasks').update({ telegram_message_id: msgId }).eq('id', task.id)
      }
    } catch (err) {
      log.error({ err }, 'Failed to notify assignee')
    }
  }

  // Notify team group (non-blocking)
  if (workspace.team_group_chat_id) {
    try {
      await notifyTeamGroup({
        groupChatId: workspace.team_group_chat_id,
        workspaceName: workspace.name,
        channel: event.channel,
        category: aiResult.category,
        categoryEmoji: matchedCategory?.emoji || '',
        assigneeName: role?.name || 'Unassigned',
        senderName,
        action: 'created',
        taskPreview: event.text,
      })
    } catch (err) {
      log.error({ err }, 'Failed to notify team group')
    }
  }

  // Log activity
  await supabase.from('activity_log').insert({
    workspace_id: workspaceId,
    task_id: task.id,
    actor: 'system',
    action: 'task_created',
    details: {
      category: aiResult.category,
      confidence: aiResult.confidence,
      assignee: role?.name || null,
      has_draft: !!aiResult.draft,
    },
  })

  log.info({ taskId: task.id, category: aiResult.category, assignee: role?.name }, 'Task created and routed')
}
