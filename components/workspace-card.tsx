'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, ChevronDown, ChevronUp, Hash, Loader2,
  AlertTriangle, Calendar, Radio, Trash2, LogOut, Users,
  Filter, Save, HelpCircle
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import Link from 'next/link'

interface Channel {
  id: string
  name: string
  is_monitored: boolean
  is_member?: boolean
}

interface Workspace {
  id: string
  name: string
  slack_team_id: string
  installed_at: string
  monitored_channels: string[] | null
  accent_color?: string
  team_group_chat_id?: string | null
  message_filter_mode?: string
  ignored_slack_users?: string[]
  whitelisted_slack_users?: string[]
}

function SlackIdHelp() {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <HelpCircle className="size-3.5" />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg border bg-popover text-popover-foreground shadow-lg text-xs">
          <p className="font-medium mb-1.5">How to find a Slack User ID</p>
          <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
            <li>Open Slack and click on the user&apos;s profile picture</li>
            <li>Click the <strong>three dots</strong> (More) button</li>
            <li>Select <strong>&quot;Copy member ID&quot;</strong></li>
            <li>Paste it here (looks like <code className="bg-muted px-1 rounded">U0ANAQ85X3Q</code>)</li>
          </ol>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45 bg-popover border-b border-r" />
        </div>
      )}
    </span>
  )
}

export function WorkspaceCard({
  workspace,
  isOwner = true,
  memberCount = 1,
}: {
  workspace: Workspace
  isOwner?: boolean
  memberCount?: number
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Message filter state
  const [filterExpanded, setFilterExpanded] = useState(false)
  const [filterMode, setFilterMode] = useState(workspace.message_filter_mode || 'all')
  const [ignoredUsers, setIgnoredUsers] = useState((workspace.ignored_slack_users || []).join(', '))
  const [whitelistedUsers, setWhitelistedUsers] = useState((workspace.whitelisted_slack_users || []).join(', '))
  const [savingFilter, setSavingFilter] = useState(false)

  const monitoredCount = workspace.monitored_channels?.length || 0
  const accentColor = workspace.accent_color || '#3B82F6'
  const isShared = memberCount > 1

  async function toggleExpanded() {
    if (!expanded && channels === null) {
      setLoading(true)
      try {
        const res = await fetch(`/api/workspaces/${workspace.id}/channels`)
        const data = await res.json()
        if (data.needs_reauth) {
          setNeedsReauth(true)
          setChannels([])
        } else if (Array.isArray(data)) {
          setChannels(data)
        } else {
          setChannels([])
        }
      } catch {
        setChannels([])
      } finally {
        setLoading(false)
      }
    }
    setExpanded(!expanded)
  }

  async function toggleChannel(channelId: string) {
    if (!channels) return
    setSaving(true)

    const updated = channels.map(ch =>
      ch.id === channelId ? { ...ch, is_monitored: !ch.is_monitored } : ch
    )
    setChannels(updated)

    const monitoredIds = updated.filter(ch => ch.is_monitored).map(ch => ch.id)

    const targetChannel = channels.find(ch => ch.id === channelId)
    const isEnabling = !targetChannel?.is_monitored

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/channels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitored_channels: monitoredIds }),
      })
      const data = await res.json()
      if (!res.ok || data.errors?.length) {
        const errMsg = data.errors?.[0] || data.error || 'Failed to update channel'
        toast.error(errMsg)
        setChannels(channels) // revert
        return
      }
      if (isEnabling) {
        toast.success(`Bot joined #${targetChannel?.name} — now monitoring`)
      } else {
        toast.success(`Bot left #${targetChannel?.name} — monitoring stopped`)
      }
      router.refresh()
    } catch {
      toast.error('Failed to update channel monitoring')
      setChannels(channels)
    } finally {
      setSaving(false)
    }
  }

  // Determine dialog text based on ownership and member count
  const isOwnerWithOtherMembers = isOwner && isShared
  const disconnectTitle = isOwner && !isShared ? 'Delete Workspace' : 'Disconnect Workspace'
  const disconnectDescription = isOwner && !isShared
    ? `Delete "${workspace.name}"? All tasks, routing rules, and activity logs for this workspace will be permanently removed.`
    : isOwnerWithOtherMembers
    ? `Disconnect from "${workspace.name}"? Ownership will be transferred to another member. The workspace and its data will remain accessible to other members.`
    : `Disconnect from "${workspace.name}"? You will lose access to this workspace's tasks and activity. The workspace will remain for other members.`
  const disconnectLabel = isOwner && !isShared ? 'Delete Workspace' : 'Disconnect'

  return (
    <>
    <Card className="overflow-hidden">
      <div className="flex">
        {/* Accent color stripe */}
        <div
          className="w-1 flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />

        <div className="flex-1">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                <Building2 className="size-5" style={{ color: accentColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle>{workspace.name}</CardTitle>
                  {!isOwner && (
                    <Badge variant="secondary" className="text-[10px]">
                      Shared
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3 flex-shrink-0" />
                    Installed {new Date(workspace.installed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Radio className="size-3 flex-shrink-0" />
                    {monitoredCount} {monitoredCount === 1 ? 'channel' : 'channels'} monitored
                  </span>
                  {isShared && (
                    <span className="flex items-center gap-1">
                      <Users className="size-3 flex-shrink-0" />
                      {memberCount} {memberCount === 1 ? 'member' : 'members'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10">
                  Connected
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 h-7 w-7 p-0"
                  onClick={() => setDeleteOpen(true)}
                  title={isOwner && !isShared ? 'Delete workspace' : 'Disconnect workspace'}
                >
                  {isOwner && !isShared ? (
                    <Trash2 className="size-3.5" />
                  ) : (
                    <LogOut className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Reauth banner */}
          {needsReauth && (
            <div className="mx-4 mb-3 flex items-center gap-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-3 py-2 rounded-lg text-xs">
              <AlertTriangle className="size-3.5 flex-shrink-0" />
              <span>This workspace may need re-authorization. Some features require additional scopes.</span>
              <Button variant="outline" size="xs" asChild className="ml-auto flex-shrink-0">
                <Link href="/api/slack/install">Re-authorize</Link>
              </Button>
            </div>
          )}

          {/* Manage channels toggle */}
          <CardContent>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpanded}
              className="w-full justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Hash className="size-3.5" />
                Manage Channels
              </span>
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </Button>

            {expanded && channels !== null && (
              <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                {channels.length === 0 && !needsReauth ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No public channels found. The workspace may need re-authorization with the <code>channels:read</code> scope.
                  </p>
                ) : (
                  channels.map(ch => (
                    <button
                      key={ch.id}
                      onClick={() => toggleChannel(ch.id)}
                      disabled={saving}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                        ch.is_monitored
                          ? 'bg-primary/10 text-foreground'
                          : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <div className={`size-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        ch.is_monitored
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input'
                      }`}>
                        {ch.is_monitored && (
                          <svg className="size-3" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <Hash className="size-3.5 flex-shrink-0 opacity-50" />
                      <span className="truncate">{ch.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Message Filter */}
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterExpanded(!filterExpanded)}
                className="w-full justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Filter className="size-3.5" />
                  Message Filter
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {filterMode === 'all' ? 'All' : filterMode === 'ignore_team' ? 'Ignore team' : 'Whitelist'}
                  </Badge>
                </span>
                {filterExpanded ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </Button>

              {filterExpanded && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Control which Slack messages get processed by the AI pipeline.
                  </p>

                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All messages', desc: 'Process every message in monitored channels' },
                      { value: 'ignore_team', label: 'Ignore team members', desc: 'Skip messages from specified Slack users (your team)' },
                      { value: 'whitelist_only', label: 'Only specific users', desc: 'Only process messages from whitelisted Slack users (clients)' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors">
                        <input
                          type="radio"
                          name={`filter-${workspace.id}`}
                          value={opt.value}
                          checked={filterMode === opt.value}
                          onChange={() => setFilterMode(opt.value)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {filterMode === 'ignore_team' && (
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium">
                        Team Slack User IDs to ignore
                        <SlackIdHelp />
                      </label>
                      <Input
                        value={ignoredUsers}
                        onChange={e => setIgnoredUsers(e.target.value)}
                        placeholder="U0ANAQ85X3Q, U0BN7G3K1M2"
                      />
                    </div>
                  )}

                  {filterMode === 'whitelist_only' && (
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium">
                        Whitelisted Slack User IDs
                        <SlackIdHelp />
                      </label>
                      <Input
                        value={whitelistedUsers}
                        onChange={e => setWhitelistedUsers(e.target.value)}
                        placeholder="U0CLIENT1, U0CLIENT2"
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="text-xs"
                      disabled={savingFilter}
                      onClick={async () => {
                        setSavingFilter(true)
                        try {
                          const res = await fetch(`/api/workspaces/${workspace.id}/preferences`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              message_filter_mode: filterMode,
                              ignored_slack_users: ignoredUsers.split(',').map(s => s.trim()).filter(Boolean),
                              whitelisted_slack_users: whitelistedUsers.split(',').map(s => s.trim()).filter(Boolean),
                            }),
                          })
                          if (res.ok) {
                            toast.success('Message filter saved')
                            router.refresh()
                          } else {
                            toast.error('Failed to save filter')
                          }
                        } catch {
                          toast.error('Failed to save filter')
                        } finally {
                          setSavingFilter(false)
                        }
                      }}
                    >
                      {savingFilter ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                      Save Filter
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </div>
      </div>
    </Card>

    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title={disconnectTitle}
      description={disconnectDescription}
      confirmLabel={disconnectLabel}
      variant="danger"
      onConfirm={async () => {
        const res = await fetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' })
        if (res.ok) {
          toast.success(isOwner && !isShared ? 'Workspace deleted' : 'Disconnected from workspace')
          router.refresh()
        } else {
          toast.error('Failed to disconnect workspace')
        }
      }}
    />
    </>
  )
}
