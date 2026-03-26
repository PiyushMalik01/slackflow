'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { BRAND_LOGO_SIZES, PlatformLogo } from '@/components/platform-logo'
import { Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export function ProfileSetupGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim() || !companyName.trim()) return

    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
          company_name: companyName.trim(),
        }),
      })

      if (res.ok) {
        toast.success('Profile set up!')
        router.refresh()
      } else {
        toast.error('Failed to save profile')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 shadow-2xl border">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <PlatformLogo imageSize={BRAND_LOGO_SIZES.auth} textClassName="font-bold text-xl" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Welcome to SlackFlow</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Let's set up your profile. This helps your team identify notifications from you.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium mb-1.5">
                Your Name
              </label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Piyush Malik"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="companyName" className="block text-sm font-medium mb-1.5">
                Company / Team Name
              </label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp, Design Team"
                required
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                This appears in Telegram notifications so your team knows which company a task is from.
              </p>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={saving || !displayName.trim() || !companyName.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <ArrowRight className="size-4 mr-2" />}
              Continue to Dashboard
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
