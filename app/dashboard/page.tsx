import { getAuthUser, getServiceClient, getSelectedWorkspace } from '@/lib/db/client'
import { getDashboardMetrics, getRecentTasks, getCategories, listWorkspacesForUser } from '@/lib/db/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CategoryBadge } from '@/components/category-badge'
import { StatusPill } from '@/components/status-pill'
import { DashboardCharts } from '@/components/dashboard-charts'
import { ListChecks, TrendingUp, Clock, Hash, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Overview' }

function formatSender(sender: string | null): string {
  if (!sender) return 'Unknown'
  if (/^U[A-Z0-9]{8,}$/i.test(sender)) return 'Slack User'
  if (/^telegram:\d+$/i.test(sender)) return 'Team Member'
  if (/^\d{6,}$/.test(sender)) return 'Unknown'
  return sender
}

function formatChannel(channel: string): string {
  if (!channel) return 'unknown'
  if (/^C[A-Z0-9]{8,}$/i.test(channel)) return 'slack channel'
  return channel
}

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
  const user = await getAuthUser()
  const selectedWorkspace = await getSelectedWorkspace()

  const [metrics, recentTasks, categories, workspaces] = await Promise.all([
    getDashboardMetrics(user!.id, selectedWorkspace || undefined).catch(() => ({
      tasksToday: 0, approvalRate: 0, pendingCount: 0, totalTasks: 0,
    })),
    getRecentTasks(user!.id, selectedWorkspace || undefined).catch(() => []),
    getCategories(user!.id).catch(() => []),
    listWorkspacesForUser(user!.id).catch(() => []),
  ])

  // Build category lookup map for enriching tasks with emoji/color
  const categoryMap = new Map(categories.map((c: any) => [c.name.toLowerCase(), c]))

  // --- Chart data: category distribution and status distribution ---
  const categoryData: { name: string; count: number; color: string }[] = []
  const statusData: { name: string; count: number; color: string }[] = []

  const wsIds = selectedWorkspace ? [selectedWorkspace] : workspaces.map((w: any) => w.id)
  if (wsIds.length > 0) {
    const db = getServiceClient()

    // Fetch all tasks for aggregation
    const { data: allTasks } = await db
      .from('tasks')
      .select('category, status')
      .in('workspace_id', wsIds)

    if (allTasks && allTasks.length > 0) {
      // Category distribution
      const catCounts: Record<string, number> = {}
      const statusCounts: Record<string, number> = {}

      for (const t of allTasks) {
        const cat = t.category || 'Uncategorized'
        catCounts[cat] = (catCounts[cat] || 0) + 1
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1
      }

      for (const [name, count] of Object.entries(catCounts)) {
        const catMeta = categoryMap.get(name.toLowerCase())
        categoryData.push({
          name,
          count,
          color: catMeta?.color || '#6B7280',
        })
      }
      categoryData.sort((a, b) => b.count - a.count)

      const STATUS_COLORS: Record<string, string> = {
        pending: '#F59E0B',
        draft_ready: '#8B5CF6',
        approved: '#22C55E',
        sent: '#22C55E',
        edited: '#10B981',
        dismissed: '#6B7280',
        failed: '#EF4444',
      }

      for (const [name, count] of Object.entries(statusCounts)) {
        statusData.push({
          name,
          count,
          color: STATUS_COLORS[name] || '#6B7280',
        })
      }
      statusData.sort((a, b) => b.count - a.count)
    }
  }

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

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((m) => (
          <Card key={m.label} className="group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{m.label}</span>
                <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center group-hover:bg-primary/15 transition-colors duration-200">
                  <m.icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-bold tabular-nums">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {(categoryData.length > 0 || statusData.length > 0) && (
        <DashboardCharts categoryData={categoryData} statusData={statusData} />
      )}

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
              {recentTasks.map((task: any) => {
                const catMeta = task.category ? categoryMap.get(task.category.toLowerCase()) : null
                return (
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
                  <span className="text-xs text-muted-foreground flex-shrink-0">#{formatChannel(task.channel)}</span>
                  {/* Sender */}
                  <span className="text-xs text-muted-foreground flex-shrink-0">{formatSender(task.sender_name)}</span>
                  {/* Category */}
                  {task.category && (
                    <CategoryBadge
                      name={task.category}
                      emoji={catMeta?.emoji}
                      color={catMeta?.color}
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
                  {/* Manage link */}
                  <Link
                    href={`/dashboard/tasks?search=${encodeURIComponent(task.original_text?.substring(0, 40) || '')}`}
                    className="text-xs text-primary hover:underline flex-shrink-0"
                  >
                    Manage
                  </Link>
                </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
