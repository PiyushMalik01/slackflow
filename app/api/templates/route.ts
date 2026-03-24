import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
  category_id: z.string().uuid().nullable().optional().default(null),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(2000).optional(),
  category_id: z.string().uuid().nullable().optional(),
})

export async function GET() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const svc = getServiceClient()
    const { data, error } = await svc
      .from('response_templates')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (error) return json500()
    return jsonOk(data ?? [])
  } catch {
    return json500()
  }
}

export async function POST(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return json400(parsed.error.issues[0]?.message || 'Invalid input')

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('response_templates')
      .insert({ owner_id: user.id, ...parsed.data })
      .select()
      .single()
    if (error) return json500()
    return jsonOk(data, 201)
  } catch {
    return json500()
  }
}

export async function PUT(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return json400(parsed.error.issues[0]?.message || 'Invalid input')

    const { id, ...updates } = parsed.data
    const svc = getServiceClient()

    // Verify ownership
    const { data: tmpl } = await svc.from('response_templates').select('owner_id').eq('id', id).maybeSingle()
    if (!tmpl || tmpl.owner_id !== user.id) return json403('Template not found')

    const { error } = await svc.from('response_templates').update(updates).eq('id', id)
    if (error) return json500()
    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return json400('Missing id')

    const svc = getServiceClient()

    // Verify ownership
    const { data: tmpl } = await svc.from('response_templates').select('owner_id').eq('id', id).maybeSingle()
    if (!tmpl || tmpl.owner_id !== user.id) return json403('Template not found')

    const { error } = await svc.from('response_templates').delete().eq('id', id)
    if (error) return json500()
    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
