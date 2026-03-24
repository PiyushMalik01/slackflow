import { headers } from 'next/headers'

export async function validateOrigin(): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  // Skip CSRF in development when APP_URL is not configured
  if (!appUrl) return true

  const h = await headers()
  const origin = h.get('origin')
  const referer = h.get('referer')

  if (!origin && !referer) return false

  const allowed = new URL(appUrl).origin
  // Also allow localhost in development
  const isDev = process.env.NODE_ENV !== 'production'
  const requestOrigin = origin || (referer ? new URL(referer).origin : '')
  const isLocalhost = requestOrigin.startsWith('http://localhost')

  if (isDev && isLocalhost) return true
  if (origin && origin === allowed) return true
  if (referer) {
    try {
      if (new URL(referer).origin === allowed) return true
    } catch { return false }
  }

  return false
}
