'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, RefreshCw } from 'lucide-react'
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

  const isExpired = expires ? new Date(expires) < new Date() : false

  async function generateLink() {
    setLoading(true)
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
      } else {
        setError('No invite link returned')
      }
    } catch {
      setError('Network error — could not generate link')
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!link || isExpired) {
    return (
      <div className="space-y-1">
        <Button variant="outline" size="sm" onClick={generateLink} disabled={loading}>
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
          {isExpired ? 'Regenerate Link' : 'Generate Invite Link'}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <code className="rounded bg-muted px-2 py-1 text-xs truncate max-w-[200px]">{link}</code>
      <Button variant="ghost" size="sm" onClick={copyToClipboard}>
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
}
