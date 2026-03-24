import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/db/client'
import { upsertRole, updateRole, deleteRole } from '@/lib/db/queries'

export async function POST(req: NextRequest) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const contentType = req.headers.get('content-type') ?? ''
    let name: string | null = null
    let type: string | null = null
    let telegram_chat_id: string | null = null

    if (contentType.includes('application/json')) {
      const body = await req.json()
      name = body.name ?? null
      type = body.type ?? null
      telegram_chat_id = body.telegram_chat_id ?? null
    } else {
      const formData = await req.formData()
      name = String(formData.get('name') ?? '').trim() || null
      type = String(formData.get('type') ?? '').trim() || null
      telegram_chat_id = String(formData.get('telegram_chat_id') ?? '').trim() || null
    }

    const role = await upsertRole({
      owner_id: user.id,
      name: name ?? '',
      type: type || 'BUILDER',
      telegram_chat_id: telegram_chat_id || null,
    })

    if (!contentType.includes('application/json')) {
      return NextResponse.redirect(new URL('/dashboard/settings', req.url))
    }

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
