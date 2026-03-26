import { cn } from '@/lib/utils'

interface SkeletonProps {
  variant?: 'card' | 'table-row' | 'text' | 'metric'
  className?: string
}

export function LoadingSkeleton({ variant = 'text', className }: SkeletonProps) {
  switch (variant) {
    case 'metric':
      return (
        <div className={cn('rounded-xl border bg-card p-6', className)}>
          <div className="h-4 w-24 animate-pulse rounded bg-muted/50" />
          <div className="mt-3 h-8 w-16 animate-pulse rounded bg-muted/50" />
          <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted/50" />
        </div>
      )
    case 'card':
      return (
        <div className={cn('rounded-xl border bg-card p-6 space-y-3', className)}>
          <div className="h-5 w-3/4 animate-pulse rounded bg-muted/50" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted/50" />
          <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
        </div>
      )
    case 'table-row':
      return (
        <div className={cn('flex items-center gap-4 py-3 px-4', className)}>
          <div className="h-4 w-20 animate-pulse rounded bg-muted/50" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted/50" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted/50" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted/50 flex-1" />
        </div>
      )
    default:
      return <div className={cn('h-4 w-full animate-pulse rounded bg-muted/50', className)} />
  }
}

export function SkeletonList({ count = 5, variant = 'table-row' }: { count?: number; variant?: SkeletonProps['variant'] }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton key={i} variant={variant} />
      ))}
    </div>
  )
}
