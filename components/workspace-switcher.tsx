'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/db/browser-client'
import { ChevronDown, Building2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Workspace {
  id: string
  name: string
  accent_color: string
}

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selected, setSelected] = useState<string>('all')
  const [open, setOpen] = useState(false)
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

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-ws-switcher]')) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleSelect(value: string) {
    setSelected(value)
    setOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('workspace')
    } else {
      params.set('workspace', value)
    }
    router.push(`?${params.toString()}`)
  }

  const selectedWs = workspaces.find(w => w.id === selected)
  const label = selectedWs ? selectedWs.name : 'All Workspaces'

  return (
    <div className={cn('relative', className)} data-ws-switcher>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border bg-background hover:bg-accent text-sm transition-colors"
      >
        <Building2 className="size-4 text-muted-foreground flex-shrink-0" />
        <span className="truncate flex-1 text-left font-medium">{label}</span>
        <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-full bg-popover border rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={() => handleSelect('all')}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left',
              selected === 'all' && 'bg-accent'
            )}
          >
            <Building2 className="size-3.5 text-muted-foreground" />
            <span className="flex-1">All Workspaces</span>
            {selected === 'all' && <Check className="size-3.5 text-primary" />}
          </button>
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => handleSelect(ws.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left',
                selected === ws.id && 'bg-accent'
              )}
            >
              <span className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: ws.accent_color || '#3B82F6' }} />
              <span className="flex-1 truncate">{ws.name}</span>
              {selected === ws.id && <Check className="size-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
