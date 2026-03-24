import { NextRequest } from 'next/server'
import { after } from 'next/server'
import { verifySlackSignature } from '@/lib/utils/security'
import { handleSlackMessage } from '@/lib/pipeline/orchestrator'
import { logger } from '@/lib/utils/logger'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') || ''
  const signature = req.headers.get('x-slack-signature') || ''

  // URL verification challenge
  try {
    const body = JSON.parse(rawBody)
    if (body.type === 'url_verification') {
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch { /* not JSON, continue */ }

  // Verify Slack signature
  const signingSecret = process.env.SLACK_SIGNING_SECRET || ''
  if (!verifySlackSignature(rawBody, timestamp, signature, signingSecret)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const event = body.event

  if (!event || event.type !== 'message') {
    return new Response('ok')
  }

  // Find workspace by team ID
  // The team_id comes from the event wrapper
  const teamId = body.team_id

  // Background processing via after()
  after(async () => {
    try {
      const { getServiceClient } = await import('@/lib/db/client')
      const supabase = getServiceClient()
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slack_team_id', teamId)
        .maybeSingle()

      if (!workspace) {
        logger.warn({ teamId }, 'No workspace found for team')
        return
      }

      await handleSlackMessage({ ...event, event_id: body.event_id }, workspace.id)
    } catch (err) {
      logger.error({ err }, 'Pipeline error in after()')
    }
  })

  return new Response('ok')
}
