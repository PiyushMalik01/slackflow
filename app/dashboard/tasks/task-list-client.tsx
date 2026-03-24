'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TaskCard } from '@/components/task-card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Template {
  id: string
  name: string
  content: string
  category_id: string | null
}

interface TaskListClientProps {
  tasks: {
    id: string
    original_text: string
    draft_text: string | null
    edited_text: string | null
    final_text: string | null
    category: string
    category_id: string | null
    status: string
    channel: string
    sender_name: string | null
    created_at: string
    workspace_id?: string
    role_id?: string | null
    workspace_name?: string
    workspace_color?: string
    role_name?: string
    category_emoji?: string
    category_color?: string
  }[]
  categories: { id: string; name: string; emoji: string; color: string }[]
  roles?: { id: string; name: string; type: string; status?: string }[]
}

export function TaskListClient({ tasks, categories, roles }: TaskListClientProps) {
  const router = useRouter()
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [cleanNoiseDialogOpen, setCleanNoiseDialogOpen] = useState(false)

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // Templates state
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTemplates(data) })
      .catch(() => {})
  }, [])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(tasks.map(t => t.id)))
    }
  }

  async function bulkDismiss() {
    const count = selectedIds.size
    for (const id of selectedIds) {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'dismissed' }),
      })
    }
    setSelectedIds(new Set())
    toast.success(`${count} task${count !== 1 ? 's' : ''} dismissed`)
    router.refresh()
  }

  async function bulkDelete() {
    const count = selectedIds.size
    const ids = Array.from(selectedIds).join(',')
    await fetch(`/api/tasks?ids=${ids}`, { method: 'DELETE' })
    setSelectedIds(new Set())
    toast.success(`Deleted ${count} task${count !== 1 ? 's' : ''}`)
    router.refresh()
  }

  const handleAiAction = async (action: 'recategorize' | 'clean_noise') => {
    if (tasks.length === 0) {
      toast.error('No tasks to process')
      return
    }

    const taskIds = tasks.map(t => t.id).slice(0, 50)
    const label = action === 'recategorize' ? 'recategorizing' : 'cleaning noise'

    setAiLoading(action)
    try {
      const res = await fetch('/api/tasks/ai-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, task_ids: taskIds }),
      })

      if (!res.ok) {
        toast.error(`Failed ${label}`)
        return
      }

      const data = await res.json()
      if (action === 'recategorize') {
        toast.success(`Recategorized ${data.updated || 0} tasks`)
      } else {
        toast.success(`Removed ${data.deleted || 0} noise tasks${data.reason ? ': ' + data.reason : ''}`)
      }
      router.refresh()
    } catch {
      toast.error(`Error ${label}`)
    } finally {
      setAiLoading(null)
    }
  }

  const handleTaskUpdated = () => {
    router.refresh()
  }

  // Filter templates for a given task (match by category or show all)
  function getTemplatesForTask(task: { category_id: string | null }) {
    return templates.filter(t => !t.category_id || t.category_id === task.category_id)
  }

  return (
    <>
      {/* AI Actions toolbar */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-card flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">AI Actions:</span>
          <Button
            variant="outline"
            size="sm"
            disabled={aiLoading !== null}
            onClick={() => handleAiAction('recategorize')}
          >
            {aiLoading === 'recategorize' ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            AI Recategorize All
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={aiLoading !== null}
            onClick={() => setCleanNoiseDialogOpen(true)}
          >
            {aiLoading === 'clean_noise' ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3 mr-1" />
            )}
            AI Clean Noise
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size === tasks.length && tasks.length > 0}
                onChange={selectAll}
                className="rounded border-input"
              />
              Select all
            </label>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button variant="outline" size="sm" onClick={bulkDismiss}>
            Dismiss All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => setBulkDeleteOpen(true)}
          >
            Delete All
          </Button>
          {roles && roles.length > 0 && (
            <select
              className="text-xs border rounded px-2 py-1.5 bg-background"
              defaultValue=""
              onChange={async (e) => {
                const roleId = e.target.value
                if (!roleId) return
                const count = selectedIds.size
                for (const id of selectedIds) {
                  await fetch('/api/tasks', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, role_id: roleId }),
                  })
                }
                setSelectedIds(new Set())
                toast.success(`Reassigned ${count} task${count !== 1 ? 's' : ''}`)
                router.refresh()
                e.target.value = ''
              }}
            >
              <option value="">Reassign to...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={cleanNoiseDialogOpen}
        onOpenChange={setCleanNoiseDialogOpen}
        title="Clean Noise Tasks"
        description="AI will analyze and remove noise/spam tasks. This cannot be undone. Continue?"
        confirmLabel="Clean Noise"
        variant="danger"
        onConfirm={() => handleAiAction('clean_noise')}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete Selected Tasks"
        description={`Are you sure you want to delete ${selectedIds.size} task${selectedIds.size !== 1 ? 's' : ''} permanently? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={bulkDelete}
      />

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            categories={categories}
            roles={roles}
            templates={getTemplatesForTask(task)}
            selected={selectedIds.has(task.id)}
            onToggleSelect={() => toggleSelect(task.id)}
            onTaskUpdated={handleTaskUpdated}
          />
        ))}
      </div>
    </>
  )
}
