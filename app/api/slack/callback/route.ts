import { NextRequest, NextResponse } from 'next/server'
import { encrypt } from '@/lib/utils/security'
import { getServiceClient } from '@/lib/db/client'
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

    const svc = getServiceClient()

    // Check if workspace already exists for this Slack team
    const { data: existing } = await svc
      .from('workspaces')
      .select('id, owner_id')
      .eq('slack_team_id', data.team.id)
      .maybeSingle()

    if (existing) {
      // Workspace exists — join as member, update token
      await svc.from('workspace_members').upsert({
        workspace_id: existing.id,
        user_id: state,
        role: 'admin',
      }, { onConflict: 'workspace_id,user_id' })

      // Update the access token (new auth may have better scopes)
      const { enc: tokenEnc, iv: tokenIv } = encrypt(data.access_token)
      await svc.from('workspaces').update({
        access_token_enc: tokenEnc,
        access_token_iv: tokenIv,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)

      logger.info({ teamId: data.team.id, userId: state }, 'User joined existing workspace')
      return NextResponse.redirect(new URL('/dashboard/workspaces?success=joined', appUrl))
    } else {
      // New workspace — create it
      const { enc: tokenEnc, iv: tokenIv } = encrypt(data.access_token)
      const { data: ws } = await svc.from('workspaces').insert({
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
      }).select().single()

      if (ws) {
        await svc.from('workspace_members').insert({
          workspace_id: ws.id,
          user_id: state,
          role: 'admin',
        })
      }

      logger.info({ teamId: data.team.id }, 'Workspace installed successfully')
      return NextResponse.redirect(new URL('/dashboard/workspaces?success=1', appUrl))
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error({ error: msg }, 'Slack callback error')
    return NextResponse.redirect(
      new URL(`/dashboard/workspaces?error=server_error&detail=${encodeURIComponent(msg)}`, appUrl)
    )
  }
}
