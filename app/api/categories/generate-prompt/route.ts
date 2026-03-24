import { NextRequest } from 'next/server'
import { createAuthClient } from '@/lib/db/client'
import { getOpenAIClient } from '@/lib/ai/client'
import { validateOrigin } from '@/lib/utils/csrf'
import { jsonOk, json400, json401, json403, json500 } from '@/lib/utils/api-helpers'

export async function POST(req: NextRequest) {
  if (!(await validateOrigin())) return json403('Invalid origin')
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json401()

  try {
    const { name, description } = await req.json()
    if (!name) return json400('Category name required')

    const client = await getOpenAIClient(user.id)
    const response = await client.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write concise AI draft instructions for a task routing system called SlackFlow.
Given a category name and optional description, generate a 2-3 sentence instruction that tells the AI how to draft responses for messages in this category.
The instruction should define: tone, what to acknowledge, what NOT to promise, and how urgent/casual the response should be.
Return ONLY the instruction text, no quotes or explanation.`,
        },
        {
          role: 'user',
          content: `Category: "${name}"${description ? `\nDescription: ${description}` : ''}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    })

    const prompt = response.choices[0]?.message?.content?.trim() || ''
    return jsonOk({ prompt })
  } catch {
    return json500()
  }
}
