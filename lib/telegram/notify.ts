import { getBot } from './bot'
import { logger } from '@/lib/utils/logger'

interface NotifyTaskParams {
  telegramChatId: string
  taskId: string
  workspaceName: string
  channel: string
  category: string
  confidence: number
  originalText: string
  draftText: string | null
}

export async function notifyAssignee(params: NotifyTaskParams): Promise<number | null> {
  const log = logger.child({ taskId: params.taskId, fn: 'notifyAssignee' })
  const telegramBot = getBot()

  const confidencePct = Math.round(params.confidence * 100)
  const categoryEmoji = { BUG: '🐛', FEATURE: '✨', GENERAL: '💬' }[params.category] ?? '📌'

  const text = [
    `🔔 <b>New task assigned to you</b>`,
    ``,
    `<b>Workspace:</b> ${escapeHtml(params.workspaceName)}`,
    `<b>Channel:</b> #${escapeHtml(params.channel.replace('#', ''))}`,
    `<b>Category:</b> ${categoryEmoji} ${params.category} <i>(${confidencePct}% confidence)</i>`,
    ``,
    `<b>Client message:</b>`,
    `"${escapeHtml(params.originalText)}"`,
    ``,
    params.draftText
      ? [`<b>AI draft reply:</b>`, `"${escapeHtml(params.draftText)}"`].join('\n')
      : `<i>AI draft unavailable — please reply manually.</i>`,
  ].join('\n')

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `${params.taskId}:approve` },
        { text: '✏️ Edit', callback_data: `${params.taskId}:edit` },
        { text: '❌ Dismiss', callback_data: `${params.taskId}:dismiss` },
      ],
    ],
  }

  try {
    const msg = await telegramBot.sendMessage(params.telegramChatId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    })
    log.info({ messageId: msg.message_id }, 'Telegram notification sent')
    return msg.message_id
  } catch (error) {
    log.error({ error }, 'Failed to send Telegram notification')
    return null
  }
}

export async function editTelegramMessage(
  chatId: string,
  messageId: number,
  newText: string
): Promise<void> {
  try {
    const telegramBot = getBot()
    await telegramBot.editMessageText(newText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
    })
  } catch {
    // Non-critical — message may already be edited or deleted
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
