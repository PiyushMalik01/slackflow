import { AppSidebar } from '@/components/app-sidebar'

// Auth guard is handled by proxy.ts — no need to duplicate it here.
// Server Components cannot write cookies, so calling getUser() here to redirect
// causes a loop when the token needs refreshing.

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <AppSidebar />
      <div className="pl-60 flex-1 flex flex-col min-h-screen overflow-auto">
        {/* Topbar */}
        <header className="h-14 border-b border-border flex items-center px-6 bg-background sticky top-0 z-10">
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <PipelineStatus />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

async function PipelineStatus() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/health`, {
      next: { revalidate: 60 },
    })
    const data = await res.json()
    const healthy = data.status === 'healthy'
    return (
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${healthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <span>{healthy ? 'All systems operational' : 'Degraded'}</span>
      </div>
    )
  } catch {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span>Health check failed</span>
      </div>
    )
  }
}
