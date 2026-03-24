export type Category = 'BUG' | 'FEATURE' | 'GENERAL'

export interface ClassifyResult {
  category: Category
  confidence: number // 0.0–1.0
  matchedKeywords: string[]
}

const BUG_KEYWORDS = [
  'bug', 'broken', 'error', 'crash', 'not working', 'issue', 'fail',
  'down', 'stops', 'stuck', 'freeze', 'exception', 'wrong', '500', 'cannot', "can't", 'unable',
]

const FEATURE_KEYWORDS = [
  'feature', 'request', 'suggestion', 'add', 'would be nice',
  'can you add', 'idea', 'enhance', 'improvement', 'support for', 'ability to', 'allow',
]

export function classify(text: string): ClassifyResult {
  const lower = text.toLowerCase()
  const bugMatches = BUG_KEYWORDS.filter((k) => lower.includes(k))
  const featureMatches = FEATURE_KEYWORDS.filter((k) => lower.includes(k))

  if (bugMatches.length > featureMatches.length) {
    return {
      category: 'BUG',
      confidence: Math.min(bugMatches.length / 3, 1),
      matchedKeywords: bugMatches,
    }
  }
  if (featureMatches.length > 0) {
    return {
      category: 'FEATURE',
      confidence: Math.min(featureMatches.length / 3, 1),
      matchedKeywords: featureMatches,
    }
  }
  return { category: 'GENERAL', confidence: 1.0, matchedKeywords: [] }
}
