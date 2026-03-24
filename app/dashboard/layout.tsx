import { AppSidebar } from '@/components/app-sidebar'
import Link from 'next/link'

// Auth guard is handled by proxy.ts — no need to duplicate it here.
// Server Components cannot write cookies, so calling getUser() here to redirect
// causes a loop when the token needs refreshing.

export const dynamic = 'force-dynamic'

const mobileNavItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/workspaces', label: 'Workspaces' },
  { href: '/dashboard/tasks', label: 'Tasks' },
  { href: '/dashboard/activity', label: 'Activity' },
  { href: '/dashboard/settings', label: 'Settings' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen md:h-screen">
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <div className="flex-1 flex flex-col min-h-screen md:pl-60 overflow-auto">
        {/* Topbar */}
        <header className="h-14 border-b border-border flex items-center px-4 md:px-6 bg-background sticky top-0 z-10">
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <PipelineStatus />
          </div>
        </header>
        <nav className="md:hidden border-b border-border bg-background px-4 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            {mobileNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 text-xs rounded-md border border-border bg-card whitespace-nowrap hover:bg-muted transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

async function PipelineStatus() {
  let healthy: boolean | null = null

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/health`, {
      next: { revalidate: 60 },
    })
    const data = await res.json()
    healthy = data.status === 'healthy'
  } catch {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span>Health check failed</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${healthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
      <span>{healthy ? 'All systems operational' : 'Degraded'}</span>
    </div>
  )
}
