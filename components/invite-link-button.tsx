'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check, RefreshCw, Send, Link2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface InviteLinkButtonProps {
  roleId: string
  existingLink?: string | null
  expiresAt?: string | null
}

export function InviteLinkButton({ roleId, existingLink, expiresAt }: InviteLinkButtonProps) {
  const [link, setLink] = useState(existingLink || '')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expires, setExpires] = useState(expiresAt || '')
  const [error, setError] = useState('')

  // Direct send state
  const [showDirectSend, setShowDirectSend] = useState(false)
  const [telegramUsername, setTelegramUsername] = useState('')
  const [sending, setSending] = useState(false)

  const isExpired = expires ? new Date(expires) < new Date() : false

  async function generateLink() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/invite-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setError(err.error || 'Failed to generate invite link')
        return
      }
      const data = await res.json()
      if (data.deep_link) {
        setLink(data.deep_link)
        setExpires(data.expires_at)
        setError('')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function sendDirectInvite() {
    if (!telegramUsername.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/invite-tokens/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, telegram_username: telegramUsername.trim() }),
      })
      const data = await res.json()

      if (data.deep_link) {
        setLink(data.deep_link)
        setExpires(data.expires_at)
      }

      if (data.sent_directly) {
        toast.success(`Invite sent to @${telegramUsername.replace('@', '')} on Telegram!`)
        setShowDirectSend(false)
        setTelegramUsername('')
      } else {
        // Couldn't send directly — show the link to copy instead
        toast.error(
          `Couldn't message @${telegramUsername.replace('@', '')} directly (they need to start the bot first). Link generated — copy and share it.`,
          { duration: 6000 }
        )
      }
    } catch {
      toast.error('Failed to send invite')
    } finally {
      setSending(false)
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  // No link yet — show generate options
  if (!link || isExpired) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={generateLink} disabled={loading} className="text-xs">
            <Link2 className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
            {isExpired ? 'Regenerate Link' : 'Generate Link'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDirectSend(!showDirectSend)} className="text-xs">
            <Send className="h-3.5 w-3.5 mr-1" />
            Send via Telegram
          </Button>
        </div>

        {showDirectSend && (
          <div className="flex items-center gap-2">
            <Input
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              placeholder="@username"
              className="h-8 text-xs max-w-[180px]"
              onKeyDown={(e) => e.key === 'Enter' && sendDirectInvite()}
            />
            <Button size="sm" onClick={sendDirectInvite} disabled={sending || !telegramUsername.trim()} className="text-xs h-8">
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // Link exists — show it with copy + direct send option
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <code className="rounded bg-muted px-2 py-1 text-[11px] truncate max-w-[220px]">{link}</code>
        <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-7 w-7 p-0">
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowDirectSend(!showDirectSend)} className="h-7 w-7 p-0" title="Send via Telegram">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showDirectSend && (
        <div className="flex items-center gap-2">
          <Input
            value={telegramUsername}
            onChange={(e) => setTelegramUsername(e.target.value)}
            placeholder="@username"
            className="h-8 text-xs max-w-[180px]"
            onKeyDown={(e) => e.key === 'Enter' && sendDirectInvite()}
          />
          <Button size="sm" onClick={sendDirectInvite} disabled={sending || !telegramUsername.trim()} className="text-xs h-8">
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <>Send <Send className="h-3 w-3 ml-1" /></>}
          </Button>
        </div>
      )}
    </div>
  )
}
