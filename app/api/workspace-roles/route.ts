import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAuthClient } from '@/lib/db/client'
import { setWorkspaceRole, removeWorkspaceRole } from '@/lib/db/queries'
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

    if (role_id) {
      await setWorkspaceRole(workspace_id, category_id, role_id)
    } else {
      await removeWorkspaceRole(workspace_id, category_id)
    }

    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
