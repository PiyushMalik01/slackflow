'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

interface TaskFiltersProps {
  currentStatus?: string
  currentCategory?: string
  currentSearch?: string
  categoryOptions: { value: string; label: string }[]
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'draft_ready', label: 'Draft Ready' },
  { value: 'approved', label: 'Approved' },
  { value: 'edited', label: 'Edited' },
  { value: 'sent', label: 'Sent' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'failed', label: 'Failed' },
]

export function TaskFilters({ currentStatus, currentCategory, currentSearch, categoryOptions }: TaskFiltersProps) {
  const router = useRouter()
  const [search, setSearch] = useState(currentSearch || '')

  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    const merged = {
      status: currentStatus,
      category: currentCategory,
      search: currentSearch,
      ...updates,
    }
    for (const [key, val] of Object.entries(merged)) {
      if (val) sp.set(key, val)
    }
    // Reset page when filters change
    router.push(`/dashboard/tasks?${sp.toString()}`)
  }, [router, currentStatus, currentCategory, currentSearch])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ search: search || undefined })
  }

  const hasFilters = currentStatus || currentCategory || currentSearch

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <form onSubmit={handleSearchSubmit} className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages..."
          className="pl-9"
        />
      </form>

      <Select
        value={currentStatus || 'all'}
        onValueChange={(val) => updateParams({ status: val === 'all' ? undefined : val })}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentCategory || 'all'}
        onValueChange={(val) => updateParams({ category: val === 'all' ? undefined : val })}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categoryOptions.map((c) => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => {
            setSearch('')
            router.push('/dashboard/tasks')
          }}
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
