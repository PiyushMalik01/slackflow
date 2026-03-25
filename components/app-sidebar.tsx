'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  CheckSquare,
  Building2,
  Users,
  Clock,
  Settings,
  LogOut,
  Menu,
  HelpCircle,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/db/browser-client'
import { BRAND_LOGO_SIZES, PlatformLogo } from '@/components/platform-logo'
import { WorkspaceSwitcher } from '@/components/workspace-switcher'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/dashboard/workspaces', label: 'Workspaces', icon: Building2 },
  { href: '/dashboard/teams', label: 'Teams', icon: Users },
  { href: '/dashboard/activity', label: 'Activity', icon: Clock },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

function isNavActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <PlatformLogo imageSize={BRAND_LOGO_SIZES.sidebar} textClassName="text-sm" />
      </div>

      {/* Workspace switcher */}
      <div className="border-b px-3 py-3">
        <WorkspaceSwitcher className="text-xs" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active = isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Theme toggle + Setup Guide + Sign out */}
      <div className="border-t p-3 space-y-0.5">
        <ThemeToggle className="flex w-full items-center justify-start gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" />
        <button
          onClick={() => {
            localStorage.removeItem('slackflow_onboarding_complete')
            window.location.href = '/dashboard'
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Setup Guide
        </button>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}

export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r bg-background md:flex md:flex-col">
      <SidebarContent />
    </aside>
  )
}

export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open sidebar</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
