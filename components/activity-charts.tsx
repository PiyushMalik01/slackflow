'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
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

function formatActionLabel(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function ActivityCharts({ dailyData, actionData }: ActivityChartsProps) {
  const coloredActionData = actionData.map(d => ({
    ...d,
    color: ACTION_COLORS[d.name] || '#6B7280',
    label: formatActionLabel(d.name),
  }))

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
              <BarChart data={dailyData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Action type distribution */}
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
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={coloredActionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="label"
                >
                  {coloredActionData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
                      {value}
                    </span>
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
