import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/db/client'
import { upsertRole, updateRole, deleteRole } from '@/lib/db/queries'

export async function POST(req: NextRequest) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const role = await upsertRole({
      owner_id: user.id,
      name: body.name,
      type: body.type || 'BUILDER',
      telegram_chat_id: body.telegram_chat_id || null,
    })
    return NextResponse.json(role)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { id, name, type, telegram_chat_id } = body
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
    
    await updateRole(id, { name, type, telegram_chat_id: telegram_chat_id || null })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    await deleteRole(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 })
  }
}
