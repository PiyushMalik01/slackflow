'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Label,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface ActivityChartsProps {
  dailyData: { date: string; count: number }[]
  actionData: { name: string; count: number; color: string }[]
}

const ACTION_COLORS: Record<string, string> = {
  task_created: '#3B82F6',
  draft_generated: '#8B5CF6',
  approved_and_sent: '#22C55E',
  task_approved: '#22C55E',
  edited_and_sent: '#10B981',
  dismissed: '#6B7280',
  task_dismissed: '#6B7280',
  draft_failed: '#EF4444',
  task_failed: '#EF4444',
  telegram_notified: '#0EA5E9',
  task_updated: '#F59E0B',
}

const ACTION_LABELS: Record<string, string> = {
  task_created: 'Task Created',
  draft_generated: 'Draft Generated',
  approved_and_sent: 'Approved & Sent',
  task_approved: 'Approved',
  edited_and_sent: 'Edited & Sent',
  dismissed: 'Dismissed',
  task_dismissed: 'Dismissed',
  draft_failed: 'Draft Failed',
  task_failed: 'Task Failed',
  telegram_notified: 'Telegram Notified',
  task_updated: 'Task Updated',
}

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/* ── Custom Tooltips ── */

function DailyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const count = payload[0].value
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{count} event{count !== 1 ? 's' : ''}</p>
    </div>
  )
}

function ActionTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { label, count, color, _total } = payload[0].payload
  const pct = _total > 0 ? ((count / _total) * 100).toFixed(1) : '0'
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="text-muted-foreground">{count} event{count !== 1 ? 's' : ''} ({pct}%)</p>
    </div>
  )
}

export function ActivityCharts({ dailyData, actionData }: ActivityChartsProps) {
  const actionTotal = useMemo(() => actionData.reduce((s, d) => s + d.count, 0), [actionData])

  const coloredActionData = useMemo(
    () =>
      actionData.map(d => ({
        ...d,
        color: ACTION_COLORS[d.name] || '#6B7280',
        label: formatActionLabel(d.name),
        _total: actionTotal,
      })),
    [actionData, actionTotal],
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Daily activity bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Activity (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              No activity data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="dailyBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={1} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<DailyTooltip />} cursor={{ fill: 'hsl(var(--muted))', radius: 4 }} />
                <Bar
                  dataKey="count"
                  fill="url(#dailyBarGrad)"
                  radius={[6, 6, 0, 0]}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Action type distribution — donut */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Events by Type</CardTitle>
        </CardHeader>
        <CardContent>
          {coloredActionData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              No event data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={coloredActionData}
                  cx="50%"
                  cy="42%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="label"
                  animationDuration={800}
                  animationEasing="ease-out"
                  stroke="none"
                >
                  {coloredActionData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                  <Label
                    value={actionTotal}
                    position="center"
                    className="text-2xl font-bold"
                    fill="hsl(var(--foreground))"
                  />
                </Pie>
                <Tooltip content={<ActionTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-[11px] text-muted-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
