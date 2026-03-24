import { getServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'

export async function tryClaimEvent(eventId: string, workspaceId: string): Promise<boolean> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('processed_events')
    .insert({ event_id: eventId, workspace_id: workspaceId })

  if (error) {
    if (error.code === '23505') {
      logger.info({ eventId }, 'Duplicate event skipped')
      return false
    }
    logger.error({ error, eventId }, 'Error claiming event')
    return false
  }
  return true
}

export async function cleanupOldEvents(): Promise<void> {
  const supabase = getServiceClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('processed_events')
    .delete()
    .lt('processed_at', cutoff)
}
