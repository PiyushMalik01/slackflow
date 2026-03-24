import { bot } from '@/lib/telegram/bot'
import { getServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'
import crypto from 'crypto'

export function generateInviteToken(): string {
  return 'inv_' + crypto.randomBytes(12).toString('base64url').substring(0, 16)
}

export async function handleStartCommand(chatId: number, payload: string): Promise<void> {
  if (!payload || !payload.startsWith('inv_')) {
    await bot.sendMessage(chatId, 'Welcome to SlackFlow! If you have an invite link, click it to get started.')
    return
  }

  const supabase = getServiceClient()
  const { data: token } = await supabase
    .from('invite_tokens')
    .select('*, roles(*)')
    .eq('token', payload)
    .maybeSingle()

  if (!token) {
    await bot.sendMessage(chatId, 'Invalid invite link. Please ask your admin for a new one.')
    return
  }
  if (token.used_at) {
    await bot.sendMessage(chatId, 'This invite link has already been used.')
    return
  }
  if (new Date(token.expires_at) < new Date()) {
    await bot.sendMessage(chatId, 'This invite link has expired. Please ask your admin to generate a new one.')
    return
  }

  await supabase.from('roles').update({ telegram_chat_id: String(chatId), status: 'linked' }).eq('id', token.role_id)
  await supabase.from('invite_tokens').update({ used_at: new Date().toISOString() }).eq('id', token.id)

  const roleName = (token.roles as any)?.name || 'Team Member'
  await bot.sendMessage(chatId, `You're now linked as <b>${roleName}</b>. You'll receive task notifications here.`, { parse_mode: 'HTML' })
}

export async function handlePendingCommand(chatId: number): Promise<void> {
  const supabase = getServiceClient()
  const { data: role } = await supabase.from('roles').select('id, name').eq('telegram_chat_id', String(chatId)).maybeSingle()

  if (!role) {
    await bot.sendMessage(chatId, 'You are not linked to any role. Ask your admin for an invite link.')
    return
  }

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, original_text, category, channel, created_at, status')
    .eq('role_id', role.id)
    .in('status', ['pending', 'draft_ready'])
    .order('created_at', { ascending: false })
    .limit(10)

  if (!tasks || tasks.length === 0) {
    await bot.sendMessage(chatId, "No pending tasks. You're all caught up!")
    return
  }

  const lines = tasks.map((t, i) => `${i + 1}. [${t.category}] #${t.channel} — ${(t.original_text || '').substring(0, 60)}...`)
  await bot.sendMessage(chatId, `<b>Pending Tasks (${tasks.length}):</b>\n\n${lines.join('\n')}`, { parse_mode: 'HTML' })
}

export async function handleStatusCommand(chatId: number): Promise<void> {
  const supabase = getServiceClient()
  const { data: role } = await supabase.from('roles').select('name, type, status').eq('telegram_chat_id', String(chatId)).maybeSingle()

  if (!role) {
    await bot.sendMessage(chatId, 'Not linked. Ask your admin for an invite link.')
    return
  }

  await bot.sendMessage(chatId, `<b>Your Status</b>\nRole: ${role.name}\nType: ${role.type}\nLink: ${role.status}`, { parse_mode: 'HTML' })
}

export async function handleHelpCommand(chatId: number): Promise<void> {
  await bot.sendMessage(chatId, `<b>SlackFlow Bot Commands</b>\n\n/pending — View your pending tasks\n/status — Check your link status\n/help — Show this help message`, { parse_mode: 'HTML' })
}

export async function handleBoardCommand(chatId: number): Promise<void> {
  const supabase = getServiceClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: tasks } = await supabase.from('tasks').select('status').gte('created_at', today.toISOString())

  const pending = tasks?.filter(t => ['pending', 'draft_ready'].includes(t.status)).length || 0
  const done = tasks?.filter(t => ['approved', 'edited', 'sent'].includes(t.status)).length || 0
  const dismissed = tasks?.filter(t => t.status === 'dismissed').length || 0

  await bot.sendMessage(chatId, `<b>Task Board — Today</b>\n\nPending: ${pending}\nCompleted: ${done}\nDismissed: ${dismissed}`, { parse_mode: 'HTML' })
}

export async function handleSummaryCommand(chatId: number): Promise<void> {
  const supabase = getServiceClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('category, sender_name, channel, status')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(15)

  if (!tasks || tasks.length === 0) {
    await bot.sendMessage(chatId, 'No tasks today yet.')
    return
  }

  const lines = tasks.map(t => `[${t.category}] #${t.channel} — ${t.sender_name || 'Unknown'} (${t.status})`)
  await bot.sendMessage(chatId, `<b>Today's Summary (${tasks.length}):</b>\n\n${lines.join('\n')}`, { parse_mode: 'HTML' })
}
