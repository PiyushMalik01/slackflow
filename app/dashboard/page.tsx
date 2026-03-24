import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/db/client'
import { getDashboardMetrics, listWorkspacesForUser, listRolesForUser } from '@/lib/db/queries'
import { getServiceClient } from '@/lib/db/client'
import { TrendingUp, Building2, ListChecks, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Overview' }

const statusColor: Record<string, string> = {
  sent: 'bg-green-500/10 text-green-600 dark:text-green-400',
  approved: 'bg-green-500/10 text-green-600 dark:text-green-400',
  draft_ready: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  dismissed: 'bg-muted text-muted-foreground',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  edited: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

const categoryColor: Record<string, string> = {
  BUG: 'bg-red-500/10 text-red-600 dark:text-red-400',
  FEATURE: 'bg-primary/10 text-primary',
  GENERAL: 'bg-muted text-muted-foreground',
}

export default async function DashboardPage() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const metrics = await getDashboardMetrics(user.id).catch(() => ({
    tasksToday: 0, approvalRate: 0, activeWorkspaces: 0, pendingTasks: 0,
  }))

  const workspaces = await listWorkspacesForUser(user.id).catch(() => [])
  const workspaceIds = workspaces.map((w) => w.id)
  const roles = await listRolesForUser(user.id).catch(() => [])
  
  // Check if setup complete
  const hasWorkspace = workspaces.length > 0
  const hasRole = roles.length > 0
  const isSetupComplete = hasWorkspace && hasRole

  const db = getServiceClient()

  // Recent tasks (Isolated to user's workspaces)
  const { data: tasks } = workspaceIds.length > 0
    ? await db
        .from('tasks')
        .select(`
          id, original_text, channel, category, status, created_at,
          workspace:workspaces!workspace_id (id, name),
          role:roles!role_id (id, name, type)
        `)
        .in('workspace_id', workspaceIds)
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Your pipeline at a glance</p>
      </div>

      {!isSetupComplete && (
        <div className="bg-primary/5 border border-primary/20 p-6 rounded-xl">
          <h2 className="text-lg font-semibold text-primary mb-2">Welcome to SlackFlow! Let's get you set up.</h2>
          <p className="text-sm text-muted-foreground mb-6">Complete these steps to start routing your Slack messages automatically.</p>
          
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border p-4 rounded-lg relative">
              <div className="absolute top-4 right-4 text-xs font-bold text-muted-foreground">Step 1</div>
              <h3 className="font-medium text-sm mb-1 text-foreground">Get Telegram ID</h3>
              <p className="text-xs text-muted-foreground mb-3">Open Telegram and send <code className="bg-muted px-1 rounded">/start</code> to <strong>@userinfobot</strong> to get your numerical chat ID.</p>
              <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Open @userinfobot →</a>
            </div>

            <div className={`bg-card border border-border p-4 rounded-lg relative ${hasRole ? 'opacity-50 grayscale' : ''}`}>
              <div className="absolute top-4 right-4 text-xs font-bold text-muted-foreground">Step 2</div>
              <h3 className="font-medium text-sm mb-1 text-foreground flex items-center gap-2">
                Create a Role {hasRole && '✅'}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Define roles (e.g., Builder, Support) and attach Telegram Chat IDs so the system knows where to send alerts.</p>
              <Link href="/dashboard/settings" className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-md hover:bg-primary/90 transition-colors inline-block">
                Go to Settings
              </Link>
            </div>

            <div className={`bg-card border border-border p-4 rounded-lg relative ${hasWorkspace ? 'opacity-50 grayscale' : ''}`}>
              <div className="absolute top-4 right-4 text-xs font-bold text-muted-foreground">Step 3</div>
              <h3 className="font-medium text-sm mb-1 text-foreground flex items-center gap-2">
                Connect Slack {hasWorkspace && '✅'}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Install the app. <strong>Crucial final step:</strong> Go to your Slack workspace and type <code className="bg-foreground/10 px-1 rounded">/invite @YourBotName</code> in any channels you want SlackFlow to monitor!
              </p>
              <a href="/api/slack/install" className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-md hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.528 2.528 0 0 1 2.523-2.523 2.528 2.528 0 0 1 2.523 2.523v6.313a2.528 2.528 0 0 1-2.523 2.522 2.528 2.528 0 0 1-2.523-2.522v-6.313zM8.835 5.042a2.528 2.528 0 0 1-2.523-2.52A2.528 2.528 0 0 1 8.835 0a2.527 2.527 0 0 1 2.52 2.522v2.52h-2.52zm0 1.271a2.528 2.528 0 0 1 2.523 2.523 2.528 2.528 0 0 1-2.523 2.523h-6.313A2.528 2.528 0 0 1 0 8.835a2.528 2.528 0 0 1 2.522-2.523h6.313zm10.122 2.522a2.528 2.528 0 0 1 2.52-2.523A2.528 2.528 0 0 1 24 8.835a2.527 2.527 0 0 1-2.522 2.52h-2.52v-2.52zm-1.271 0a2.528 2.528 0 0 1-2.523 2.523 2.528 2.528 0 0 1-2.523-2.523V2.522A2.528 2.528 0 0 1 17.686 0a2.528 2.528 0 0 1 2.523 2.522v6.313zM15.165 18.958a2.528 2.528 0 0 1 2.523 2.52 2.528 2.528 0 0 1-2.523 2.522 2.527 2.527 0 0 1-2.52-2.522v-2.52h2.52zm0-1.271a2.528 2.528 0 0 1-2.523-2.523 2.528 2.528 0 0 1 2.523-2.523h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>
                Connect Slack
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tasks today', value: metrics.tasksToday, icon: ListChecks },
          { label: 'Approval rate', value: `${metrics.approvalRate}%`, icon: TrendingUp },
          { label: 'Active workspaces', value: metrics.activeWorkspaces, icon: Building2 },
          { label: 'Pending review', value: metrics.pendingTasks, icon: Clock },
        ].map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{m.label}</span>
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                <m.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold tabular-nums">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Recent tasks */}
      <div className="bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">Recent tasks</h2>
          <Link href="/dashboard/tasks" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {!tasks || tasks.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No tasks yet. Connect a Slack workspace and send a message to get started.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tasks.map((task: any) => (
              <div key={task.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{task.original_text}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <span className="font-medium text-foreground">{task.workspace?.name || 'Unknown'}</span>
                    <span>#{task.channel}</span>
                    <span>· {new Date(task.created_at).toLocaleString()}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    {task.category && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColor[task.category] ?? ''}`}>
                        {task.category}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[task.status] ?? ''}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                  {task.role && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      {task.role.name} ({task.role.type})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
