'use client'

import { useState } from 'react'
import { CategoryBadge } from '@/components/category-badge'
import { StatusPill } from '@/components/status-pill'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, X, Trash2, AlertTriangle, UserPlus, Loader2 } from 'lucide-react'
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

  // Assignment state
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [showNewMember, setShowNewMember] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('')
  const [autoRoute, setAutoRoute] = useState(true)
  const [creating, setCreating] = useState(false)

  const timeAgo = getRelativeTime(task.created_at)

  async function handleAssign() {
    if (!selectedRoleId) return
    setAssigning(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, role_id: selectedRoleId }),
      })
      if (res.ok) {
        const role = roles?.find(r => r.id === selectedRoleId)
        toast.success(`Task assigned to ${role?.name || 'member'}`)
        onTaskUpdated?.()
      } else {
        toast.error('Failed to assign task')
      }
    } catch {
      toast.error('Failed to assign task')
    } finally {
      setAssigning(false)
    }
  }

  async function handleAssignWithRouting() {
    if (!selectedRoleId) return
    setAssigning(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, role_id: selectedRoleId }),
      })
      if (!res.ok) { toast.error('Failed to assign task'); return }

      const role = roles?.find(r => r.id === selectedRoleId)

      if (autoRoute && task.category_id && task.workspace_id) {
        await fetch('/api/workspace-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: task.workspace_id,
            category_id: task.category_id,
            role_id: selectedRoleId,
          }),
        })
        toast.success(`Assigned to ${role?.name || 'member'}. Future "${task.category}" tasks will be routed automatically.`)
      } else {
        toast.success(`Task assigned to ${role?.name || 'member'}`)
      }
      onTaskUpdated?.()
    } catch {
      toast.error('Failed to assign task')
    } finally {
      setAssigning(false)
    }
  }

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

      // 3. Optionally set up routing for future tasks
      if (autoRoute && task.category_id && task.workspace_id) {
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

            {/* Assignment Section */}
            <div
              className="border-t pt-4 mt-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                {task.role_name ? 'Reassign Task' : 'Assign Task'}
              </h4>

              {/* Assign to existing member */}
              {roles && roles.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <select
                    className="text-xs border rounded px-2 py-1.5 bg-background flex-1 max-w-xs"
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                  >
                    <option value="">Select a team member...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.type})
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={!selectedRoleId || assigning}
                    onClick={handleAssignWithRouting}
                  >
                    {assigning && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Assign
                  </Button>
                </div>
              )}

              {/* Auto-route checkbox for existing member assignment */}
              {selectedRoleId && task.category_id && task.workspace_id && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRoute}
                    onChange={(e) => setAutoRoute(e.target.checked)}
                    className="rounded"
                  />
                  Also route future &quot;{task.category}&quot; tasks to this member
                </label>
              )}

              {/* Create new member toggle */}
              <button
                onClick={() => setShowNewMember(!showNewMember)}
                className="text-xs text-primary hover:underline"
              >
                {showNewMember ? '- Cancel new member' : '+ Create new member and assign'}
              </button>

              {/* Inline new member form */}
              {showNewMember && (
                <div className="mt-3 p-3 border rounded-lg space-y-3 bg-muted/30">
                  <input
                    type="text"
                    placeholder="Member name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full text-sm border rounded px-3 py-1.5 bg-background"
                  />
                  <input
                    type="text"
                    placeholder="Type (e.g. Developer)"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full text-sm border rounded px-3 py-1.5 bg-background"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {['Developer', 'Designer', 'PM', 'Support'].map(t => (
                      <button
                        key={t}
                        onClick={() => setNewType(t)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          newType === t
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-accent border-border'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {task.category_id && task.workspace_id && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRoute}
                        onChange={(e) => setAutoRoute(e.target.checked)}
                        className="rounded"
                      />
                      Also route future &quot;{task.category}&quot; tasks to this member
                    </label>
                  )}
                  <Button
                    size="sm"
                    disabled={!newName.trim() || !newType.trim() || creating}
                    onClick={handleCreateAndAssign}
                  >
                    {creating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Create &amp; Assign
                  </Button>
                </div>
              )}
            </div>

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
