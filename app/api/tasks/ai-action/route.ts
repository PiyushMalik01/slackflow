import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAuthClient, getServiceClient } from '@/lib/db/client'
import { getCategories } from '@/lib/db/queries'
import { getOpenAIClient } from '@/lib/ai/client'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

const actionSchema = z.object({
  action: z.enum(['recategorize', 'clean_noise']),
  task_ids: z.array(z.string().uuid()).min(1).max(50),
})

export async function POST(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const body = await req.json()
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) return json400(parsed.error.issues[0]?.message || 'Invalid input')

    const svc = getServiceClient()

    // Fetch tasks
    const { data: tasks } = await svc
      .from('tasks')
      .select('id, original_text, category, workspace_id')
      .in('id', parsed.data.task_ids)

    if (!tasks || tasks.length === 0) return json400('No tasks found')

    // Verify ownership
    const wsIds = [...new Set(tasks.map(t => t.workspace_id))]
    for (const wsId of wsIds) {
      const { data: ws } = await svc.from('workspaces').select('id').eq('id', wsId).eq('owner_id', user.id).maybeSingle()
      if (!ws) return json403('Not authorized')
    }

    const categories = await getCategories(user.id)
    const categoryNames = categories.map(c => `"${c.name}": ${c.description}`).join('\n')

    const client = await getOpenAIClient(user.id)

    if (parsed.data.action === 'recategorize') {
      // Ask AI to recategorize each task
      const taskList = tasks.map(t => `ID:${t.id} | Text: "${t.original_text?.substring(0, 100)}"`).join('\n')

      const response = await client.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a message categorizer. Given these categories:\n${categoryNames}\n\nCategorize each task. Return JSON array: [{"id":"task-uuid","category":"CategoryName"}]`,
          },
          { role: 'user', content: taskList },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
        temperature: 0.2,
      })

      const raw = JSON.parse(response.choices[0]?.message?.content || '{}')
      const results = raw.tasks || raw.results || raw

      let updated = 0
      if (Array.isArray(results)) {
        for (const r of results) {
          const cat = categories.find(c => c.name.toLowerCase() === (r.category || '').toLowerCase())
          if (cat && r.id) {
            await svc.from('tasks').update({ category: cat.name, category_id: cat.id }).eq('id', r.id)
            updated++
          }
        }
      }

      return jsonOk({ success: true, action: 'recategorize', updated })
    }

    if (parsed.data.action === 'clean_noise') {
      // Ask AI which tasks are noise (system messages, irrelevant, spam)
      const taskList = tasks.map(t => `ID:${t.id} | Text: "${t.original_text?.substring(0, 150)}"`).join('\n')

      const response = await client.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You analyze Slack messages. Identify which are noise (system messages, bot messages, join/leave notifications, empty or meaningless messages, spam). Return JSON: {"noise_ids":["id1","id2"],"reason":"why each is noise"}',
          },
          { role: 'user', content: taskList },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.1,
      })

      const raw = JSON.parse(response.choices[0]?.message?.content || '{}')
      const noiseIds: string[] = raw.noise_ids || []

      if (noiseIds.length > 0) {
        await svc.from('tasks').delete().in('id', noiseIds)
      }

      return jsonOk({ success: true, action: 'clean_noise', deleted: noiseIds.length, reason: raw.reason })
    }

    return json400('Unknown action')
  } catch {
    return json500()
  }
}
