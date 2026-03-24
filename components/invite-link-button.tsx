'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Copy, Check, RefreshCw, QrCode, Share2, MessageCircle, Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface InviteLinkButtonProps {
  roleId: string
  roleName?: string
  existingLink?: string | null
  expiresAt?: string | null
}

export function InviteLinkButton({ roleId, roleName, existingLink, expiresAt }: InviteLinkButtonProps) {
  const [link, setLink] = useState(existingLink || '')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expires, setExpires] = useState(expiresAt || '')
  const [showQR, setShowQR] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [error, setError] = useState('')

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

  async function copyToClipboard() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Invite link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  function shareViaWhatsApp() {
    const text = `You've been invited to join as ${roleName || 'a team member'} on SlackFlow. Click to connect your Telegram: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  function shareViaEmail() {
    const subject = `SlackFlow — Join as ${roleName || 'Team Member'}`
    const body = `Hi,\n\nYou've been invited to join SlackFlow as ${roleName || 'a team member'}.\n\nClick the link below to connect your Telegram account:\n${link}\n\nThe link expires in 24 hours.`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
  }

  // No link yet — show generate button
  if (!link || isExpired) {
    return (
      <div className="space-y-1">
        <Button variant="outline" size="sm" onClick={generateLink} disabled={loading} className="text-xs">
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
          {isExpired ? 'Regenerate Invite' : 'Create Invite'}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // Link exists — show actions
  return (
    <div className="space-y-2">
      {/* Main action row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" onClick={copyToClipboard} className="text-xs h-7">
          {copied ? <Check className="h-3 w-3 mr-1 text-green-400" /> : <Copy className="h-3 w-3 mr-1" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setShowQR(!showQR); setShowShare(false) }} className="text-xs h-7 px-2" title="Show QR Code">
          <QrCode className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setShowShare(!showShare); setShowQR(false) }} className="text-xs h-7 px-2" title="Share">
          <Share2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="p-3 bg-white rounded-lg border inline-block">
          <QRCodeSVG value={link} size={140} level="M" />
          <p className="text-[10px] text-gray-500 mt-2 text-center">Scan to connect on Telegram</p>
        </div>
      )}

      {/* Share options */}
      {showShare && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={shareViaWhatsApp} className="text-xs h-7">
            <MessageCircle className="h-3 w-3 mr-1" />
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={shareViaEmail} className="text-xs h-7">
            <Mail className="h-3 w-3 mr-1" />
            Email
          </Button>
        </div>
      )}

      {/* Expiry info */}
      {expires && (
        <p className="text-[10px] text-muted-foreground">
          Expires {new Date(expires).toLocaleDateString()} at {new Date(expires).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
