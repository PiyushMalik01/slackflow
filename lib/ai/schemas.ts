import { z } from 'zod'

export const classifyAndDraftSchema = z.object({
  actionable: z.boolean(),
  category: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  draft: z.string(),
  tone: z.string().optional(),
})

export type ClassifyAndDraftResult = z.infer<typeof classifyAndDraftSchema>
