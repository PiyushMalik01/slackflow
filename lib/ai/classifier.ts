import { getOpenAIClient } from '@/lib/ai/client'
import { classifyAndDraftSchema, type ClassifyAndDraftResult } from '@/lib/ai/schemas'
import { logger } from '@/lib/utils/logger'

interface Category {
  id: string
  name: string
  description: string
  emoji: string
  system_prompt?: string
}

interface TeamMember {
  id: string
  name: string
  type: string
  status?: string
}

interface RoutingRule {
  category_id: string
  role_id: string
}

export async function classifyAndDraft(
  message: string,
  senderName: string,
  channel: string,
  categories: Category[],
  teamMembers: TeamMember[],
  routingRules: RoutingRule[],
  workspaceName: string,
  threadContext?: string | null,
  ownerId?: string,
): Promise<ClassifyAndDraftResult & { promptVersion: string }> {
  // Build routing context
  const routingContext = categories.map(cat => {
    const rule = routingRules.find(r => r.category_id === cat.id)
    const member = rule ? teamMembers.find(m => m.id === rule.role_id) : null

    let routedTo = 'Unassigned'
    if (member) {
      routedTo = `${member.name} (${member.type})`
    }

    let entry = `- "${cat.name}" (${cat.emoji}): ${cat.description} → ROUTED TO: ${routedTo}`
    if (cat.system_prompt) {
      entry += `\n  Draft style: ${cat.system_prompt}`
    }
    return entry
  }).join('\n')

  const teamContext = teamMembers.length > 0
    ? teamMembers.map(m => {
        const linked = m.status === 'linked' ? '✓ Telegram linked' : '○ pending'
        return `- ${m.name} — ${m.type} (${linked})`
      }).join('\n')
    : 'No team members configured yet.'

  const promptVersion = 'v4.0-full-context'

  const systemPrompt = `You are the AI engine behind SlackFlow — an internal task routing system. Your classification determines which team member gets notified, so precision matters.

## Workspace: ${workspaceName}
Channel: #${channel}

## Categories & Routing
${routingContext}

## Team Members
${teamContext}

## Classification Rules
- Read the message carefully. Understand the INTENT, not just keywords.
- Consider WHO should handle this. "The button color is off" → Design (designer handles it). "The button crashes the app" → Bug (developer handles it).
- If a category has no one routed to it, the task will be unassigned and the admin must manually assign it. Prefer categories that have active routing when the message could fit multiple.
- If a message contains multiple intents, pick the PRIMARY one.
- Set confidence 0.0-1.0. Above 0.8 = very sure. Below 0.5 = genuinely ambiguous.

## Draft Rules
- 1-2 sentences MAX. Reference the specific request.
- Mention the team member by name if routed: "Flagging this to Rahul on the dev team."
- Sound like a human coworker, not a support bot.
- NO filler phrases ("Thanks for reaching out", "Stay tuned", "We appreciate...").
- NEVER promise timelines, features, or outcomes.
- Follow category-specific draft instructions if provided.

## Response Format
Return JSON:
{
  "category": "<exact category name>",
  "confidence": <0.0-1.0>,
  "reasoning": "<1 sentence: why this category and who handles it>",
  "draft": "<1-2 sentence acknowledgment mentioning the person if routed>",
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
