import { z } from 'zod'

const DraftSchema = z
  .object({
    draft: z.string().min(1),
    tone: z.string().optional(),
  })
  .passthrough() // allow extra fields (severity, priority_hint)

export function parseAiOutput(raw: string): {
  type: 'structured' | 'plain_text'
  draft: string
  [key: string]: unknown
} {
  // 1. Strip markdown fences
  const stripped = raw.replace(/```(?:json)?\n?|\n?```/g, '').trim()

  // 2. Extract JSON object
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { type: 'plain_text', draft: raw }
  }

  // 3. Validate with Zod
  try {
    const parsed = JSON.parse(jsonMatch[0])
    const validated = DraftSchema.parse(parsed)
    return { type: 'structured', ...validated }
  } catch {
    return { type: 'plain_text', draft: raw }
  }
}
