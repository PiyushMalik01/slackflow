import { bot } from '@/lib/telegram/bot'
import { logger } from '@/lib/utils/logger'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface NotifyParams {
  chatId: string
  taskId: string
  workspaceName: string
  channel: string
  senderName: string
  category: string
  categoryEmoji: string
  confidence: number
  originalText: string
  draftText: string | null
}

export async function notifyAssignee(params: NotifyParams): Promise<number | null> {
  const { chatId, taskId, workspaceName, channel, senderName, category, categoryEmoji, confidence, originalText, draftText } = params

  if (!chatId) {
    logger.warn({ taskId }, 'No chat ID for assignee, skipping notification')
    return null
  }

  const confidenceBar = confidence >= 0.8 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low'

  let message = `<b>${categoryEmoji} ${escapeHtml(category)}</b> — ${escapeHtml(workspaceName)}\n`
  message += `Channel: <b>#${escapeHtml(channel)}</b>\n`
  message += `From: ${escapeHtml(senderName)}\n`
  message += `Confidence: ${confidenceBar} (${Math.round(confidence * 100)}%)\n\n`
  message += `<b>Message:</b>\n${escapeHtml(originalText.substring(0, 300))}${originalText.length > 300 ? '...' : ''}\n`

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
            { text: 'Approve', callback_data: `${taskId}:approve` },
            { text: 'Edit', callback_data: `${taskId}:edit` },
          ],
          [
            { text: 'Dismiss', callback_data: `${taskId}:dismiss` },
            { text: 'View Original', callback_data: `${taskId}:view_original` },
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
