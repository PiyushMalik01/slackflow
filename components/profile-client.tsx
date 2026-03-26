'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Pencil, Save, X, AlertTriangle, Trash2 } from 'lucide-react'

interface ProfileClientProps {
  email: string
  displayName: string
  companyName: string
}

export function ProfileClient({ email, displayName, companyName }: ProfileClientProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(displayName)
  const [company, setCompany] = useState(companyName)
  const [saving, setSaving] = useState(false)

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name, company_name: company }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Profile updated')
      setEditing(false)
      router.refresh()
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    setDeleting(true)
    try {
      const res = await fetch('/api/profile', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Account deleted')
      window.location.href = '/'
    } catch {
      toast.error('Failed to delete account')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Account Details</CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm font-medium">{email}</p>
          </div>

          {editing ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="display_name" className="text-xs">Display Name</Label>
                <Input
                  id="display_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company_name" className="text-xs">Company / Team Name</Label>
                <Input
                  id="company_name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  This name appears in all Telegram notifications so your team knows which company the message is from.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(displayName); setCompany(companyName) }}>
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Display Name</Label>
                <p className="text-sm font-medium">{displayName || <span className="text-muted-foreground italic">Not set</span>}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Company / Team Name</Label>
                <p className="text-sm font-medium">{companyName || <span className="text-muted-foreground italic">Not set</span>}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>

          {showDeleteConfirm ? (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium">
                Are you absolutely sure? This will delete your profile, all workspaces you own (with no other members), roles, categories, and AI settings.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="delete_confirm" className="text-xs">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm
                </Label>
                <Input
                  id="delete_confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="max-w-[200px]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  {deleting ? 'Deleting...' : 'Delete My Account'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete Account
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
