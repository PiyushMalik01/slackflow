// Server-only Supabase clients — imported ONLY in Server Components & API routes
// Do NOT import this in Client Components
import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── Service client (API routes – bypasses RLS with service role) ──────────────
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

let _serviceClient: ReturnType<typeof createServiceClient> | null = null
export function getServiceClient() {
  if (!_serviceClient) _serviceClient = createServiceClient()
  return _serviceClient
}

// ── Cached auth — deduplicates getUser() calls within a single request ────────
export const getAuthUser = cache(async () => {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

// ── Auth-aware server client (Server Components + protected routes) ───────────
export async function createAuthClient() {
  const cookieStore = await cookies()
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
