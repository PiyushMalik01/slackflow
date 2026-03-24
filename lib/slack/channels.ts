import { WebClient } from '@slack/web-api'
import { logger } from '@/lib/utils/logger'

export interface SlackChannel {
  id: string
  name: string
  is_member: boolean
  num_members: number
  topic: string
}

export async function listWorkspaceChannels(accessToken: string): Promise<SlackChannel[]> {
  const client = new WebClient(accessToken)
  const channels: SlackChannel[] = []
  let cursor: string | undefined

  do {
    const result = await client.conversations.list({
      types: 'public_channel',
      exclude_archived: true,
      limit: 200,
      cursor,
    })

    for (const ch of result.channels || []) {
      channels.push({
        id: ch.id || '',
        name: ch.name || '',
        is_member: ch.is_member || false,
        num_members: ch.num_members || 0,
        topic: (ch.topic as any)?.value || '',
      })
    }

    cursor = result.response_metadata?.next_cursor || undefined
  } while (cursor)

  return channels
}
