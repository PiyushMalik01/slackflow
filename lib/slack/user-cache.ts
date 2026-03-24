import { WebClient } from '@slack/web-api'
import { getServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'

interface CachedUser {
  display_name: string
  avatar_url: string | null
}

export async function resolveSlackUser(
  accessToken: string,
  workspaceId: string,
  slackUserId: string
): Promise<CachedUser> {
  const supabase = getServiceClient()

  // Check cache (24h TTL)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from('slack_user_cache')
    .select('display_name, avatar_url')
    .eq('slack_user_id', slackUserId)
    .eq('workspace_id', workspaceId)
    .gt('cached_at', cutoff)
    .maybeSingle()

  if (cached) return cached

  try {
    const client = new WebClient(accessToken)
    const result = await client.users.info({ user: slackUserId })
    const user = result.user
    const displayName = user?.real_name || user?.name || slackUserId
    const avatarUrl = user?.profile?.image_72 || null

    await supabase
      .from('slack_user_cache')
      .upsert({
        slack_user_id: slackUserId,
        workspace_id: workspaceId,
        display_name: displayName,
        avatar_url: avatarUrl,
        cached_at: new Date().toISOString(),
      }, { onConflict: 'slack_user_id,workspace_id' })

    return { display_name: displayName, avatar_url: avatarUrl }
  } catch (err) {
    logger.warn({ err, slackUserId }, 'Failed to resolve Slack user, using ID as fallback')
    return { display_name: slackUserId, avatar_url: null }
  }
}
