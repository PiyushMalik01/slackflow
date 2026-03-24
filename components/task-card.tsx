'use client'

import { useState } from 'react'
import { CategoryBadge } from '@/components/category-badge'
import { StatusPill } from '@/components/status-pill'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, X, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface TaskCardProps {
  task: {
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
    workspace_name?: string
    workspace_color?: string
    role_name?: string
    category_emoji?: string
    category_color?: string
  }
  categories?: { id: string; name: string; emoji: string; color: string }[]
  onTaskUpdated?: () => void
}

export function TaskCard({ task, categories, onTaskUpdated }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const timeAgo = getRelativeTime(task.created_at)

  return (
    <>
      <div className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 flex-wrap">
          {task.workspace_name && (
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.workspace_color || '#3B82F6' }} />
              {task.workspace_name}
            </span>
          )}
          <span className="text-xs text-muted-foreground">#{formatChannel(task.channel)}</span>
          <span className="text-xs text-muted-foreground">{formatSender(task.sender_name)}</span>
          <CategoryBadge name={task.category} emoji={task.category_emoji} color={task.category_color} />
          {task.role_name && <span className="text-xs font-medium">{task.role_name}</span>}
          <StatusPill status={task.status} />
          <span className="text-xs text-muted-foreground ml-auto">{timeAgo}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 text-sm border-t pt-4">
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">Original Message</p>
              <p className="whitespace-pre-wrap">{task.original_text}</p>
            </div>
            {task.draft_text && (
              <div>
                <p className="font-medium text-xs text-muted-foreground mb-1">AI Draft</p>
                <p className="whitespace-pre-wrap text-muted-foreground italic">{task.draft_text}</p>
              </div>
            )}
            {task.edited_text && (
              <div>
                <p className="font-medium text-xs text-muted-foreground mb-1">Edited Response</p>
                <p className="whitespace-pre-wrap">{task.edited_text}</p>
              </div>
            )}
            {task.final_text && (
              <div>
                <p className="font-medium text-xs text-muted-foreground mb-1">Final Response</p>
                <p className="whitespace-pre-wrap text-green-700 dark:text-green-400">{task.final_text}</p>
              </div>
            )}

            {/* Action buttons */}
            <div
              className="flex items-center gap-2 pt-3 border-t mt-3 flex-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Recategorize select */}
              <select
                className="text-xs border rounded px-2 py-1.5 bg-background"
                defaultValue=""
                onChange={async (e) => {
                  const catId = e.target.value
                  const cat = categories?.find(c => c.id === catId)
                  if (!catId || !cat) return
                  const res = await fetch('/api/tasks', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: task.id, category_id: catId, category: cat.name }),
                  })
                  if (res.ok) { toast.success('Recategorized'); onTaskUpdated?.() }
                  else toast.error('Failed to recategorize')
                }}
              >
                <option value="" disabled>Move to category...</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                ))}
              </select>

              {/* Dismiss */}
              {task.status !== 'dismissed' && (
                <Button variant="outline" size="sm" onClick={async () => {
                  const res = await fetch('/api/tasks', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: task.id, status: 'dismissed' }),
                  })
                  if (res.ok) { toast.success('Task dismissed'); onTaskUpdated?.() }
                  else toast.error('Failed to dismiss')
                }}>
                  <X className="h-3 w-3 mr-1" /> Dismiss
                </Button>
              )}

              {/* Mark Sent */}
              {task.status !== 'sent' && (
                <Button variant="outline" size="sm" onClick={async () => {
                  const res = await fetch('/api/tasks', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: task.id, status: 'sent' }),
                  })
                  if (res.ok) { toast.success('Marked as sent'); onTaskUpdated?.() }
                  else toast.error('Failed to update')
                }}>
                  Mark Sent
                </Button>
              )}

              {/* Delete */}
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 ml-auto"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Task"
        description="Are you sure you want to delete this task permanently? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          const res = await fetch(`/api/tasks?id=${task.id}`, { method: 'DELETE' })
          if (res.ok) { toast.success('Task deleted'); onTaskUpdated?.() }
          else toast.error('Failed to delete')
        }}
      />
    </>
  )
}

function formatSender(sender: string | null): string {
  if (!sender) return 'Unknown'
  // Hide raw Slack user IDs (U followed by alphanumeric)
  if (/^U[A-Z0-9]{8,}$/i.test(sender)) return 'Slack User'
  // Hide telegram-style UIDs
  if (/^telegram:\d+$/i.test(sender)) return 'Team Member'
  // Hide pure numeric IDs
  if (/^\d{6,}$/.test(sender)) return 'Unknown'
  return sender
}

function formatChannel(channel: string): string {
  if (!channel) return 'unknown'
  // If it looks like a Slack channel ID (C followed by alphanumeric), show generic label
  if (/^C[A-Z0-9]{8,}$/i.test(channel)) return 'slack channel'
  return channel
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
