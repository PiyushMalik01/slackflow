'use client'

import { useState } from 'react'
import { CategoryBadge } from '@/components/category-badge'
import { StatusPill } from '@/components/status-pill'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, AlertTriangle, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Template {
  id: string
  name: string
  content: string
  category_id: string | null
}

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
  templates?: Template[]
  selected?: boolean
  onToggleSelect?: () => void
  onTaskUpdated?: () => void
}

export function TaskCard({ task, categories, roles, templates, selected, onToggleSelect, onTaskUpdated }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Assign flow state
  const [pendingRoleId, setPendingRoleId] = useState('')
  const [assigning, setAssigning] = useState(false)

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
      <div className="border rounded-lg p-3 sm:p-4 hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-2 flex-wrap text-xs sm:gap-3">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => { e.stopPropagation(); onToggleSelect() }}
              onClick={(e) => e.stopPropagation()}
              className="rounded border-input"
            />
          )}
          {task.workspace_name && (
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.workspace_color || '#3B82F6' }} />
              <span className="truncate max-w-[120px] sm:max-w-none">{task.workspace_name}</span>
            </span>
          )}
          <span className="text-muted-foreground truncate max-w-[80px] sm:max-w-none">#{formatChannel(task.channel)}</span>
          <span className="text-muted-foreground hidden sm:inline">{formatSender(task.sender_name)}</span>
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
          <span className="text-muted-foreground ml-auto whitespace-nowrap">{timeAgo}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
        </div>

        {expanded && (
          <div className="mt-4 text-sm border-t pt-4 transition-all duration-200" onClick={(e) => e.stopPropagation()}>
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

            {/* Action bar — grouped into routing and response sections */}
            <div className="border-t pt-3 space-y-2">
              {/* Row 1: Routing — Assign + Category */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mr-1">Route</span>
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <select
                    className="text-xs border rounded-md px-2.5 py-1.5 bg-background w-full sm:w-auto sm:min-w-[160px]"
                    value={pendingRoleId}
                    onChange={(e) => setPendingRoleId(e.target.value)}
                  >
                    <option value="">Assign to...</option>
                    {roles?.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
                    ))}
                  </select>
                  {pendingRoleId && (
                    <Button
                      size="sm"
                      className="text-xs h-7"
                      disabled={assigning}
                      onClick={async () => {
                        setAssigning(true)
                        try {
                          const res = await fetch('/api/tasks', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: task.id, role_id: pendingRoleId }),
                          })
                          if (res.ok) {
                            const role = roles?.find(r => r.id === pendingRoleId)
                            if (task.category_id && task.workspace_id) {
                              await fetch('/api/workspace-roles', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ workspace_id: task.workspace_id, category_id: task.category_id, role_id: pendingRoleId }),
                              })
                            }
                            toast.success(`Assigned to ${role?.name || 'member'} — notification sent`)
                            setPendingRoleId('')
                            onTaskUpdated?.()
                          } else {
                            toast.error('Failed to assign')
                          }
                        } finally {
                          setAssigning(false)
                        }
                      }}
                    >
                      {assigning ? <Loader2 className="size-3 animate-spin" /> : task.role_id ? 'Reassign' : 'Assign'}
                    </Button>
                  )}
                </div>

                <div className="hidden sm:block w-px h-5 bg-border mx-1" />

                <select
                  className="text-xs border rounded-md px-2.5 py-1.5 bg-background w-full sm:w-auto sm:min-w-[140px]"
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
              </div>

              {/* Row 2: Actions — Reply, Send, Dismiss, Delete */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mr-1">Act</span>
                <select
                  className="text-xs border rounded-md px-2.5 py-1.5 bg-background w-full sm:w-auto sm:min-w-[140px]"
                  defaultValue=""
                  onChange={async (e) => {
                    if (e.target.value === '_create') {
                      window.location.href = '/dashboard/settings'
                      return
                    }
                    const template = templates?.find(t => t.id === e.target.value)
                    if (!template) return
                    const res = await fetch('/api/tasks', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        id: task.id,
                        edited_text: template.content,
                        status: 'edited',
                        send_to_slack: true,
                      }),
                    })
                    if (res.ok) {
                      toast.success(`"${template.name}" sent to Slack`)
                      onTaskUpdated?.()
                    } else {
                      toast.error('Failed to send reply')
                    }
                    e.target.value = ''
                  }}
                >
                  <option value="">Quick reply...</option>
                  {templates && templates.length > 0 ? (
                    templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))
                  ) : (
                    <option value="_create">+ Create templates in Settings</option>
                  )}
                </select>

                {task.draft_text && task.status !== 'sent' && (
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={async () => {
                    const res = await fetch('/api/tasks', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: task.id, send_to_slack: true }),
                    })
                    if (res.ok) {
                      toast.success('Reply sent to Slack')
                      onTaskUpdated?.()
                    } else {
                      toast.error('Failed to send')
                    }
                  }}>
                    Send to Slack
                  </Button>
                )}

                <div className="hidden sm:block w-px h-5 bg-border mx-1" />

                {task.status !== 'dismissed' && task.status !== 'sent' && (
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={async () => {
                    await fetch('/api/tasks', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: task.id, status: 'dismissed'}) })
                    toast.success('Dismissed'); onTaskUpdated?.()
                  }}>
                    Dismiss
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 ml-auto"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
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
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 text-xs border rounded px-2.5 py-1.5 bg-background w-full" />
                      <input type="text" placeholder="Type" value={newType} onChange={(e) => setNewType(e.target.value)} className="text-xs border rounded px-2.5 py-1.5 bg-background w-full sm:w-28" />
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
