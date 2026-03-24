import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// Paths that never need auth
const PUBLIC_PATHS = new Set(['/', '/login', '/signup'])
const PUBLIC_API_PREFIXES = ['/api/slack/', '/api/telegram/', '/api/health']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Static assets — skip immediately
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // Public pages
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  // Public API routes (Slack/Telegram webhooks)
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Protected routes — use Supabase SSR client so it can REFRESH the token and SET cookies
  // This is the only place where cookie writes are allowed in Next.js App Router
  let res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Write refreshed cookies back into the response
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
