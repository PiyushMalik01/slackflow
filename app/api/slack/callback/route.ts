import { NextRequest, NextResponse } from 'next/server'
import { encrypt } from '@/lib/utils/security'
import { upsertWorkspace } from '@/lib/db/queries'
import { logger } from '@/lib/utils/logger'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user ID

  // NEXT_PUBLIC_APP_URL = localhost:3000 (final browser redirect — keeps cookies working)
  // SLACK_REDIRECT_URI   = ngrok URL     (OAuth plumbing — must be publicly accessible)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const slackRedirectUri = process.env.SLACK_REDIRECT_URI ?? appUrl + '/api/slack/callback'

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/workspaces?error=missing_params', appUrl))
  }

  try {
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: slackRedirectUri,
      }),
    })

    const data = await tokenRes.json()

    if (!data.ok) {
      logger.error({ slackError: data.error, slackData: data }, 'Slack OAuth failed')
      // Pass the actual error code so user/developer can see it
      return NextResponse.redirect(
        new URL(`/dashboard/workspaces?error=oauth_failed&detail=${data.error}`, appUrl)
      )
    }

    const { enc: tokenEnc, iv: tokenIv } = encrypt(data.access_token)

    await upsertWorkspace({
      owner_id: state,
      slack_team_id: data.team.id,
      name: data.team.name,
      access_token_enc: tokenEnc,
      access_token_iv: tokenIv,
      bot_user_id: data.bot_user_id ?? data.authed_user?.id ?? '',
      monitored_channels: [],
      team_group_chat_id: null,
      daily_digest_time: null,
      accent_color: '#3B82F6',
    })

    logger.info({ teamId: data.team.id }, 'Workspace installed successfully')
    return NextResponse.redirect(new URL('/dashboard/workspaces?success=1', appUrl))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error({ error: msg }, 'Slack callback error')
    return NextResponse.redirect(
      new URL(`/dashboard/workspaces?error=server_error&detail=${encodeURIComponent(msg)}`, appUrl)
    )
  }
}
