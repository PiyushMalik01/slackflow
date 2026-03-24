import { headers } from 'next/headers'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

export async function validateOrigin(): Promise<boolean> {
  const h = await headers()
  const origin = h.get('origin')
  const referer = h.get('referer')

  if (!origin && !referer) return false

  const allowed = APP_URL ? new URL(APP_URL).origin : ''
  if (!allowed) return true // skip in dev if APP_URL not set

  if (origin && origin === allowed) return true
  if (referer) {
    try {
      if (new URL(referer).origin === allowed) return true
    } catch { return false }
  }

  return false
}
