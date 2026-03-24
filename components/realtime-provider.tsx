'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/db/browser-client'

const REALTIME_TABLES = [
  'tasks',
  'activity_log',
  'roles',
  'categories',
  'workspaces',
  'workspace_roles',
  'invite_tokens',
] as const

interface RealtimeProviderProps {
  children: React.ReactNode
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    function scheduleRefresh() {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        router.refresh()
      }, 2000) // debounce 2000ms — batches rapid changes, reduces re-render churn
    }

    let channel = supabase.channel('dashboard-realtime')

    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        scheduleRefresh,
      )
    }

    channel.subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [router])

  return <>{children}</>
}
