'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/db/browser-client'
import { cn } from '@/lib/utils'

interface Workspace {
  id: string
  name: string
  accent_color: string
}

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selected, setSelected] = useState<string>('all')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const ws = searchParams.get('workspace')
    if (ws) setSelected(ws)
  }, [searchParams])

  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('workspaces').select('id, name, accent_color').eq('owner_id', user.id)
      setWorkspaces(data || [])
    }
    load()
  }, [])

  function handleChange(value: string) {
    setSelected(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('workspace')
    } else {
      params.set('workspace', value)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <select
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className={cn(
        'w-full rounded-md border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring',
        className
      )}
    >
      <option value="all">All Workspaces</option>
      {workspaces.map((ws) => (
        <option key={ws.id} value={ws.id}>
          {ws.name}
        </option>
      ))}
    </select>
  )
}
