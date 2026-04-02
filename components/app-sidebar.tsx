'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  CheckSquare,
  Building2,
  Users,
  Clock,
  Tags,
  FileText,
  Palette,
  Brain,
  LogOut,
  Menu,
  ChevronDown,
  Settings,
  User,
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
import { Badge } from '@/components/ui/badge'

const mainNav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/dashboard/workspaces', label: 'Workspaces', icon: Building2 },
  { href: '/dashboard/teams', label: 'Teams', icon: Users },
  { href: '/dashboard/activity', label: 'Activity', icon: Clock },
]

const settingsNav = [
  { href: '/dashboard/settings?tab=categories', label: 'Categories', icon: Tags },
  { href: '/dashboard/settings?tab=templates', label: 'Templates', icon: FileText },
  { href: '/dashboard/settings?tab=preferences', label: 'Workspace Settings', icon: Palette },
  { href: '/dashboard/settings?tab=ai', label: 'AI Configuration', icon: Brain },
]

function isNavActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href.includes('?')) return pathname.startsWith(href.split('?')[0])
  return pathname.startsWith(href)
}

function isSettingsActive(pathname: string) {
  return pathname.startsWith('/dashboard/settings')
}

function useUnlinkedMemberCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('roles')
        .select('id, status, telegram_chat_id')
        .eq('owner_id', user.id)
      const unlinked = data?.filter((r: { status: string; telegram_chat_id: string | null }) => r.status !== 'linked' || !r.telegram_chat_id) || []
      setCount(unlinked.length)
    }
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])
  return count
}

function usePendingTaskCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    function load() {
      fetch('/api/tasks/count')
        .then(r => r.json())
        .then(data => { if (typeof data.count === 'number') setCount(data.count) })
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])
  return count
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()
  const pendingCount = usePendingTaskCount()
  const unlinkedCount = useUnlinkedMemberCount()
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive(pathname))

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

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {mainNav.map((item) => {
          const active = isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-accent font-medium text-foreground border-l-2 border-primary pl-[10px]'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
              {item.label === 'Tasks' && pendingCount > 0 && (
                <Badge variant="default" className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px] font-semibold">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </Badge>
              )}
              {item.label === 'Teams' && unlinkedCount > 0 && (
                <span className="ml-auto flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                </span>
              )}
            </Link>
          )
        })}

        {/* Settings group */}
        <div className="pt-2 mt-2 border-t">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              isSettingsActive(pathname)
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            Settings
            <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
          </button>

          {settingsOpen && (
            <div className="ml-3 mt-0.5 space-y-0.5 border-l pl-3">
              {settingsNav.map((item) => {
                const tab = item.href.split('tab=')[1]
                const active = pathname.startsWith('/dashboard/settings') && (
                  typeof window !== 'undefined'
                    ? new URLSearchParams(window.location.search).get('tab') === tab
                    : false
                )
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                      active
                        ? 'bg-accent font-medium text-foreground border-l-2 border-primary pl-[8px]'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Profile + Sign out */}
      <div className="border-t p-3 space-y-0.5">
        <Link
          href="/dashboard/profile"
          onClick={onNavigate}
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
            pathname === '/dashboard/profile'
              ? 'bg-accent font-medium text-foreground border-l-2 border-primary pl-[10px]'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <User className="h-4 w-4" />
          Profile
        </Link>
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
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r bg-muted/30 md:flex md:flex-col">
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
