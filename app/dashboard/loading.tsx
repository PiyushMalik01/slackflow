import { LoadingSkeleton, SkeletonList } from '@/components/loading-skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted/50" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted/50" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <LoadingSkeleton variant="metric" />
        <LoadingSkeleton variant="metric" />
        <LoadingSkeleton variant="metric" />
        <LoadingSkeleton variant="metric" />
      </div>
      <LoadingSkeleton variant="card" />
      <SkeletonList count={5} variant="table-row" />
    </div>
  )
}
