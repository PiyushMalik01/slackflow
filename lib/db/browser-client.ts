'use client'
// Browser-only Supabase client — MUST use @supabase/ssr's createBrowserClient
// so that cookies are written in a format the server-side SSR client can read.
// Using plain @supabase/supabase-js createClient() writes incompatible cookies.
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

let _browserClient: ReturnType<typeof createSSRBrowserClient> | null = null

export function createBrowserClient() {
  if (!_browserClient) {
    _browserClient = createSSRBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _browserClient
}
