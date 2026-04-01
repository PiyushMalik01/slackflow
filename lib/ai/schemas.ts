import { z } from 'zod'

const intentSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  draft: z.string(),
  tone: z.string().optional(),
  excerpt: z.string().optional(),
  title: z.string().optional(),
  expected_behavior: z.string().optional(),
  reporter: z.string().optional(),
})

export const classifyAndDraftSchema = z.object({
  actionable: z.boolean(),
  intents: z.array(intentSchema).min(1).max(5),
})

export type IntentResult = z.infer<typeof intentSchema>
export type ClassifyAndDraftResult = z.infer<typeof classifyAndDraftSchema>
