import { bot } from '@/lib/telegram/bot'
import { logger } from '@/lib/utils/logger'

interface GroupNotifyParams {
  groupChatId: string
  workspaceName: string
  companyName?: string
  channel: string
  category: string
  categoryEmoji: string
  assigneeName: string
  senderName: string
  action: 'created' | 'approved' | 'edited' | 'dismissed'
  taskPreview?: string
}

export async function notifyTeamGroup(params: GroupNotifyParams): Promise<void> {
  const { groupChatId, workspaceName, companyName, channel, category, categoryEmoji, assigneeName, senderName, action } = params
  const companyLabel = companyName && companyName !== 'SlackFlow' ? companyName : workspaceName

  if (!groupChatId) return

  let message = ''
  switch (action) {
    case 'created':
      message = `${categoryEmoji} <b>New ${category}</b> from <b>#${channel}</b> (${companyLabel})\nFrom: ${senderName} — Assigned to: <b>${assigneeName}</b>`
      if (params.taskPreview) message += `\n<i>${params.taskPreview.substring(0, 100)}...</i>`
      break
    case 'approved':
      message = `<b>${assigneeName}</b> approved the response for a task in <b>#${channel}</b>`
      break
    case 'edited':
      message = `<b>${assigneeName}</b> sent a custom response for a task in <b>#${channel}</b>`
      break
    case 'dismissed':
      message = `<b>${assigneeName}</b> dismissed a task from <b>#${channel}</b>`
      break
  }

  try {
    await bot.sendMessage(groupChatId, message, { parse_mode: 'HTML' })
  } catch (err) {
    logger.error({ err, groupChatId }, 'Failed to notify team group')
  }
}
