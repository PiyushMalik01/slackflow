import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAuthClient } from '@/lib/db/client'
import { getCategories, createCategory, updateCategory, deleteCategory, seedDefaultCategories } from '@/lib/db/queries'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

const createSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional().default(''),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#6B7280'),
  emoji: z.string().max(10).optional().default(''),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  emoji: z.string().max(10).optional(),
})

export async function GET() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const categories = await getCategories(user.id)
    if (categories.length === 0) {
      await seedDefaultCategories(user.id)
      const seeded = await getCategories(user.id)
      return jsonOk(seeded)
    }
    return jsonOk(categories)
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

    const cat = await createCategory({ owner_id: user.id, ...parsed.data })
    return jsonOk(cat, 201)
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

    const { id, ...data } = parsed.data
    await updateCategory(id, data)
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

    await deleteCategory(id)
    return jsonOk({ success: true })
  } catch {
    return json500()
  }
}
