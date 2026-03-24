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
    const { name, category_name } = await req.json()
    if (!name) return json400('Template name required')

    const client = await getOpenAIClient(user.id)
    const response = await client.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write short, professional Slack response templates for a task routing platform called SlackFlow.
Given a template name and optional category, generate a 1-3 sentence response that a team member would send back to a client in a Slack thread.

Rules:
- Sound like a real human coworker, not a support bot
- Be concise and direct
- Don't use "Thank you for reaching out" or similar filler
- Don't promise timelines unless the template name implies it
- Match the tone to the template name (urgent for bugs, receptive for features, etc.)

Return ONLY the response text, no quotes or explanation.`
        },
        {
          role: 'user',
          content: `Template name: "${name}"${category_name ? `\nCategory: ${category_name}` : ''}`
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    })

    const content = response.choices[0]?.message?.content?.trim() || ''
    return jsonOk({ content })
  } catch {
    return json500()
  }
}
