import { WebClient } from '@slack/web-api'
import { decrypt } from '@/lib/utils/security'
import { getWorkspaceById, updateTaskStatus, logActivity, getTaskById } from '@/lib/db/queries'
import { logger } from '@/lib/utils/logger'
import { bot } from '@/lib/telegram/bot'
import { getServiceClient } from '@/lib/db/client'

export async function postReplyToSlack(taskId: string) {
  const log = logger.child({ taskId, fn: 'postReplyToSlack' })

  // Look up the task from DB
  const task = await getTaskById(taskId)

  // Guard: don't send if already sent (prevents duplicate messages from Telegram retries)
  if (task.status === 'sent') {
    log.info('Task already sent, skipping duplicate')
    return
  }

  const workspace = await getWorkspaceById(task.workspace_id)
  const token = decrypt(workspace.access_token_enc, workspace.access_token_iv)
  const client = new WebClient(token)

  const text = task.edited_text || task.draft_text || '✅ Message received.'
  const finalStatus = task.edited_text ? 'edited' : 'approved'

  try {
    await client.chat.postMessage({
      channel: task.channel,
      thread_ts: task.thread_ts,
      text,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `_Replied via SlackFlow · ${new Date().toLocaleString()}_` },
          ],
        },
      ],
    })

    await updateTaskStatus(task.id, 'sent', {
      final_text: text,
      sent_at: new Date().toISOString(),
    })

    await logActivity({
      task_id: task.id,
      workspace_id: task.workspace_id,
      actor: 'system',
      action: finalStatus === 'edited' ? 'edited_and_sent' : 'approved_and_sent',
      details: { channel: task.channel },
    })

    log.info('Reply posted to Slack successfully')
  } catch (error) {
    log.error({ error }, 'Failed to post reply to Slack')
    await updateTaskStatus(task.id, 'failed')

    // Notify admin via Telegram about the failure
    try {
      if (bot) {
        const supabase = getServiceClient()
        // Look up the workspace owner's admin chat ID
        const { data: ownerRole } = await supabase
          .from('roles')
          .select('telegram_chat_id')
          .eq('owner_id', workspace.owner_id)
          .eq('type', 'admin')
          .maybeSingle()

        const adminChatId = ownerRole?.telegram_chat_id ?? null

        if (adminChatId) {
          const failureMsg =
            `⚠️ <b>Slack Reply Failed</b>\n` +
            `Workspace: <b>${workspace.name}</b>\n` +
            `Channel: <b>#${task.channel}</b>\n` +
            `Task ID: <code>${task.id}</code>\n` +
            `Error: <i>${error instanceof Error ? error.message : 'Unknown error'}</i>`

          await bot.sendMessage(adminChatId, failureMsg, { parse_mode: 'HTML' })
          log.info({ adminChatId }, 'Admin notified of Slack reply failure via Telegram')
        } else {
          log.warn('No admin Telegram chat ID found, skipping failure notification')
        }
      }
    } catch (notifyErr) {
      log.error({ notifyErr }, 'Failed to send Telegram failure notification to admin')
    }

    throw error
  }
}
