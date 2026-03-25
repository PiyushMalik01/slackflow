import { NextRequest } from 'next/server'
import { WebClient } from '@slack/web-api'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { listWorkspaceChannels } from '@/lib/slack/channels'
import { decrypt } from '@/lib/utils/security'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'
import { logger } from '@/lib/utils/logger'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  const { id } = await params

  const svc = getServiceClient()
  // Verify user is a member of this workspace
  const { data: membership } = await svc.from('workspace_members').select('workspace_id').eq('workspace_id', id).eq('user_id', user.id).maybeSingle()
  if (!membership) return json403('Workspace not found')
  const { data: workspace } = await svc.from('workspaces').select('*').eq('id', id).maybeSingle()
  if (!workspace) return json403('Workspace not found')

  try {
    const accessToken = decrypt(workspace.access_token_enc, workspace.access_token_iv)
    const channels = await listWorkspaceChannels(accessToken)
    const monitored = workspace.monitored_channels || []

    const enriched = channels.map(ch => ({
      ...ch,
      is_monitored: monitored.includes(ch.id),
    }))

    return jsonOk(enriched)
  } catch (err: any) {
    if (err?.data?.error === 'missing_scope') {
      return jsonOk({ needs_reauth: true, channels: [] })
    }
    return json500()
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  const { id } = await params

  try {
    const body = await req.json()
    const monitoredChannels: string[] = body.monitored_channels
    if (!Array.isArray(monitoredChannels)) return json400('monitored_channels must be an array')

    const svc = getServiceClient()

    // Verify user is a member of this workspace
    const { data: membership } = await svc.from('workspace_members').select('workspace_id').eq('workspace_id', id).eq('user_id', user.id).maybeSingle()
    if (!membership) return json403('Workspace not found')
    const { data: workspace } = await svc.from('workspaces').select('*').eq('id', id).maybeSingle()
    if (!workspace) return json403('Workspace not found')

    const previousChannels: string[] = workspace.monitored_channels || []
    const added = monitoredChannels.filter(ch => !previousChannels.includes(ch))
    const removed = previousChannels.filter(ch => !monitoredChannels.includes(ch))

    // Auto-join/leave channels via Slack API
    const accessToken = decrypt(workspace.access_token_enc, workspace.access_token_iv)
    const slack = new WebClient(accessToken)

    const joinErrors: string[] = []

    // Join newly monitored channels
    for (const channelId of added) {
      try {
        await slack.conversations.join({ channel: channelId })
        // Post a welcome message in the channel
        await slack.chat.postMessage({
          channel: channelId,
          text: '👋 SlackFlow is now monitoring this channel. Messages will be classified by AI and routed to the right team member.',
        })
        logger.info({ channelId, workspaceId: id }, 'Bot joined channel')
      } catch (err: any) {
        if (err?.data?.error === 'already_in_channel') {
          // Already in channel — just update monitoring, no error
          logger.info({ channelId }, 'Bot already in channel, monitoring enabled')
        } else if (err?.data?.error === 'missing_scope') {
          joinErrors.push(`Missing permission — please re-authorize the Slack app with updated scopes`)
        } else {
          logger.warn({ err: err?.data?.error, channelId }, 'Failed to join channel')
          joinErrors.push(`Failed to join channel: ${err?.data?.error || 'unknown error'}`)
        }
      }
    }

    // Leave un-monitored channels
    for (const channelId of removed) {
      try {
        // Post a goodbye message before leaving
        await slack.chat.postMessage({
          channel: channelId,
          text: '👋 SlackFlow has stopped monitoring this channel. Messages will no longer be routed.',
        })
        await slack.conversations.leave({ channel: channelId })
        logger.info({ channelId, workspaceId: id }, 'Bot left channel')
      } catch (err: any) {
        if (err?.data?.error !== 'not_in_channel') {
          logger.warn({ err: err?.data?.error, channelId }, 'Failed to leave channel')
        }
      }
    }

    // Update monitored channels list in DB
    const { error } = await svc
      .from('workspaces')
      .update({ monitored_channels: monitoredChannels })
      .eq('id', id)

    if (error) throw error

    return jsonOk({
      success: true,
      joined: added.length,
      left: removed.length,
      errors: joinErrors.length > 0 ? joinErrors : undefined,
    })
  } catch {
    return json500()
  }
}
