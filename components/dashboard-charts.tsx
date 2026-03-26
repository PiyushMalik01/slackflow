'use client'

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Label,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface DashboardChartsProps {
  categoryData: { name: string; count: number; color: string }[]
  statusData: { name: string; count: number; color: string }[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  draft_ready: '#3B82F6',
  approved: '#22C55E',
  edited: '#10B981',
  dismissed: '#6B7280',
  sent: '#8B5CF6',
  failed: '#EF4444',
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/* -- Custom Tooltips -- */

function CategoryTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, count, color } = payload[0].payload
  const total = payload[0].payload._total as number
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0'
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color || '#6366F1' }} />
        {name}
      </p>
      <p className="text-muted-foreground">{count} task{count !== 1 ? 's' : ''} ({pct}%)</p>
    </div>
  )
}

function StatusTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { label, count, color, _total } = payload[0].payload
  const pct = _total > 0 ? ((count / _total) * 100).toFixed(1) : '0'
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="text-muted-foreground">{count} task{count !== 1 ? 's' : ''} ({pct}%)</p>
    </div>
  )
}

export function DashboardCharts({ categoryData, statusData }: DashboardChartsProps) {
  const { resolvedTheme } = useTheme()
  const textColor = resolvedTheme === 'dark' ? '#A1A1AA' : '#71717A'
  const foregroundColor = resolvedTheme === 'dark' ? '#FAFAFA' : '#09090B'
  const gridColor = resolvedTheme === 'dark' ? '#27272A' : '#F4F4F5'
  const categoryTotal = useMemo(() => categoryData.reduce((s, d) => s + d.count, 0), [categoryData])
  const enrichedCategoryData = useMemo(
    () => categoryData.map(d => ({ ...d, _total: categoryTotal })),
    [categoryData, categoryTotal],
  )

  const statusTotal = useMemo(() => statusData.reduce((s, d) => s + d.count, 0), [statusData])
  const coloredStatusData = useMemo(
    () =>
      statusData.map(d => ({
        ...d,
        label: formatStatusLabel(d.name),
        color: STATUS_COLORS[d.name] || d.color,
        _total: statusTotal,
      })),
    [statusData, statusTotal],
  )

  const barHeight = Math.max(220, categoryData.length * 40)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Tasks by Category — horizontal bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tasks by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {enrichedCategoryData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              No category data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={barHeight}>
              <BarChart
                data={enrichedCategoryData}
                layout="vertical"
                margin={{ left: 10, right: 16, top: 4, bottom: 4 }}
              >
                <defs>
                  {enrichedCategoryData.map((entry, i) => (
                    <linearGradient key={i} id={`catGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={entry.color || '#6366F1'} stopOpacity={0.85} />
                      <stop offset="100%" stopColor={entry.color || '#6366F1'} stopOpacity={1} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: textColor }}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: foregroundColor }}
                  width={110}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CategoryTooltip />} cursor={{ fill: gridColor, radius: 4 }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} animationDuration={800} animationEasing="ease-out">
                  {enrichedCategoryData.map((_entry, index) => (
                    <Cell key={index} fill={`url(#catGrad-${index})`} />
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
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={coloredStatusData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="label"
                  animationDuration={800}
                  animationEasing="ease-out"
                  stroke="none"
                >
                  {coloredStatusData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                  <Label
                    value={statusTotal}
                    position="center"
                    className="text-2xl font-bold"
                    fill={foregroundColor}
                  />
                </Pie>
                <Tooltip content={<StatusTooltip />} />
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
