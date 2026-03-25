'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, CheckCircle, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

const ROLE_TYPES = ['Developer', 'Designer', 'PM', 'Support', 'Other']

export function JoinForm({ code, ownerName }: { code: string; ownerName?: string }) {
  const [name, setName] = useState('')
  const [roleType, setRoleType] = useState('')
  const [customRole, setCustomRole] = useState('')
  const [step, setStep] = useState<'form' | 'telegram' | 'done'>('form')
  const [loading, setLoading] = useState(false)
  const [telegramLink, setTelegramLink] = useState('')

  const effectiveRole = roleType === 'Other' ? customRole : roleType

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !effectiveRole.trim()) return
    setLoading(true)

    try {
      const res = await fetch('/api/team-invite/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: name.trim(), type: effectiveRole.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to join')
        setLoading(false)
        return
      }

      setTelegramLink(data.telegram_link)
      setStep('telegram')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold mb-2">You&apos;re connected!</h2>
        <p className="text-sm text-muted-foreground">
          You&apos;ll receive task notifications on Telegram. Your admin can see you on the dashboard.
        </p>
      </div>
    )
  }

  if (step === 'telegram') {
    return (
      <div className="text-center space-y-4">
        <UserPlus className="w-10 h-10 text-primary mx-auto" />
        <h2 className="text-xl font-bold">Almost there!</h2>
        <p className="text-sm text-muted-foreground">
          Click the button below to connect your Telegram. This is where you&apos;ll receive task notifications.
        </p>
        <Button asChild size="lg" className="w-full">
          <a href={telegramLink} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(() => setStep('done'), 3000)}>
            Connect Telegram
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">
          After clicking, tap &quot;Start&quot; in Telegram to complete the connection.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Your Name</label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Rahul Sharma"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Your Role</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          {ROLE_TYPES.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => { setRoleType(type); if (type !== 'Other') setCustomRole('') }}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                roleType === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent border-border'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        {roleType === 'Other' && (
          <Input
            value={customRole}
            onChange={e => setCustomRole(e.target.value)}
            placeholder="Enter your role (e.g. QA Engineer, DevOps)"
            required
            className="mt-2"
          />
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading || !name.trim() || !effectiveRole.trim()}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
        Join Team
      </Button>
    </form>
  )
}
