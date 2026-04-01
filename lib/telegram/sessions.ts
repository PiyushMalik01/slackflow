import { getServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'

export interface TgSession {
  id: string
  chat_id: string
  task_id: string
  state: 'editing' | 'confirming' | 'routing' | 'redirecting'
  draft_text: string | null
  target_action: string | null
  expires_at: string
}

export async function startEditSession(chatId: string, taskId: string): Promise<TgSession> {
  const supabase = getServiceClient()
  await supabase.from('telegram_sessions').delete().eq('chat_id', chatId)

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('telegram_sessions')
    .insert({ chat_id: chatId, task_id: taskId, state: 'editing' as const, expires_at: expiresAt })
    .select()
    .single()

  if (error) throw error
  return data as TgSession
}

export async function getActiveSession(chatId: string): Promise<TgSession | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('telegram_sessions')
    .select('*')
    .eq('chat_id', chatId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as TgSession) || null
}

export async function updateSessionState(
  sessionId: string,
  state: 'editing' | 'confirming',
  draftText?: string
): Promise<void> {
  const supabase = getServiceClient()
  const update: Record<string, unknown> = { state }
  if (draftText !== undefined) update.draft_text = draftText
  await supabase.from('telegram_sessions').update(update).eq('id', sessionId)
}

export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('telegram_sessions').delete().eq('id', sessionId)
}

export async function startRoutingSession(chatId: string, taskId: string, state: 'routing' | 'redirecting', roleList: string): Promise<TgSession> {
  const supabase = getServiceClient()
  await supabase.from('telegram_sessions').delete().eq('chat_id', chatId)

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('telegram_sessions')
    .insert({ chat_id: chatId, task_id: taskId, state, expires_at: expiresAt, target_action: roleList })
    .select()
    .single()

  if (error) throw error
  return data as TgSession
}

export async function cleanupExpiredSessions(): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('telegram_sessions').delete().lt('expires_at', new Date().toISOString())
}
