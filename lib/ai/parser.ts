import { classifyAndDraftSchema, type ClassifyAndDraftResult } from '@/lib/ai/schemas'
import { logger } from '@/lib/utils/logger'

export function parseAiResponse(raw: string): ClassifyAndDraftResult | null {
  try {
    const parsed = JSON.parse(raw)
    return classifyAndDraftSchema.parse(parsed)
  } catch (err) {
    logger.warn({ err, raw: raw.substring(0, 200) }, 'Failed to parse AI response')
    return null
  }
}
