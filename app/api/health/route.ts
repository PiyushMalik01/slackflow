import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db/client'

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {}

  // Supabase connection check
  try {
    const db = getServiceClient()
    await db.from('rate_limits').select('id').limit(1)
    checks.supabase = 'ok'
  } catch {
    checks.supabase = 'error'
  }

  // OpenAI key check
  checks.openai = process.env.OPENAI_API_KEY ? 'ok' : 'error'

  // Slack credentials check
  checks.slack =
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET &&
    process.env.SLACK_SIGNING_SECRET
      ? 'ok'
      : 'error'

  // Telegram check
  checks.telegram = process.env.TELEGRAM_BOT_TOKEN ? 'ok' : 'error'

  const allOk = Object.values(checks).every((v) => v === 'ok')

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  )
}
