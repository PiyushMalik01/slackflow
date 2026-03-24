'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Save, Trash2, Edit2, X, Loader2, Check,
  AlertTriangle, Users, Route,
} from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { InviteLinkButton } from '@/components/invite-link-button'

// -- Types --------------------------------------------------------------------

interface Category {
  id: string
  name: string
  description: string
  emoji: string
  color: string
  is_default: boolean
  owner_id: string
}

interface Role {
  id: string
  name: string
  type: string
  status?: string
  telegram_chat_id?: string
  owner_id: string
  invite_tokens?: { token: string; expires_at: string; used_at: string | null }[]
}

interface Workspace {
  id: string
  name: string
}

interface WorkspaceRole {
  workspace_id: string
  category_id: string
  role_id: string
}

interface TeamsClientProps {
  initialRoles: Role[]
  workspaces: Workspace[]
  workspaceRoles: WorkspaceRole[]
  categories: Category[]
}

// -- Main Client --------------------------------------------------------------

export function TeamsClient({
  initialRoles,
  workspaces,
  workspaceRoles,
  categories,
}: TeamsClientProps) {
  return (
    <Tabs defaultValue="members">
      <TabsList>
        <TabsTrigger value="members">
          <Users className="size-3.5" />
          Members
        </TabsTrigger>
        <TabsTrigger value="routing">
          <Route className="size-3.5" />
          Routing
        </TabsTrigger>
      </TabsList>

      <TabsContent value="members">
        <MembersTab initialRoles={initialRoles} />
      </TabsContent>

      <TabsContent value="routing">
        <RoutingTab
          categories={categories}
          roles={initialRoles}
          workspaces={workspaces}
          workspaceRoles={workspaceRoles}
        />
      </TabsContent>
    </Tabs>
  )
}

// -- Members Tab --------------------------------------------------------------

function MembersTab({ initialRoles }: { initialRoles: Role[] }) {
  const router = useRouter()
  const [roles, setRoles] = useState(initialRoles)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Members</h2>
          <p className="text-sm text-muted-foreground">
            Team members who receive task notifications via Telegram.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="size-3.5" />
          Add Member
        </Button>
      </div>

      {showAddForm && (
        <MemberForm
          onSave={async (data) => {
            const res = await fetch('/api/roles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })
            if (res.ok) {
              toast.success('Member added successfully')
              setShowAddForm(false)
              router.refresh()
            } else {
              toast.error('Failed to add member')
            }
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="space-y-2">
        {roles.map((role) =>
          editingId === role.id ? (
            <MemberEditForm
              key={role.id}
              role={role}
              onSave={async (data) => {
                const res = await fetch('/api/roles', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: role.id, ...data }),
                })
                if (res.ok) {
                  setRoles(prev =>
                    prev.map(r => r.id === role.id ? { ...r, ...data } : r)
                  )
                  setEditingId(null)
                  toast.success('Member updated')
                  router.refresh()
                } else {
                  toast.error('Failed to update member')
                }
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <MemberItem
              key={role.id}
              role={role}
              onEdit={() => setEditingId(role.id)}
              onDelete={async () => {
                if (!confirm('Delete this member? Route mappings will be removed.')) return
                const res = await fetch(`/api/roles?id=${role.id}`, { method: 'DELETE' })
                if (res.ok) {
                  setRoles(prev => prev.filter(r => r.id !== role.id))
                  toast.success('Member removed')
                  router.refresh()
                } else {
                  toast.error('Failed to delete member')
                }
              }}
            />
          )
        )}
      </div>

      {roles.length === 0 && !showAddForm && (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No team members yet. Add a member and share their invite link via Telegram.
        </div>
      )}
    </div>
  )
}

function getMemberStatusInfo(role: Role) {
  if (role.status === 'linked') return { color: 'bg-green-500', label: 'Linked' }
  if (role.status === 'pending') return { color: 'bg-yellow-500', label: 'Pending' }
  return { color: 'bg-muted-foreground/40', label: 'Unlinked' }
}

function MemberItem({
  role,
  onEdit,
  onDelete,
}: {
  role: Role
  onEdit: () => void
  onDelete: () => void
}) {
  const status = getMemberStatusInfo(role)
  const activeToken = role.invite_tokens?.find(
    t => !t.used_at && new Date(t.expires_at) > new Date()
  )

  return (
    <div className="p-4 rounded-lg border border-border bg-card group hover:border-border/80 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`size-2.5 rounded-full flex-shrink-0 ${status.color}`} />
          <span className="text-sm font-medium">{role.name}</span>
          <Badge variant="secondary" className="text-[10px]">{role.type}</Badge>
          <span className="text-xs text-muted-foreground">{status.label}</span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button variant="ghost" size="icon-xs" onClick={onEdit}>
            <Edit2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onDelete} className="hover:text-destructive">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-3 pl-[18px]">
        <InviteLinkButton
          roleId={role.id}
          existingLink={activeToken ? `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=invite_${activeToken.token}` : null}
          expiresAt={activeToken?.expires_at}
        />
      </div>
    </div>
  )
}

const ROLE_TYPES = ['Developer', 'Designer', 'PM', 'Support', 'Custom']

function MemberForm({
  onSave,
  onCancel,
}: {
  onSave: (data: { name: string; type: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !type.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), type: type.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">Name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alice, Front-end Team"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Type</label>
            <Input
              value={type}
              onChange={e => setType(e.target.value)}
              placeholder="e.g. Developer, PM"
              required
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ROLE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                    type === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <X className="size-3.5" /> Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !name.trim() || !type.trim()}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Add Member
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function MemberEditForm({
  role,
  onSave,
  onCancel,
}: {
  role: Role
  onSave: (data: { name: string; type: string; telegram_chat_id: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(role.name)
  const [type, setType] = useState(role.type)
  const [chatId, setChatId] = useState(role.telegram_chat_id || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ name: name.trim(), type: type.trim(), telegram_chat_id: chatId.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Type</label>
              <Input value={type} onChange={e => setType(e.target.value)} required />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {ROLE_TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      type === t
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-transparent bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Telegram Chat ID</label>
            <Input
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              placeholder="Optional — auto-filled when user links via invite"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <X className="size-3.5" /> Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// -- Routing Tab --------------------------------------------------------------

function RoutingTab({
  categories,
  roles,
  workspaces,
  workspaceRoles,
}: {
  categories: Category[]
  roles: Role[]
  workspaces: Workspace[]
  workspaceRoles: WorkspaceRole[]
}) {
  if (workspaces.length === 0) {
    return (
      <div className="mt-4 py-16 text-center rounded-lg border border-dashed border-border">
        <Route className="size-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Connect a workspace first to configure task routing.
        </p>
      </div>
    )
  }

  if (roles.length === 0) {
    return (
      <div className="mt-4 py-16 text-center rounded-lg border border-dashed border-border">
        <Users className="size-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Add at least one team member before configuring routing.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 mt-4">
      <div>
        <h2 className="text-lg font-semibold">Task Routing</h2>
        <p className="text-sm text-muted-foreground">
          Assign team members to categories per workspace. Matching messages are routed to the assigned member.
        </p>
      </div>

      {workspaces.map(ws => (
        <WorkspaceRoutingCard
          key={ws.id}
          workspace={ws}
          categories={categories}
          roles={roles}
          mappings={workspaceRoles.filter(wr => wr.workspace_id === ws.id)}
        />
      ))}
    </div>
  )
}

function WorkspaceRoutingCard({
  workspace,
  categories,
  roles,
  mappings,
}: {
  workspace: Workspace
  categories: Category[]
  roles: Role[]
  mappings: WorkspaceRole[]
}) {
  const router = useRouter()
  const [localMappings, setLocalMappings] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const wr of mappings) {
      m[wr.category_id] = wr.role_id
    }
    return m
  })
  const [saving, setSaving] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({})

  async function handleChange(categoryId: string, roleId: string) {
    setLocalMappings(prev => ({ ...prev, [categoryId]: roleId }))
    setSaving(prev => ({ ...prev, [categoryId]: 'saving' }))

    try {
      const res = await fetch('/api/workspace-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          category_id: categoryId,
          role_id: roleId || null,
        }),
      })
      if (res.ok) {
        setSaving(prev => ({ ...prev, [categoryId]: 'saved' }))
        toast.success('Routing updated')
        setTimeout(() => setSaving(prev => ({ ...prev, [categoryId]: 'idle' })), 2000)
        router.refresh()
      } else {
        setSaving(prev => ({ ...prev, [categoryId]: 'error' }))
        toast.error('Failed to update routing')
      }
    } catch {
      setSaving(prev => ({ ...prev, [categoryId]: 'error' }))
      toast.error('Failed to update routing')
    }
  }

  const unassignedCount = categories.filter(c => !localMappings[c.id]).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>{workspace.name}</CardTitle>
        {unassignedCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5" />
            {unassignedCount} unassigned {unassignedCount === 1 ? 'category' : 'categories'}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {categories.map(cat => {
            const status = saving[cat.id] || 'idle'
            return (
              <div key={cat.id} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-36 flex-shrink-0">
                  <span
                    className="size-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm truncate">
                    {cat.emoji} {cat.name}
                  </span>
                </div>
                <div className="flex-1">
                  <Select
                    value={localMappings[cat.id] || '__none__'}
                    onValueChange={val => handleChange(cat.id, val === '__none__' ? '' : val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a member..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- Unassigned --</SelectItem>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name} ({role.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-14 flex-shrink-0">
                  {status === 'saving' && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" />
                    </span>
                  )}
                  {status === 'saved' && (
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <Check className="size-3" /> Saved
                    </span>
                  )}
                  {status === 'error' && (
                    <span className="text-xs text-destructive">Error</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
