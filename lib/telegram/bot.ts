import TelegramBot from 'node-telegram-bot-api'

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token && process.env.NODE_ENV === 'production') {
  throw new Error('TELEGRAM_BOT_TOKEN is not set')
}

// Use webhook mode in production, polling can be enabled for testing
export const bot = token
  ? new TelegramBot(token, { polling: false })
  : null

export function getBot(): TelegramBot {
  if (!bot) throw new Error('Telegram bot is not initialized (TELEGRAM_BOT_TOKEN missing)')
  return bot
}
