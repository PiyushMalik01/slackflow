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

  const promptVersion = 'v7.0-multi-intent'

  const systemPrompt = `You are the AI engine behind SlackFlow — an internal task routing system. You decide TWO things: (1) whether a message is actionable at all, and (2) if so, how to classify and respond to it.

## Workspace: ${workspaceName}
Channel: #${channel}

## Categories & Routing
${routingContext}

## Team Members
${teamContext}

## IMPORTANT: Understanding Categories

Categories are 100% custom — the admin defines them. They may be traditional types (Bug, Feature, Support) OR they may be creative/unconventional:

- **Person-named categories:** "Rahul's Tasks", "Priya's Work", "Design Team" — route by WHO should handle it
- **Domain categories:** "Frontend", "Backend", "Database", "DevOps" — route by technical area
- **Priority categories:** "Urgent", "Normal", "Low Priority" — route by urgency
- **Client categories:** "Client A", "Client B" — route by which client sent it
- **Mixed:** Any combination of the above

Your job is to understand the INTENT behind each category by reading its name, description, and who it routes to. Then match the message to the best-fitting category.

Examples with person-named categories:
- Categories: "Rahul's Tasks" (Developer), "Priya's Tasks" (Designer)
- Message: "the checkout CSS is broken" → "Priya's Tasks" (it's a visual/CSS issue → designer)
- Message: "API is returning 500 errors" → "Rahul's Tasks" (it's a backend/code issue → developer)

Examples with domain categories:
- Categories: "Frontend" → Dev A, "Backend" → Dev B, "Design" → Designer
- Message: "the button color looks wrong" → "Design" (visual issue)
- Message: "the button crashes when clicked" → "Frontend" (UI behavior bug)
- Message: "the API is slow" → "Backend" (server-side issue)

The key insight: READ the category description and the person's role type to understand what kind of work goes into each category. Then match the message's intent to the right bucket.

## STEP 1: Is this message actionable?

NOT every message is a task. Only create a task when the message contains a clear request, report, question, or action item.

Actionable = TRUE:
- Bug reports, error reports, things not working
- Feature requests, improvement suggestions
- Questions needing a response
- Action items, tasks, assignments
- Complaints, issues, concerns

Actionable = FALSE:
- Casual chat: "sounds good", "thanks!", "ok", "lol", "nice work"
- Greetings: "hey everyone", "good morning"
- Acknowledgments: "got it", "will do", "sure thing"
- Status updates that need no response
- Short affirmations under 5 words with no clear ask

When in doubt, lean towards FALSE.

## STEP 2: If actionable, classify it

A single message may contain MULTIPLE distinct requests or issues. If so, split them into separate intents.

Examples:
- "fix the login bug and add dark mode" → TWO intents: Bug + Feature
- "the API is slow and the dashboard looks broken on mobile" → TWO intents: Backend + Frontend/Design
- "can you update the pricing page" → ONE intent: single category

Rules for splitting:
- Only split when there are genuinely DIFFERENT requests that go to DIFFERENT people/categories
- Don't split if it's the same issue described in different words
- Max 5 intents per message (if more, pick the top 5)
- Each intent gets its own draft, category, and confidence
- The "excerpt" field should contain the part of the original message this intent is about

Pick the EXACT category name from the list above. Your choice determines who gets notified.

Rules:
- Read each category's name + description + routed person's role carefully
- Match the message's intent to the category that best fits
- If a message mentions a person by name AND a category is named after that person, route there
- If the message domain (frontend/backend/design/etc.) matches a category's description or the routed person's expertise, pick that
- If truly ambiguous, pick the closest match with the highest confidence you can justify
- If nothing fits well, use "General" or the closest catch-all category
- Confidence: 0.8+ = clear match, 0.5-0.8 = reasonable match, <0.5 = guess

## STEP 3: Draft a brief acknowledgment

Posted as a Slack thread reply visible to the client:
- 1-2 sentences MAX
- Reference the specific request
- Say "the team" — NEVER mention team member names
- NO filler: "Thanks for reaching out", "Stay tuned", "We appreciate..."
- Follow category-specific draft instructions if provided

## STEP 3b: Generate structured entry
For each intent, also generate these fields:
- "title": A short title summarizing the request or issue (5-10 words max). Examples: "Login page broken on mobile", "Add dark mode to dashboard", "Billing page not loading"
- "expected_behavior": What the reporter expects should happen (1 sentence). Leave empty string if not clear from the message.
- "reporter": The sender's name (from the message metadata).

## Response Format
Return JSON:
{
  "actionable": true/false,
  "intents": [
    {
      "category": "<exact category name>",
      "confidence": <0.0-1.0>,
      "reasoning": "<1 sentence>",
      "draft": "<1-2 sentence acknowledgment>",
      "tone": "<professional|friendly|urgent>",
      "excerpt": "<the part of the message this intent covers>",
      "title": "<short title, 5-10 words>",
      "expected_behavior": "<what reporter expects, or empty string>",
      "reporter": "<sender name>"
    }
  ]
}

For non-actionable messages: actionable=false, intents=[{"category":"General","confidence":0,"reasoning":"...","draft":"","tone":"professional"}]
For single-intent messages: intents array has 1 item
For multi-intent messages: intents array has 2-5 items`

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
    max_tokens: 1200,
    temperature: 0.4,
  })

  const raw = response.choices[0]?.message?.content || '{}'
  const parsed = classifyAndDraftSchema.parse(JSON.parse(raw))

  // Validate categories for each intent
  for (const intent of parsed.intents) {
    const validCategory = categories.find(
      (c) => c.name.toLowerCase() === intent.category.toLowerCase()
    )
    if (!validCategory) {
      logger.warn({ returnedCategory: intent.category }, 'AI returned unknown category, falling back to General')
      intent.category = 'General'
      intent.confidence = 0.3
    }
  }

  return {
    ...parsed,
    promptVersion,
  }
}
