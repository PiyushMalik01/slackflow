import { redirect } from 'next/navigation'
import { getAuthUser, getServiceClient } from '@/lib/db/client'
import { AppSidebar, MobileSidebarTrigger } from '@/components/app-sidebar'
import { RealtimeProvider } from '@/components/realtime-provider'
import { AuthListener } from '@/components/auth-listener'
import { Suspense } from 'react'
import { ProfileSetupGate } from '@/components/profile-setup-gate'
import { ThemeToggle } from '@/components/theme-toggle'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  // Check if user has completed profile setup
  const svc = getServiceClient()
  const { data: profile } = await svc
    .from('user_profiles')
    .select('company_name, display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const needsSetup = !profile || !profile.company_name || !profile.display_name

  // If profile is incomplete, redirect to profile setup (except if already on profile page)
  if (needsSetup) {
    return (
      <div className="min-h-screen bg-background">
        <AuthListener />
        <AppSidebar />
        <div className="md:ml-64">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-4 md:hidden">
            <MobileSidebarTrigger />
            <span className="text-sm font-semibold">SlackFlow</span>
          </header>
          <main className="p-4 md:p-6 lg:p-8">
            <ProfileSetupGate>{children}</ProfileSetupGate>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AuthListener />
      <AppSidebar />
      <div className="md:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4">
          <div className="flex items-center gap-3 md:hidden">
            <MobileSidebarTrigger />
            <span className="text-sm font-semibold">SlackFlow</span>
          </div>
          <div className="hidden md:block" />
          <ThemeToggle />
        </header>
        <main className="p-4 md:p-6 lg:p-8">
          <RealtimeProvider>
            <Suspense fallback={<div className="space-y-4"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="h-64 animate-pulse rounded bg-muted" /></div>}>
              {children}
            </Suspense>
          </RealtimeProvider>
        </main>
      </div>
    </div>
  )
}
