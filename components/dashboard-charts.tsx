'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface DashboardChartsProps {
  categoryData: { name: string; count: number; color: string }[]
  statusData: { name: string; count: number; color: string }[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  draft_ready: '#8B5CF6',
  approved: '#22C55E',
  sent: '#22C55E',
  edited: '#10B981',
  dismissed: '#6B7280',
  failed: '#EF4444',
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function DashboardCharts({ categoryData, statusData }: DashboardChartsProps) {
  const coloredStatusData = statusData.map(d => ({
    ...d,
    label: formatStatusLabel(d.name),
    color: STATUS_COLORS[d.name] || d.color,
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Tasks by Category — horizontal bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tasks by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              No category data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 10 }}>
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  width={100}
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
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {categoryData.map((entry, index) => (
                    <Cell key={index} fill={entry.color || '#6366F1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tasks by Status — donut chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tasks by Status</CardTitle>
        </CardHeader>
        <CardContent>
          {coloredStatusData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              No status data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={coloredStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="label"
                >
                  {coloredStatusData.map((entry, index) => (
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
