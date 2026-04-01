import { bot } from '@/lib/telegram/bot'
import { logger } from '@/lib/utils/logger'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface NotifyParams {
  chatId: string
  taskId: string
  workspaceName: string
  companyName?: string
  channel: string
  senderName: string
  category: string
  categoryEmoji: string
  confidence: number
  originalText: string
  draftText: string | null
  title?: string
  expectedBehavior?: string
  reporter?: string
}

export async function notifyAssignee(params: NotifyParams): Promise<number | null> {
  const { chatId, taskId, workspaceName, companyName, channel, senderName, category, categoryEmoji, confidence, originalText, draftText, title, expectedBehavior, reporter } = params

  if (!chatId) {
    logger.warn({ taskId }, 'No chat ID for assignee, skipping notification')
    return null
  }

  const companyLabel = companyName && companyName !== 'SlackFlow' ? companyName : workspaceName
  let message = `${categoryEmoji} ${escapeHtml(category)} — ${escapeHtml(companyLabel)}\n`

  if (title) {
    message += `\n<b>${escapeHtml(title)}</b>\n`
  }

  message += `Reporter: ${escapeHtml(reporter || senderName)}\n`
  message += `Channel: #${escapeHtml(channel)}\n`

  if (expectedBehavior) {
    message += `Expected: ${escapeHtml(expectedBehavior)}\n`
  }

  message += `\n<b>Message:</b>\n${escapeHtml(originalText.substring(0, 300))}${originalText.length > 300 ? '...' : ''}\n`

  if (draftText) {
    message += `\n<b>AI Draft:</b>\n<i>${escapeHtml(draftText.substring(0, 200))}${draftText.length > 200 ? '...' : ''}</i>\n`
  } else {
    message += `\n<i>AI draft unavailable — please review the original message.</i>\n`
  }

  try {
    const sent = await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Reply to Slack', callback_data: `${taskId}:approve` },
            { text: 'Edit', callback_data: `${taskId}:edit` },
          ],
          [
            { text: 'Route to...', callback_data: `${taskId}:route` },
            { text: 'Redirect', callback_data: `${taskId}:redir` },
          ],
          [
            { text: 'Dismiss', callback_data: `${taskId}:dismiss` },
            { text: 'Snooze 1h', callback_data: `${taskId}:snooze` },
          ],
        ],
      },
    })
    return sent.message_id
  } catch (err) {
    logger.error({ err, chatId, taskId }, 'Failed to notify assignee')
    return null
  }
}
