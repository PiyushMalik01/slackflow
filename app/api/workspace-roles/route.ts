import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { setWorkspaceRole, removeWorkspaceRole, getCompanyName } from '@/lib/db/queries'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

const setSchema = z.object({
  workspace_id: z.string().uuid(),
  category_id: z.string().uuid(),
  role_id: z.string().uuid().optional().nullable(),
})

export async function POST(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const body = await req.json()
    const parsed = setSchema.safeParse(body)
    if (!parsed.success) return json400(parsed.error.issues[0]?.message || 'Invalid input')

    const { workspace_id, category_id, role_id } = parsed.data

    // Validate: category must belong to the workspace owner (not just any user)
    const svcCheck = getServiceClient()
    const { data: ws } = await svcCheck.from('workspaces').select('owner_id').eq('id', workspace_id).maybeSingle()
    if (ws) {
      const { data: cat } = await svcCheck.from('categories').select('owner_id').eq('id', category_id).maybeSingle()
      if (cat && cat.owner_id !== ws.owner_id) {
        return json400('Category does not belong to the workspace owner. Use the workspace owner\'s categories for routing.')
      }
    }

    if (role_id) {
      await setWorkspaceRole(workspace_id, category_id, role_id, user.id)

      // Notify the newly assigned member if they have a linked Telegram
      try {
        const svc = getServiceClient()
        const { data: role } = await svc
          .from('roles')
          .select('telegram_chat_id, name')
          .eq('id', role_id)
          .maybeSingle()
        const { data: category } = await svc
          .from('categories')
          .select('name, emoji')
          .eq('id', category_id)
          .maybeSingle()
        const { data: workspace } = await svc
          .from('workspaces')
          .select('name')
          .eq('id', workspace_id)
          .maybeSingle()

        if (role?.telegram_chat_id && category && workspace) {
          const companyName = await getCompanyName(user.id)
          const { bot } = await import('@/lib/telegram/bot')
          await bot.sendMessage(
            role.telegram_chat_id,
            `${category.emoji || ''} You've been assigned to handle <b>${category.name}</b> tasks for <b>${companyName}</b>. You'll receive notifications when matching messages come in.`,
            { parse_mode: 'HTML' },
          )
        }
      } catch { /* ignore send errors */ }
    } else {
      // Before removing, look up the current assignee to notify them
      try {
        const svc = getServiceClient()
        const { data: existing } = await svc
          .from('workspace_roles')
          .select('role_id')
          .eq('workspace_id', workspace_id)
          .eq('category_id', category_id)
          .maybeSingle()

        if (existing?.role_id) {
          const { data: role } = await svc
            .from('roles')
            .select('telegram_chat_id, name')
            .eq('id', existing.role_id)
            .maybeSingle()
          const { data: category } = await svc
            .from('categories')
            .select('name, emoji')
            .eq('id', category_id)
            .maybeSingle()
          const { data: workspace } = await svc
            .from('workspaces')
            .select('name')
            .eq('id', workspace_id)
            .maybeSingle()

          if (role?.telegram_chat_id && category && workspace) {
            const companyName = await getCompanyName(user.id)
            const { bot } = await import('@/lib/telegram/bot')
            await bot.sendMessage(
              role.telegram_chat_id,
              `${category.emoji || ''} You've been unassigned from <b>${category.name}</b> tasks for <b>${companyName}</b>.`,
              { parse_mode: 'HTML' },
            )
          }
        }
      } catch { /* ignore send errors */ }

      await removeWorkspaceRole(workspace_id, category_id, user.id)
    }

    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
