import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const scopes = 'channels:history,channels:join,channels:read,chat:write,commands,users:read'
  const clientId = process.env.SLACK_CLIENT_ID
  // SLACK_REDIRECT_URI must be the ngrok URL so Slack can hit it publicly
  const redirectUri = process.env.SLACK_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/callback`
  const state = user.id // pass user ID in state for callback

  const slackUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`

  return NextResponse.redirect(slackUrl)
}
