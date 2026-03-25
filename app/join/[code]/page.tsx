import { getServiceClient } from '@/lib/db/client'
import { JoinForm } from './join-form'
import { PlatformLogo, BRAND_LOGO_SIZES } from '@/components/platform-logo'
import Link from 'next/link'

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const svc = getServiceClient()

  const { data: inviteLink } = await svc
    .from('team_invite_links')
    .select('*')
    .eq('code', code)
    .maybeSingle()

  if (!inviteLink || !inviteLink.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/40 via-background to-muted/20 px-4">
        <div className="text-center max-w-sm">
          <PlatformLogo imageSize={BRAND_LOGO_SIZES.auth} textClassName="font-bold text-xl" />
          <h1 className="text-xl font-bold mt-6 mb-2">Invalid Invite Link</h1>
          <p className="text-sm text-muted-foreground">
            This link is invalid, expired, or has been deactivated. Ask your admin for a new one.
          </p>
          <Link href="/" className="text-sm text-primary hover:underline mt-4 inline-block">
            &larr; Back to SlackFlow
          </Link>
        </div>
      </div>
    )
  }

  if (inviteLink.join_count >= inviteLink.max_joins) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/40 via-background to-muted/20 px-4">
        <div className="text-center max-w-sm">
          <PlatformLogo imageSize={BRAND_LOGO_SIZES.auth} textClassName="font-bold text-xl" />
          <h1 className="text-xl font-bold mt-6 mb-2">Link Full</h1>
          <p className="text-sm text-muted-foreground">
            This invite link has reached its maximum number of joins. Ask your admin to generate a new one.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/40 via-background to-muted/20 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6">
            <PlatformLogo imageSize={BRAND_LOGO_SIZES.auth} textClassName="font-bold text-xl" priority />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Join the team</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Enter your details to start receiving task notifications on Telegram.
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <JoinForm code={code} />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by <Link href="/" className="text-primary hover:underline">SlackFlow</Link>
        </p>
      </div>
    </div>
  )
}
