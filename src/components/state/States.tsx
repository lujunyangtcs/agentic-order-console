import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/** Every empty state says why it is empty and what to do next. No illustrations. */
export function EmptyState({
  title, description, action,
}: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="border-border bg-surface flex flex-col items-center rounded-lg border border-dashed px-6 py-14 text-center">
      <Inbox className="text-muted-foreground size-5" aria-hidden />
      <p className="text-foreground mt-3 text-base font-medium">{title}</p>
      {description && <p className="text-muted-foreground mt-1.5 max-w-md text-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-px" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-[44px] w-full rounded-none" />
      ))}
    </div>
  )
}

export function InlineSpinner({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {label}
    </span>
  )
}

export function ErrorState({
  title = 'Something went wrong', detail, onRetry,
}: { title?: string; detail?: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 rounded-lg border px-5 py-5"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-foreground text-sm font-medium">{title}</p>
          {detail && <p className="text-muted-foreground mt-1 font-mono text-xs break-words">{detail}</p>}
          {onRetry && (
            <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
