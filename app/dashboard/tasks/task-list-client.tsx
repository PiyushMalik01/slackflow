'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TaskCard } from '@/components/task-card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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

  return (
    <>
      {/* AI Actions toolbar */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
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

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            categories={categories}
            roles={roles}
            onTaskUpdated={handleTaskUpdated}
          />
        ))}
      </div>
    </>
  )
}
