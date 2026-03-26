import { cn } from '@/lib/utils'

interface CategoryBadgeProps {
  name: string
  emoji?: string
  color?: string
  className?: string
}

export function CategoryBadge({ name, emoji, color = '#6B7280', className }: CategoryBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
        className
      )}
      style={{
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      {emoji && <span>{emoji}</span>}
      {name}
    </span>
  )
}
