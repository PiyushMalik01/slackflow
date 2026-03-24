import { getOpenAIClient } from '@/lib/ai/client'
import { classifyAndDraftSchema, type ClassifyAndDraftResult } from '@/lib/ai/schemas'
import { logger } from '@/lib/utils/logger'

interface Category {
  id: string
  name: string
  description: string
  emoji: string
}

export async function classifyAndDraft(
  message: string,
  senderName: string,
  channel: string,
  categories: Category[],
  threadContext?: string | null,
  ownerId?: string,
): Promise<ClassifyAndDraftResult & { promptVersion: string }> {
  const categoryList = categories
    .map((c) => `- "${c.name}" (${c.emoji}): ${c.description}`)
    .join('\n')

  const promptVersion = 'v2.0-dynamic'

  const systemPrompt = `You are an AI assistant for SlackFlow, a task routing platform.

Your job:
1. Classify the following Slack message into one of the defined categories
2. Draft a helpful response to post back in the Slack thread

Available categories:
${categoryList}

Rules:
- Pick the single best-matching category
- Set confidence 0.0-1.0 (1.0 = certain match)
- If unsure, use "General" with low confidence
- Draft should be professional, helpful, and concise
- Draft should acknowledge the message and indicate it's being handled

Respond in JSON format:
{
  "category": "<category name>",
  "confidence": <0.0-1.0>,
  "reasoning": "<why this category>",
  "draft": "<response to post in Slack>",
  "tone": "<professional|friendly|urgent>"
}`

  const userContent = threadContext
    ? `Thread context:\n${threadContext}\n\nNew message from ${senderName} in #${channel}:\n${message}`
    : `Message from ${senderName} in #${channel}:\n${message}`

  const client = await getOpenAIClient(ownerId)
  const response = await client.chat.completions.create({
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 600,
    temperature: 0.4,
  })

  const raw = response.choices[0]?.message?.content || '{}'
  const parsed = classifyAndDraftSchema.parse(JSON.parse(raw))

  const validCategory = categories.find(
    (c) => c.name.toLowerCase() === parsed.category.toLowerCase()
  )
  if (!validCategory) {
    logger.warn({ returnedCategory: parsed.category }, 'AI returned unknown category, falling back to General')
    parsed.category = 'General'
    parsed.confidence = 0.3
  }

  return {
    ...parsed,
    promptVersion,
  }
}
