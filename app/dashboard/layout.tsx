import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/db/client'
import { AppSidebar, MobileSidebarTrigger } from '@/components/app-sidebar'
import { RealtimeProvider } from '@/components/realtime-provider'
import { AuthListener } from '@/components/auth-listener'
import { Suspense } from 'react'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      <AuthListener />
      <AppSidebar />
      <div className="md:ml-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-4 md:hidden">
          <MobileSidebarTrigger />
          <span className="text-sm font-semibold">SlackFlow</span>
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
