import { processDueSnoozes } from '@/lib/telegram/snooze-processor'

export async function GET() {
  const processed = await processDueSnoozes()
  return new Response(`Processed ${processed} snooze reminders`)
}
