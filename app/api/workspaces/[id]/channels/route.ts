import { NextRequest } from 'next/server'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { listWorkspaceChannels } from '@/lib/slack/channels'
import { decrypt } from '@/lib/utils/security'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  const { id } = await params

  const svc = getServiceClient()
  const { data: workspace } = await svc.from('workspaces').select('*').eq('id', id).eq('owner_id', user.id).maybeSingle()
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
    const { error } = await svc
      .from('workspaces')
      .update({ monitored_channels: monitoredChannels })
      .eq('id', id)
      .eq('owner_id', user.id)

    if (error) throw error
    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
