'use client'

import { useState } from 'react'
import { Check, Loader2, Save, Trash2, Edit2, X } from 'lucide-react'

// ── Role Item (Edit & Delete) ──────────────────────────────────────────────────

export function RoleItem({ role, onDeleted }: { role: any; onDeleted: () => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [name, setName] = useState(role.name)
  const [type, setType] = useState(role.type)
  const [chatId, setChatId] = useState(role.telegram_chat_id || '')

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch('/api/roles', {
        method: 'PUT',
        body: JSON.stringify({ id: role.id, name, type, telegram_chat_id: chatId }),
      })
      if (res.ok) setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this role? Route mappings will be removed.')) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/roles?id=${role.id}`, { method: 'DELETE' })
      if (res.ok) onDeleted()
    } finally {
      setIsDeleting(false)
    }
  }

  if (isEditing) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg space-y-3 border border-border">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-2.5 py-1.5 text-sm rounded bg-background border border-input focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Type</label>
            <input value={type} onChange={e => setType(e.target.value)} className="w-full px-2.5 py-1.5 text-sm rounded bg-background border border-input focus:outline-none focus:ring-1 focus:ring-primary mb-1" />
            <div className="flex flex-wrap gap-1">
              {['Builder', 'Support', 'PM', 'Designer', 'Lead'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Telegram Chat ID</label>
          <input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="Optional" className="w-full px-2.5 py-1.5 text-sm rounded bg-background border border-input focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-xs font-medium rounded hover:bg-muted transition-colors flex items-center gap-1"><X className="w-3 h-3"/> Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors flex items-center gap-1 disabled:opacity-50">
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>}
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg group">
      <div className="flex-1">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-xs text-muted-foreground ml-2">({type})</span>
        {chatId && <span className="text-xs text-muted-foreground ml-2">· Telegram: {chatId}</span>}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button onClick={() => setIsEditing(true)} className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"><Edit2 className="w-4 h-4" /></button>
        <button onClick={handleDelete} disabled={isDeleting} className="p-1.5 text-muted-foreground hover:text-red-500 rounded hover:bg-red-500/10 transition-colors">
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Role List Container ────────────────────────────────────────────────────────

export function RoleList({ initialRoles }: { initialRoles: any[] }) {
  // We use client state so we can immediately remove deleted roles without a full page refresh
  const [roles, setRoles] = useState(initialRoles)

  if (roles.length === 0) {
    return <div className="text-sm text-muted-foreground py-4 text-center">No roles yet. Create your first role below.</div>
  }

  return (
    <div className="space-y-2 mb-6">
      {roles.map(role => (
        <RoleItem key={role.id} role={role} onDeleted={() => setRoles(rs => rs.filter(r => r.id !== role.id))} />
      ))}
    </div>
  )
}

// ── Workspace Role Select (AJAX Save) ──────────────────────────────────────────

export function WorkspaceRoleSelect({ 
  workspaceId, 
  category, 
  initialRoleId, 
  roles 
}: { 
  workspaceId: string, category: string, initialRoleId: string, roles: any[] 
}) {
  const [roleId, setRoleId] = useState(initialRoleId)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function handleSave(newRoleId: string) {
    setRoleId(newRoleId)
    setStatus('saving')
    
    try {
      const res = await fetch('/api/workspace-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, category, role_id: newRoleId }),
      })
      if (res.ok) {
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 2000)
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-24 flex-shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          category === 'BUG' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
          : category === 'FEATURE' ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground'
        }`}>
          {category}
        </span>
      </div>
      <select
        value={roleId}
        onChange={(e) => handleSave(e.target.value)}
        disabled={status === 'saving'}
        className={`flex-1 px-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${
          status === 'saved' ? 'border-green-500 ring-1 ring-green-500' : 'border-input'
        }`}
      >
        <option value="">— No role —</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name} — {role.type}
          </option>
        ))}
      </select>
      
      <div className="w-16 flex items-center justify-start flex-shrink-0">
        {status === 'saving' && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving</span>}
        {status === 'saved' && <span className="text-xs text-green-500 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
        {status === 'error' && <span className="text-xs text-red-500">Error</span>}
      </div>
    </div>
  )
}

// ── Role Type Input (Client interactions in form) ──────────────────────────────

export function RoleTypeInput() {
  const [type, setType] = useState('')

  return (
    <div className="relative">
      <input
        name="type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        placeholder="e.g. Lead, Support..."
        className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {['Builder', 'Support', 'PM', 'Designer', 'Lead'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Workspace Category List (Add custom categories) ─────────────────────────

export function WorkspaceCategoryList({
  workspaceId,
  initialMappings,
  roles,
}: {
  workspaceId: string
  initialMappings: any[]
  roles: any[]
}) {
  const [categories, setCategories] = useState<string[]>(() => {
    const defaultCats = ['BUG', 'FEATURE', 'GENERAL']
    const dbCats = initialMappings.map((m) => m.category)
    return Array.from(new Set([...defaultCats, ...dbCats])) // unique union
  })
  const [newCat, setNewCat] = useState('')

  const handleAdd = (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = newCat.trim().toUpperCase().replace(/\s+/g, '_')
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed])
    }
    setNewCat('')
  }

  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const mapping = initialMappings.find((m) => m.category === category)
        return (
          <WorkspaceRoleSelect
            key={category}
            workspaceId={workspaceId}
            category={category}
            initialRoleId={mapping?.role_id ?? ''}
            roles={roles}
          />
        )
      })}
      
      <form onSubmit={handleAdd} className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
        <input 
          value={newCat}
          onChange={e => setNewCat(e.target.value)}
          placeholder="New category..."
          className="px-3 py-1.5 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary w-40"
        />
        <button 
          type="submit"
          className="px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-md hover:bg-primary/10 hover:text-primary transition-colors font-medium border border-transparent hover:border-primary/20"
        >
          Add custom category
        </button>
      </form>
    </div>
  )
}
