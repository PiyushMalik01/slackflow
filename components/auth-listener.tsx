'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@/lib/db/browser-client'
import type { AuthChangeEvent } from '@supabase/supabase-js'

export function AuthListener() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createBrowserClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
      // Refresh server components when auth state changes
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        router.refresh()
      }
    })

    // Also poll for missing session (handles manual storage clear)
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session && pathname.startsWith('/dashboard')) {
        router.push('/login')
      }
    }, 5000) // check every 5 seconds

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [router, pathname])

  return null
}
