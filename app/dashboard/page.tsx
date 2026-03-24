import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/db/client'
import { getDashboardMetrics, getRecentTasks, getSetupStatus } from '@/lib/db/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CategoryBadge } from '@/components/category-badge'
import { StatusPill } from '@/components/status-pill'
import { ListChecks, TrendingUp, Clock, Hash, ArrowRight, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Overview' }

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function DashboardPage() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [metrics, recentTasks, setup] = await Promise.all([
    getDashboardMetrics(user.id).catch(() => ({
      tasksToday: 0, approvalRate: 0, pendingCount: 0, totalTasks: 0,
    })),
    getRecentTasks(user.id).catch(() => []),
    getSetupStatus(user.id).catch(() => ({
      hasWorkspace: false, hasRoles: false, hasLinkedMembers: false, hasCategories: false,
    })),
  ])

  const isFullySetUp = setup.hasWorkspace && setup.hasRoles && setup.hasCategories && setup.hasLinkedMembers

  const steps = [
    { done: setup.hasWorkspace, label: 'Connect a Slack workspace', href: '/dashboard/workspaces' },
    { done: setup.hasCategories && setup.hasRoles, label: 'Create categories and roles', href: '/dashboard/settings' },
    { done: setup.hasLinkedMembers, label: 'Link team members via Telegram', href: undefined },
  ]

  const metricCards = [
    { label: 'Tasks Today', value: metrics.tasksToday, icon: ListChecks },
    { label: 'Approval Rate', value: `${metrics.approvalRate}%`, icon: TrendingUp },
    { label: 'Pending Review', value: metrics.pendingCount, icon: Clock },
    { label: 'Total Tasks', value: metrics.totalTasks, icon: Hash },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Your pipeline at a glance</p>
      </div>

      {/* Setup Checklist */}
      {!isFullySetUp && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-primary">Get Started with SlackFlow</CardTitle>
            <p className="text-sm text-muted-foreground">Complete these steps to start routing your Slack messages automatically.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`text-sm ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    Step {i + 1}: {step.label}
                  </span>
                  {!step.done && step.href && (
                    <Link href={step.href} className="text-xs text-primary hover:underline ml-auto">
                      Go &rarr;
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((m) => (
          <Card key={m.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{m.label}</span>
                <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                  <m.icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-bold tabular-nums">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Tasks */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-sm font-semibold">Recent Tasks</CardTitle>
          <Link href="/dashboard/tasks" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentTasks.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No tasks yet. Connect a Slack workspace and send a message to get started.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTasks.map((task: any) => (
                <div key={task.id} className="px-6 py-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 hover:bg-muted/30 transition-colors">
                  {/* Workspace badge */}
                  <span className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: task.workspaces?.accent_color || '#3B82F6' }}
                    />
                    {task.workspaces?.name || 'Unknown'}
                  </span>
                  {/* Channel */}
                  <span className="text-xs text-muted-foreground flex-shrink-0">#{task.channel}</span>
                  {/* Sender */}
                  <span className="text-xs text-muted-foreground flex-shrink-0">{task.sender_name || 'Unknown'}</span>
                  {/* Category */}
                  {task.category && (
                    <CategoryBadge
                      name={task.category}
                      emoji={task.category_emoji}
                      color={task.category_color}
                    />
                  )}
                  {/* Role */}
                  {task.roles?.name && (
                    <span className="text-xs font-medium flex-shrink-0">{task.roles.name}</span>
                  )}
                  {/* Status */}
                  <StatusPill status={task.status} />
                  {/* Time */}
                  <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                    {getRelativeTime(task.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
