'use client'

import { useState } from 'react'
import { CategoryBadge } from '@/components/category-badge'
import { StatusPill } from '@/components/status-pill'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, AlertTriangle, Trash2, Loader2 } from 'lucide-react'
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
    workspace_id?: string
    role_id?: string | null
    workspace_name?: string
    workspace_color?: string
    role_name?: string
    category_emoji?: string
    category_color?: string
  }
  categories?: { id: string; name: string; emoji: string; color: string }[]
  roles?: { id: string; name: string; type: string; status?: string }[]
  onTaskUpdated?: () => void
}

export function TaskCard({ task, categories, roles, onTaskUpdated }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // New member form state
  const [showNewMember, setShowNewMember] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('')
  const [creating, setCreating] = useState(false)

  const timeAgo = getRelativeTime(task.created_at)

  async function handleCreateAndAssign() {
    if (!newName.trim() || !newType.trim()) {
      toast.error('Name and type are required')
      return
    }
    setCreating(true)
    try {
      // 1. Create role
      const roleRes = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), type: newType.trim() }),
      })
      const roleData = await roleRes.json()
      if (!roleRes.ok) { toast.error('Failed to create member'); return }

      // 2. Assign task to new role
      const assignRes = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, role_id: roleData.id }),
      })
      if (!assignRes.ok) { toast.error('Failed to assign task'); return }

      // 3. Auto-route for future tasks if possible
      if (task.category_id && task.workspace_id) {
        await fetch('/api/workspace-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: task.workspace_id,
            category_id: task.category_id,
            role_id: roleData.id,
          }),
        })
        toast.success(`Created ${newName} and assigned. Future "${task.category}" tasks will be routed automatically.`)
      } else {
        toast.success(`Created ${newName} and assigned task.`)
      }

      setNewName('')
      setNewType('')
      setShowNewMember(false)
      onTaskUpdated?.()
    } catch {
      toast.error('Failed to create member')
    } finally {
      setCreating(false)
    }
  }

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
          {task.role_name ? (
            <span className="text-xs font-medium">{task.role_name}</span>
          ) : (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Unassigned
            </span>
          )}
          <StatusPill status={task.status} />
          <span className="text-xs text-muted-foreground ml-auto">{timeAgo}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>

        {expanded && (
          <div className="mt-4 text-sm border-t pt-4" onClick={(e) => e.stopPropagation()}>
            {/* Message content */}
            <div className="space-y-3 mb-4">
              <div>
                <p className="font-medium text-xs text-muted-foreground mb-1">Original Message</p>
                <p className="whitespace-pre-wrap">{task.original_text}</p>
              </div>
              {task.draft_text && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="font-medium text-xs text-muted-foreground mb-1">AI Draft</p>
                  <p className="whitespace-pre-wrap text-muted-foreground italic">{task.draft_text}</p>
                </div>
              )}
              {task.edited_text && (
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                  <p className="font-medium text-xs text-muted-foreground mb-1">Edited Response</p>
                  <p className="whitespace-pre-wrap">{task.edited_text}</p>
                </div>
              )}
              {task.final_text && (
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                  <p className="font-medium text-xs text-muted-foreground mb-1">Final Response</p>
                  <p className="whitespace-pre-wrap">{task.final_text}</p>
                </div>
              )}
            </div>

            {/* Single compact action bar */}
            <div className="flex items-center gap-2 flex-wrap border-t pt-3">
              {/* Assign/Reassign dropdown */}
              <select
                className="text-xs border rounded-md px-2.5 py-1.5 bg-background min-w-[160px]"
                value={task.role_id || ''}
                onChange={async (e) => {
                  const roleId = e.target.value
                  if (!roleId) return
                  const res = await fetch('/api/tasks', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: task.id, role_id: roleId }),
                  })
                  if (res.ok) {
                    const role = roles?.find(r => r.id === roleId)
                    // Auto-route if category is set
                    if (task.category_id && task.workspace_id) {
                      await fetch('/api/workspace-roles', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ workspace_id: task.workspace_id, category_id: task.category_id, role_id: roleId }),
                      })
                    }
                    toast.success(`Assigned to ${role?.name || 'member'}`)
                    onTaskUpdated?.()
                  }
                }}
              >
                <option value="">Assign to...</option>
                {roles?.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
                ))}
              </select>

              {/* Recategorize dropdown */}
              <select
                className="text-xs border rounded-md px-2.5 py-1.5 bg-background min-w-[140px]"
                value={task.category_id || ''}
                onChange={async (e) => {
                  const catId = e.target.value
                  const cat = categories?.find(c => c.id === catId)
                  if (!catId || !cat) return
                  const res = await fetch('/api/tasks', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: task.id, category_id: catId, category: cat.name }),
                  })
                  if (res.ok) { toast.success(`Moved to ${cat.name}`); onTaskUpdated?.() }
                }}
              >
                <option value="" disabled>Category...</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                ))}
              </select>

              {/* Dismiss — only show when relevant */}
              {task.status !== 'dismissed' && task.status !== 'sent' && (
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={async () => {
                  await fetch('/api/tasks', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: task.id, status: 'dismissed'}) })
                  toast.success('Dismissed'); onTaskUpdated?.()
                }}>
                  Dismiss
                </Button>
              )}

              {/* Delete — pushed to right */}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 ml-auto"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {/* "+ New member" link — only show if task is unassigned */}
            {!task.role_name && (
              <div className="mt-2">
                <button
                  onClick={() => setShowNewMember(!showNewMember)}
                  className="text-xs text-primary hover:underline"
                >
                  {showNewMember ? 'Cancel' : '+ Create new member and assign'}
                </button>
                {showNewMember && (
                  <div className="mt-2 p-3 border rounded-lg space-y-2 bg-muted/30">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 text-xs border rounded px-2.5 py-1.5 bg-background" />
                      <input type="text" placeholder="Type" value={newType} onChange={(e) => setNewType(e.target.value)} className="w-28 text-xs border rounded px-2.5 py-1.5 bg-background" />
                    </div>
                    <div className="flex gap-1.5">
                      {['Dev', 'Design', 'PM', 'Support'].map(t => (
                        <button key={t} onClick={() => setNewType(t)} className={`text-[10px] px-2 py-0.5 rounded-full border ${newType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}>{t}</button>
                      ))}
                    </div>
                    <Button size="sm" className="text-xs h-7" disabled={!newName.trim() || !newType.trim() || creating} onClick={handleCreateAndAssign}>
                      {creating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Create & Assign
                    </Button>
                  </div>
                )}
              </div>
            )}
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
