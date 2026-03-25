import { NextRequest } from 'next/server'
import { verifyTelegramWebhook } from '@/lib/utils/security'
import { handleApprove, handleEdit, handleDismiss, handleViewOriginal, handleEditReply, handleEditConfirm, handleEditCancel, handleSnooze, handleReassign } from '@/lib/telegram/callbacks'
import { handleStartCommand, handlePendingCommand, handleStatusCommand, handleHelpCommand, handleBoardCommand, handleSummaryCommand } from '@/lib/telegram/commands'
import { logger } from '@/lib/utils/logger'

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token')
  if (!verifyTelegramWebhook(secretHeader)) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const body = await req.json()

    // Handle bot commands
    if (body.message?.text) {
      const chatId = body.message.chat.id
      const text = body.message.text.trim()

      if (text.startsWith('/start')) {
        const payload = text.split(' ')[1] || ''
        await handleStartCommand(chatId, payload)
        return new Response('ok')
      }
      if (text === '/pending') { await handlePendingCommand(chatId); return new Response('ok') }
      if (text === '/status') { await handleStatusCommand(chatId); return new Response('ok') }
      if (text === '/help') { await handleHelpCommand(chatId); return new Response('ok') }
      if (text === '/board') { await handleBoardCommand(chatId); return new Response('ok') }
      if (text === '/summary') { await handleSummaryCommand(chatId); return new Response('ok') }

      // Not a command — check for active edit session
      await handleEditReply(chatId, text)
      return new Response('ok')
    }

    // Handle callback queries (button presses)
    if (body.callback_query) {
      const query = body.callback_query
      const chatId = query.message?.chat?.id
      const messageId = query.message?.message_id
      const data = query.data || ''

      // Parse callback data: "{taskId}:{action}"
      const colonIndex = data.indexOf(':')
      if (colonIndex === -1) return new Response('ok')
      const taskId = data.substring(0, colonIndex)
      const action = data.substring(colonIndex + 1)

      // Acknowledge callback query
      try {
        const { bot } = await import('@/lib/telegram/bot')
        await bot.answerCallbackQuery(query.id)
      } catch { /* ignore ack errors */ }

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
        case 'view_original':
          await handleViewOriginal(taskId, chatId)
          break
        case 'confirm_edit':
          await handleEditConfirm(taskId, chatId, messageId)
          break
        case 'cancel_edit':
          await handleEditCancel(taskId, chatId, messageId)
          break
        case 'snooze':
          await handleSnooze(taskId, chatId, messageId)
          break
        case 'reassign':
          await handleReassign(taskId, chatId, messageId)
          break
      }

      return new Response('ok')
    }

    return new Response('ok')
  } catch (err) {
    logger.error({ err }, 'Telegram webhook error')
    return new Response('ok') // Always 200 to prevent Telegram retries
  }
}
