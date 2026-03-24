'use client'

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Save, Trash2, Edit2, X, Loader2,
  Tag, Sliders, CheckCircle2, XCircle, RefreshCw,
  Brain, ExternalLink, Key, LogOut, Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// -- Color palette for categories ---------------------------------------------
const COLOR_PALETTE = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
]

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

interface WorkspacePrefs {
  id: string
  name: string
  accent_color?: string | null
  team_group_chat_id?: string | null
  daily_digest_time?: string | null
}

type AIStatus =
  | { connected: false }
  | {
      connected: true
      email: string | null
      planType: string | null
      authMethod: string
      connectedAt: string | null
    }

interface SettingsClientProps {
  initialCategories: Category[]
  workspaces: WorkspacePrefs[]
  aiStatus: AIStatus
}

// -- Main Client --------------------------------------------------------------

export function SettingsClient({
  initialCategories,
  workspaces,
  aiStatus,
}: SettingsClientProps) {
  return (
    <Tabs defaultValue="categories">
      <TabsList>
        <TabsTrigger value="categories">
          <Tag className="size-3.5" />
          Categories
        </TabsTrigger>
        <TabsTrigger value="preferences">
          <Sliders className="size-3.5" />
          Preferences
        </TabsTrigger>
        <TabsTrigger value="ai">
          <Brain className="size-3.5" />
          AI
        </TabsTrigger>
      </TabsList>

      <TabsContent value="categories">
        <CategoriesTab initialCategories={initialCategories} />
      </TabsContent>

      <TabsContent value="preferences">
        <PreferencesTab workspaces={workspaces} />
      </TabsContent>

      <TabsContent value="ai">
        <AITab initialStatus={aiStatus} />
      </TabsContent>
    </Tabs>
  )
}

// -- AI Tab -------------------------------------------------------------------

function AITab({ initialStatus }: { initialStatus: AIStatus }) {
  const router = useRouter()
  const [status, setStatus] = useState<AIStatus>(initialStatus)
  const [disconnecting, setDisconnecting] = useState(false)

  // Device code flow state
  const [deviceFlow, setDeviceFlow] = useState<{
    userCode: string
    verificationUrl: string
    deviceAuthId: string
  } | null>(null)
  const [deviceFlowLoading, setDeviceFlowLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Manual API key state
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiKeyLoading, setApiKeyLoading] = useState(false)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  async function startDeviceCodeFlow() {
    setDeviceFlowLoading(true)
    try {
      const res = await fetch('/api/auth/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'device-code' }),
      })
      if (!res.ok) {
        toast.error('Failed to start device code flow')
        return
      }
      const data = await res.json()
      setDeviceFlow({
        userCode: data.userCode,
        verificationUrl: data.verificationUrl,
        deviceAuthId: data.deviceAuthId,
      })

      // Start polling
      const deviceAuthId = data.deviceAuthId
      const userCode = data.userCode
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/auth/openai/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceAuthId, userCode }),
          })
          if (!pollRes.ok) return
          const pollData = await pollRes.json()

          if (pollData.status === 'connected') {
            stopPolling()
            setDeviceFlow(null)
            setStatus({
              connected: true,
              email: pollData.email,
              planType: pollData.planType,
              authMethod: 'oauth-device',
              connectedAt: new Date().toISOString(),
            })
            toast.success('ChatGPT connected!')
            router.refresh()
          } else if (pollData.status === 'expired' || pollData.status === 'exchange_failed') {
            stopPolling()
            setDeviceFlow(null)
            toast.error(pollData.message || 'Device code expired. Please try again.')
          }
        } catch {
          // Ignore poll errors, keep trying
        }
      }, 5000)
    } catch {
      toast.error('Failed to start device code flow')
    } finally {
      setDeviceFlowLoading(false)
    }
  }

  function cancelDeviceCodeFlow() {
    stopPolling()
    setDeviceFlow(null)
  }

  async function saveApiKey() {
    if (!apiKey.trim()) return
    setApiKeyLoading(true)
    try {
      const res = await fetch('/api/auth/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'api-key', apiKey: apiKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to save API key')
        return
      }
      setStatus({
        connected: true,
        email: null,
        planType: null,
        authMethod: 'api-key',
        connectedAt: new Date().toISOString(),
      })
      setShowApiKeyInput(false)
      setApiKey('')
      toast.success('OpenAI API key connected!')
      router.refresh()
    } catch {
      toast.error('Failed to save API key')
    } finally {
      setApiKeyLoading(false)
    }
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/auth/openai/disconnect', { method: 'POST' })
      if (res.ok) {
        setStatus({ connected: false })
        toast.success('ChatGPT disconnected')
        router.refresh()
      } else {
        toast.error('Failed to disconnect')
      }
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-6 mt-4">
      <div>
        <h2 className="text-lg font-semibold">AI Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Connect your ChatGPT account or enter an API key to power AI classification and drafts.
        </p>
      </div>

      {/* Connected State */}
      {status.connected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>ChatGPT</CardTitle>
                <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                  <CheckCircle2 className="size-3 mr-1" /> Connected
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                disabled={disconnecting}
                className="text-destructive hover:text-destructive"
              >
                {disconnecting ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
                Disconnect
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {status.email && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground block mb-1">Email</span>
                  <span className="text-sm">{status.email}</span>
                </div>
              )}
              {status.planType && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground block mb-1">Plan</span>
                  <span className="text-sm capitalize">{status.planType}</span>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Auth Method</span>
                <span className="text-sm">
                  {status.authMethod === 'oauth-device' ? 'ChatGPT OAuth' : 'API Key'}
                </span>
              </div>
              {status.connectedAt && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground block mb-1">Connected</span>
                  <span className="text-sm">{new Date(status.connectedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disconnected State */}
      {!status.connected && !deviceFlow && (
        <Card>
          <CardHeader>
            <CardTitle>Connect ChatGPT</CardTitle>
            <CardDescription>
              When connected, AI classification and drafts use your ChatGPT account.
              When disconnected, the platform uses the built-in AI key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={startDeviceCodeFlow}
                disabled={deviceFlowLoading}
                className="flex-1"
              >
                {deviceFlowLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ExternalLink className="size-4" />
                )}
                Sign in with ChatGPT
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowApiKeyInput(true)}
                disabled={showApiKeyInput}
                className="flex-1"
              >
                <Key className="size-4" />
                Enter API Key Manually
              </Button>
            </div>

            {showApiKeyInput && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div>
                  <label className="block text-xs font-medium mb-1.5">OpenAI API Key</label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Your key is encrypted at rest and never exposed to the client.
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowApiKeyInput(false); setApiKey('') }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveApiKey}
                    disabled={apiKeyLoading || !apiKey.trim()}
                  >
                    {apiKeyLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    Validate & Save
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Device Code Flow Overlay */}
      {deviceFlow && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Authorize ChatGPT</CardTitle>
              <Button variant="ghost" size="icon-xs" onClick={cancelDeviceCodeFlow}>
                <X className="size-4" />
              </Button>
            </div>
            <CardDescription>
              Enter this code on ChatGPT to connect your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <code className="text-3xl font-mono font-bold tracking-widest bg-muted px-6 py-3 rounded-lg select-all">
                {deviceFlow.userCode}
              </code>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  navigator.clipboard.writeText(deviceFlow.userCode)
                  toast.success('Code copied!')
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>

            <div className="flex justify-center">
              <Button asChild>
                <a
                  href={deviceFlow.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-4" />
                  Open ChatGPT
                </a>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Waiting for authorization...
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// -- Categories Tab -----------------------------------------------------------

function CategoriesTab({ initialCategories }: { initialCategories: Category[] }) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null)

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Categories</h2>
          <p className="text-sm text-muted-foreground">
            Organize incoming messages by category. Categories are used by the AI classifier.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="size-3.5" />
          Add Category
        </Button>
      </div>

      {showAddForm && (
        <CategoryForm
          onSave={async (data) => {
            const res = await fetch('/api/categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })
            if (res.ok) {
              const cat = await res.json()
              setCategories(prev => [...prev, cat])
              setShowAddForm(false)
              toast.success('Category created')
              router.refresh()
            } else {
              toast.error('Failed to create category')
            }
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="space-y-2">
        {categories.map((cat) =>
          editingId === cat.id ? (
            <CategoryForm
              key={cat.id}
              initial={cat}
              onSave={async (data) => {
                const res = await fetch('/api/categories', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: cat.id, ...data }),
                })
                if (res.ok) {
                  setCategories(prev =>
                    prev.map(c => c.id === cat.id ? { ...c, ...data } : c)
                  )
                  setEditingId(null)
                  toast.success('Category updated')
                  router.refresh()
                } else {
                  toast.error('Failed to update category')
                }
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <CategoryItem
              key={cat.id}
              category={cat}
              onEdit={() => setEditingId(cat.id)}
              onDelete={() => setDeleteCategoryId(cat.id)}
            />
          )
        )}
      </div>

      <ConfirmDialog
        open={deleteCategoryId !== null}
        onOpenChange={(open) => { if (!open) setDeleteCategoryId(null) }}
        title="Delete Category"
        description="Delete this category? Tasks using it will become uncategorized. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (!deleteCategoryId) return
          const res = await fetch(`/api/categories?id=${deleteCategoryId}`, { method: 'DELETE' })
          if (res.ok) {
            setCategories(prev => prev.filter(c => c.id !== deleteCategoryId))
            toast.success('Category deleted')
            router.refresh()
          } else {
            toast.error('Failed to delete category')
          }
        }}
      />

      {categories.length === 0 && !showAddForm && (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No categories configured. Click &quot;Add Category&quot; to create one.
        </div>
      )}
    </div>
  )
}

function CategoryItem({
  category,
  onEdit,
  onDelete,
}: {
  category: Category
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card group hover:border-border/80 transition-colors">
      <span
        className="size-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: category.color }}
      />
      <span className="text-base flex-shrink-0">{category.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{category.name}</span>
          {category.is_default && (
            <Badge variant="secondary" className="text-[10px]">Default</Badge>
          )}
        </div>
        {category.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {category.description}
          </p>
        )}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button variant="ghost" size="icon-xs" onClick={onEdit}>
          <Edit2 className="size-3.5" />
        </Button>
        {!category.is_default && (
          <Button variant="ghost" size="icon-xs" onClick={onDelete} className="hover:text-destructive">
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

function CategoryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Category>
  onSave: (data: { name: string; description: string; emoji: string; color: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [emoji, setEmoji] = useState(initial?.emoji || '')
  const [color, setColor] = useState(initial?.color || COLOR_PALETTE[0])
  const [saving, setSaving] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  // Close picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    if (showEmojiPicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description, emoji, color })
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
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Bug, Feature, Urgent"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Emoji</label>
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors"
                >
                  <span className="text-lg">{emoji || '😀'}</span>
                  <span className="text-muted-foreground text-xs">{emoji ? 'Change emoji' : 'Pick an emoji'}</span>
                </button>
                {showEmojiPicker && (
                  <div className="absolute z-50 top-full mt-1 right-0">
                    <EmojiPickerDropdown
                      onSelect={(emojiStr: string) => {
                        setEmoji(emojiStr)
                        setShowEmojiPicker(false)
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Description</label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of when this category applies"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-7 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? 'var(--foreground)' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <X className="size-3.5" /> Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {initial ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// -- Emoji Picker Dropdown ----------------------------------------------------

const LazyEmojiPicker = lazy(() => import('emoji-picker-react'))

function EmojiPickerDropdown({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <div className="rounded-xl border shadow-xl bg-popover overflow-hidden">
      <Suspense fallback={<div className="w-[350px] h-[400px] flex items-center justify-center text-sm text-muted-foreground">Loading...</div>}>
        <LazyEmojiPicker
          onEmojiClick={(emojiData) => onSelect(emojiData.emoji)}
          width={350}
          height={400}
          searchPlaceHolder="Search emoji..."
          previewConfig={{ showPreview: false }}
          skinTonesDisabled
          lazyLoadEmojis
        />
      </Suspense>
    </div>
  )
}

// -- Preferences Tab ----------------------------------------------------------

const ACCENT_COLORS = [
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Green', value: '#22C55E' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Pink', value: '#EC4899' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Teal', value: '#14B8A6' },
  { label: 'Slate', value: '#64748B' },
]

function PreferencesTab({ workspaces }: { workspaces: WorkspacePrefs[] }) {
  return (
    <div className="space-y-6 mt-4">
      <div>
        <h2 className="text-lg font-semibold">Preferences</h2>
        <p className="text-sm text-muted-foreground">
          Configure workspace settings and check platform health.
        </p>
      </div>

      {workspaces.length > 0 ? (
        workspaces.map(ws => (
          <WorkspacePrefsCard key={ws.id} workspace={ws} />
        ))
      ) : (
        <div className="py-12 text-center rounded-lg border border-dashed border-border">
          <Sliders className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Connect a workspace to configure preferences.
          </p>
        </div>
      )}

      <HealthCheckCard />
    </div>
  )
}

function WorkspacePrefsCard({ workspace }: { workspace: WorkspacePrefs }) {
  const router = useRouter()
  const [accentColor, setAccentColor] = useState(workspace.accent_color || '#3B82F6')
  const [telegramGroupId, setTelegramGroupId] = useState(workspace.team_group_chat_id || '')
  const [digestTime, setDigestTime] = useState(workspace.daily_digest_time || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accent_color: accentColor,
          team_group_chat_id: telegramGroupId || null,
          daily_digest_time: digestTime || null,
        }),
      })
      if (res.ok) {
        toast.success('Preferences saved')
        router.refresh()
      } else {
        toast.error('Failed to save preferences')
      }
    } catch {
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{workspace.name}</CardTitle>
        <CardDescription>Workspace-level preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Accent color */}
        <div>
          <label className="block text-xs font-medium mb-2">Accent Color</label>
          <div className="flex gap-2">
            {ACCENT_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setAccentColor(c.value)}
                className="size-7 rounded-full border-2 transition-all hover:scale-110"
                title={c.label}
                style={{
                  backgroundColor: c.value,
                  borderColor: accentColor === c.value ? 'var(--foreground)' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>

        {/* Telegram group */}
        <div>
          <label className="block text-xs font-medium mb-1.5">Telegram Group Chat ID</label>
          <Input
            value={telegramGroupId}
            onChange={e => setTelegramGroupId(e.target.value)}
            placeholder="e.g. -1001234567890"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Link a Telegram group for team-wide notifications.
          </p>
        </div>

        {/* Daily digest */}
        <div>
          <label className="block text-xs font-medium mb-1.5">Daily Digest Time</label>
          <div className="flex items-center gap-3">
            <Input
              type="time"
              value={digestTime}
              onChange={e => setDigestTime(e.target.value)}
              className="w-40"
            />
            {digestTime && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDigestTime('')}
                className="text-xs text-muted-foreground"
              >
                Disable
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {digestTime ? `Digest will be sent daily at ${digestTime}.` : 'Disabled — no daily digest will be sent.'}
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface HealthStatus {
  status: 'healthy' | 'degraded'
  timestamp: string
  checks: Record<string, 'ok' | 'error'>
}

function HealthCheckCard() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchHealth() {
    setLoading(true)
    try {
      const res = await fetch('/api/health')
      if (res.ok) {
        setHealth(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Platform Health</CardTitle>
            <CardDescription>Status of connected services</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!health && !loading && (
          <p className="text-sm text-muted-foreground">Unable to fetch health status.</p>
        )}
        {health && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              {health.status === 'healthy' ? (
                <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                  <CheckCircle2 className="size-3 mr-1" /> Healthy
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  <XCircle className="size-3 mr-1" /> Degraded
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Last checked: {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(health.checks).map(([name, status]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm capitalize">{name}</span>
                  {status === 'ok' ? (
                    <CheckCircle2 className="size-4 text-green-500" />
                  ) : (
                    <XCircle className="size-4 text-destructive" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {loading && !health && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking platform health...
          </div>
        )}
      </CardContent>
    </Card>
  )
}
