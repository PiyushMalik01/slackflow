import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature } from '@/lib/utils/security'
import { handleSlackMessage } from '@/lib/pipeline/orchestrator'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''
  const signingSecret = process.env.SLACK_SIGNING_SECRET ?? ''

  // 1. Verify Slack signature
  if (!verifySlackSignature(body, timestamp, signature, signingSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)

  // 2. Handle URL verification challenge (Slack app setup)
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // 3. Acknowledge immediately (Slack requires < 3s response)
  // Dispatch to orchestrator in the background
  const event = payload.event
  if (event?.type === 'message' || event?.type === 'message.channels') {
    // Non-blocking — we return 200 immediately
    setImmediate(() => {
      handleSlackMessage({
        type: event.type,
        text: event.text ?? '',
        user: event.user ?? '',
        channel: event.channel ?? '',
        ts: event.ts ?? '',
        team: payload.team_id ?? '',
        username: event.username,
        bot_id: event.bot_id,
        subtype: event.subtype,
      }).catch(() => {
        // Swallow — already logged inside orchestrator
      })
    })
  }

  return NextResponse.json({ ok: true })
}
