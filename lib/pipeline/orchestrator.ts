import { classify } from '@/lib/slack/classifier'
import { runAiDraftPipeline } from '@/lib/ai/pipeline'
import { notifyAssignee } from '@/lib/telegram/notify'
import {
  getWorkspaceByTeamId,
  resolveRole,
  createTask,
  updateTaskStatus,
  logActivity,
  checkDuplicate,
} from '@/lib/db/queries'
import { createCorrelatedLogger } from '@/lib/utils/logger'
import type { TaskCategory } from '@/lib/db/types'

interface SlackMessageEvent {
  type: string
  text: string
  user: string
  channel: string
  ts: string
  team: string
  username?: string
  bot_id?: string
  subtype?: string
}

export async function handleSlackMessage(event: SlackMessageEvent): Promise<void> {
  const log = createCorrelatedLogger(`slack_${event.ts}`)

  // Skip bot messages to prevent loops
  if (event.bot_id || event.subtype === 'bot_message') {
    log.debug('Skipping bot message')
    return
  }

  try {
    // 1. Load workspace
    const workspace = await getWorkspaceByTeamId(event.team)
    log.info({ workspace: workspace.name }, 'Workspace loaded')

    // 2. Check channel filter
    if (workspace.monitored_channels?.length > 0 && !workspace.monitored_channels.includes(event.channel)) {
      log.debug({ channel: event.channel }, 'Channel not monitored — skipping')
      return
    }

    // 3. Deduplication check
    const isDuplicate = await checkDuplicate(workspace.id, event.channel, event.ts)
    if (isDuplicate) {
      log.warn({ ts: event.ts }, 'Duplicate event — skipping')
      return
    }

    // 4. Classify
    const classified = classify(event.text)
    log.info({ category: classified.category, confidence: classified.confidence }, 'Classified')

    // 5. Resolve role
    const role = await resolveRole(workspace.id, classified.category as TaskCategory)
    if (!role) {
      log.warn({ category: classified.category }, 'No role configured — creating task without assignee')
    }

    // 6. Create task record
    const task = await createTask({
      workspace_id: workspace.id,
      channel: event.channel,
      thread_ts: event.ts,
      original_text: event.text,
      sender_name: event.username ?? null,
      category: classified.category as TaskCategory,
      category_confidence: classified.confidence,
      status: 'pending',
      role_id: role?.id ?? null,
    })

    await logActivity({
      task_id: task.id,
      workspace_id: workspace.id,
      actor: 'system',
      action: 'task_created',
      details: {
        category: classified.category,
        confidence: classified.confidence,
        channel: event.channel,
      },
    })
    log.info({ taskId: task.id }, 'Task created')

    // 7. Run AI draft pipeline
    let draft: string | null = null
    try {
      const result = await runAiDraftPipeline({
        id: task.id,
        workspace_id: workspace.id,
        original_text: event.text,
        category: classified.category,
      })
      draft = result.draft
    } catch (aiError) {
      log.error({ aiError }, 'AI pipeline failed — continuing without draft')
      // Task is already marked failed inside pipeline — we continue to notify anyway
    }

    // 8. Notify assignee via Telegram
    if (role?.telegram_chat_id) {
      const messageId = await notifyAssignee({
        telegramChatId: role.telegram_chat_id,
        taskId: task.id,
        workspaceName: workspace.name,
        channel: event.channel,
        category: classified.category,
        confidence: classified.confidence,
        originalText: event.text,
        draftText: draft,
      })

      if (messageId) {
        await updateTaskStatus(task.id, draft ? 'draft_ready' : 'pending', {
          telegram_message_id: messageId,
          role_id: role.id,
        })

        await logActivity({
          task_id: task.id,
          workspace_id: workspace.id,
          actor: 'system',
          action: 'telegram_notified',
          details: { role: role.name, chatId: role.telegram_chat_id },
        })
      }
    } else {
      log.warn({ taskId: task.id }, 'No Telegram chat ID for role — task awaits manual action')
    }

    log.info({ taskId: task.id }, 'Pipeline completed')
  } catch (error) {
    log.error({ error }, 'Orchestrator error')
    // Don't rethrow — Slack requires a 200 response to avoid retries
  }
}
