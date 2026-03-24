import TelegramBot from 'node-telegram-bot-api'

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token && process.env.NODE_ENV === 'production') {
  throw new Error('TELEGRAM_BOT_TOKEN is not set')
}

// Use webhook mode in production, polling can be enabled for testing
const _bot = token
  ? new TelegramBot(token, { polling: false })
  : null

// Non-null assertion: callers assume bot is configured. Throws at runtime if not.
export const bot = _bot as TelegramBot

export function getBot(): TelegramBot {
  if (!_bot) throw new Error('Telegram bot is not initialized (TELEGRAM_BOT_TOKEN missing)')
  return _bot
}
