import { getAuthUser, getServiceClient } from '@/lib/db/client'
import { ProfileClient } from '@/components/profile-client'
import { GuideTip } from '@/components/guide-tip'

export const metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const user = await getAuthUser()
  const svc = getServiceClient()

  // Fetch or auto-create profile
  let { data: profile } = await svc
    .from('user_profiles')
    .select('*')
    .eq('user_id', user!.id)
    .maybeSingle()

  if (!profile) {
    const { data: created } = await svc
      .from('user_profiles')
      .insert({ user_id: user!.id, display_name: '', company_name: '' })
      .select()
      .single()
    profile = created
  }

  const showCompanyTip = !profile?.company_name

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account settings and company identity.
        </p>
      </div>

      {showCompanyTip && (
        <GuideTip
          id="profile_company_name"
          title="Set up your company name"
          description="Add your company name in Profile so your team knows who's sending them notifications."
        />
      )}

      <ProfileClient
        email={user!.email || ''}
        displayName={profile?.display_name || ''}
        companyName={profile?.company_name || ''}
      />
    </div>
  )
}
