import { NextRequest, NextResponse } from 'next/server'
import { handleApprove, handleEdit, handleDismiss, handleEditReply, isInEditMode } from '@/lib/telegram/callbacks'
import { logger } from '@/lib/utils/logger'

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()

    // Handle inline keyboard callback buttons (Approve / Edit / Dismiss)
    if (update.callback_query) {
      const query = update.callback_query
      const chatId = String(query.message.chat.id)
      const messageId = query.message.message_id
      const data = query.data as string // "{taskId}:approve" etc.

      const [taskId, action] = data.split(':')

      switch (action) {
        case 'approve':
          await handleApprove(taskId, chatId, messageId)
          break
        case 'edit':
          await handleEdit(taskId, chatId, messageId)
          break
        case 'dismiss':
          await handleDismiss(taskId, chatId, messageId)
          break
        default:
          logger.warn({ action, taskId }, 'Unknown callback action')
      }

      // Acknowledge the callback query to stop Telegram loading spinner
      await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: query.id }),
        }
      )
    }

    // Handle regular text messages (for Edit mode — user types their custom reply)
    if (update.message?.text) {
      const chatId = String(update.message.chat.id)
      const text = update.message.text

      if (isInEditMode(chatId)) {
        const success = await handleEditReply(chatId, text)
        if (success) {
          // Send confirmation back to user
          await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: '✅ Your reply has been sent to Slack.',
                parse_mode: 'HTML',
              }),
            }
          )
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error({ error }, 'Telegram webhook error')
    return NextResponse.json({ ok: true }) // Always return 200 to Telegram
  }
}
