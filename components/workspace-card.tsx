'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, ChevronDown, ChevronUp, Hash, Loader2,
  AlertTriangle, Calendar, Radio
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
}

export function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [saving, setSaving] = useState(false)

  const monitoredCount = workspace.monitored_channels?.length || 0
  const accentColor = workspace.accent_color || '#3B82F6'

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

    try {
      await fetch(`/api/workspaces/${workspace.id}/channels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitored_channels: monitoredIds }),
      })
      router.refresh()
    } catch {
      // Revert on failure
      setChannels(channels)
    } finally {
      setSaving(false)
    }
  }

  return (
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
                  <Badge variant="secondary" className="text-[10px]">
                    {workspace.slack_team_id}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    Installed {new Date(workspace.installed_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Radio className="size-3" />
                    {monitoredCount} {monitoredCount === 1 ? 'channel' : 'channels'} monitored
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10">
                  Connected
                </Badge>
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

          {/* Team group status */}
          {workspace.team_group_chat_id && (
            <div className="mx-4 mb-3 text-xs text-muted-foreground">
              Team group linked: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{workspace.team_group_chat_id}</code>
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
                    No channels found. Make sure the bot is invited to channels.
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
          </CardContent>
        </div>
      </div>
    </Card>
  )
}
