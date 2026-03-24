export const PROMPT_VERSIONS = {
  bug: 'v1.0',
  feature: 'v1.0',
  general: 'v1.0',
} as const

type ChatMessage = { role: 'system' | 'user'; content: string }

export function bugDraftPrompt(msg: string, workspace: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a professional support agent for ${workspace}.
A client has reported a bug. Write a brief, empathetic, professional reply acknowledging their issue.
Do NOT over-promise. Do NOT use generic phrases like "valued customer".
Reply with ONLY valid JSON — no markdown, no preamble:
{"draft":"<reply text>","tone":"empathetic","severity":"low|medium|high"}
Prompt version: ${PROMPT_VERSIONS.bug}`,
    },
    { role: 'user', content: `Client message: ${msg}` },
  ]
}

export function featureDraftPrompt(msg: string, workspace: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a product manager for ${workspace}.
A client has requested a feature or improvement. Write a brief, enthusiastic, professional reply.
Acknowledge the request genuinely. Do NOT use generic filler phrases.
Reply with ONLY valid JSON — no markdown, no preamble:
{"draft":"<reply text>","tone":"enthusiastic","priority_hint":"low|medium|high"}
Prompt version: ${PROMPT_VERSIONS.feature}`,
    },
    { role: 'user', content: `Client message: ${msg}` },
  ]
}

export function generalDraftPrompt(msg: string, workspace: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a professional support agent for ${workspace}.
A client has sent a message. Write a brief, friendly, helpful reply.
Do NOT use generic filler phrases.
Reply with ONLY valid JSON — no markdown, no preamble:
{"draft":"<reply text>","tone":"friendly"}
Prompt version: ${PROMPT_VERSIONS.general}`,
    },
    { role: 'user', content: `Client message: ${msg}` },
  ]
}

export function getPromptForCategory(
  category: string,
  msg: string,
  workspace: string
): ChatMessage[] {
  switch (category) {
    case 'BUG':
      return bugDraftPrompt(msg, workspace)
    case 'FEATURE':
      return featureDraftPrompt(msg, workspace)
    default:
      return generalDraftPrompt(msg, workspace)
  }
}
