import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/db/client'
import { setWorkspaceRole, removeWorkspaceRole } from '@/lib/db/queries'
import type { TaskCategory } from '@/lib/db/types'

export async function POST(req: NextRequest) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { workspace_id, category, role_id } = body

    if (role_id) {
      await setWorkspaceRole(workspace_id, category as TaskCategory, role_id)
    } else {
      await removeWorkspaceRole(workspace_id, category as TaskCategory)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
