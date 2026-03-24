import OpenAI from 'openai'

// Single server-side OpenAI client — one API key for the whole platform
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  maxRetries: 3,
  timeout: 30_000,
})

export const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'
