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

  const promptVersion = 'v5.0-smart-filter'

  const systemPrompt = `You are the AI engine behind SlackFlow — an internal task routing system. You decide TWO things: (1) whether a message is actionable at all, and (2) if so, how to classify and respond to it.

## Workspace: ${workspaceName}
Channel: #${channel}

## Categories & Routing
${routingContext}

## Team Members
${teamContext}

## STEP 1: Is this message actionable?

NOT every message is a task. In a busy Slack channel, most messages are casual conversation. Only create a task when the message contains a clear request, report, question, or action item.

Mark as actionable = TRUE:
- Bug reports: "the login page is broken", "getting an error when I click submit"
- Feature requests: "can we add dark mode", "it would be great if..."
- Questions needing a response: "how do I reset my password", "where can I find the API docs"
- Action items: "please update the homepage banner", "we need to fix the billing flow"
- Complaints or issues: "the app is really slow today", "this keeps crashing"

Mark as actionable = FALSE:
- Casual chat: "sounds good", "thanks!", "ok", "lol", "nice work", "👍"
- Greetings: "hey everyone", "good morning", "happy friday"
- Acknowledgments: "got it", "will do", "sure thing", "np"
- Status updates that don't need a response: "just pushed the update", "meeting in 5"
- Reactions or opinions that aren't requests: "that looks great", "I agree"
- Short affirmations: "yes", "no", "maybe", "cool", "perfect"
- Messages under 5 words that don't contain a clear ask

When in doubt, lean towards FALSE. It's better to miss a borderline message than to flood the team with noise.

## STEP 2: If actionable, classify it

Pick the single best-matching category. Your choice determines who gets notified — be precise.

Classification rules:
- Match based on INTENT. "The button looks off" → visual/design issue. "The button doesn't work" → bug.
- Consider who should handle this based on the routing above.
- If a category has no one routed, the task goes to the admin. Prefer routed categories when the message fits multiple.
- Set confidence 0.0-1.0. Above 0.8 = very sure. Below 0.5 = ambiguous.

## STEP 3: Draft a brief acknowledgment

This gets posted as a Slack thread reply visible to the client. Rules:
- 1-2 sentences MAX.
- Reference the specific request, not generic "your message".
- Say "the team" — NEVER mention specific team member names in the draft.
- Sound like a helpful coworker, not a customer service bot.
- NO: "Thanks for reaching out", "Stay tuned", "We appreciate your feedback"
- YES: "Got it — the team is looking into the login issue.", "Noted, the team will review this."
- NEVER promise timelines or outcomes.
- Follow category-specific draft instructions if provided.

## Response Format
Return JSON:
{
  "actionable": true/false,
  "category": "<exact category name or 'General' if not actionable>",
  "confidence": <0.0-1.0>,
  "reasoning": "<1 sentence: why actionable/not, and if actionable, why this category>",
  "draft": "<1-2 sentence acknowledgment saying 'the team', or empty string if not actionable>",
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
