import { WebClient } from '@slack/web-api'
import { decrypt } from '@/lib/utils/security'
import { getWorkspaceById, updateTaskStatus, logActivity } from '@/lib/db/queries'
import { logger } from '@/lib/utils/logger'

export async function postReplyToSlack(task: {
  id: string
  workspace_id: string
  channel: string
  thread_ts: string
  draft_text: string | null
  edited_text: string | null
}) {
  const log = logger.child({ taskId: task.id, fn: 'postReplyToSlack' })
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
    throw error
  }
}
