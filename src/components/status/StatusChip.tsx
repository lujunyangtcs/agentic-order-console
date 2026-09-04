import type { OrderStatus, Priority } from '@/types/domain'
import { priorityKey, statusKey, useT } from '@/i18n'
import { cn } from '@/lib/utils'

/** Seven colour bands for eleven statuses. Colour always pairs with a label. */
export const STATUS_BAND: Record<OrderStatus, 'open' | 'pending' | 'scheduled' | 'loading' | 'transit' | 'site' | 'done'> = {
  order_created: 'open',
  pending_carrier: 'pending',
  order_scheduled: 'scheduled',
  transit_to_terminal: 'loading',
  starting_load: 'loading',
  load_completed: 'loading',
  in_transit: 'transit',
  on_site: 'site',
  unloading: 'site',
  unload_completed: 'site',
  delivery_completed: 'done',
}

const BAND_CLASS: Record<(typeof STATUS_BAND)[OrderStatus], { chip: string; dot: string }> = {
  open: { chip: 'bg-status-open-bg text-status-open', dot: 'bg-status-open' },
  pending: { chip: 'bg-status-pending-bg text-sev-high-on-bg', dot: 'bg-status-pending' },
  scheduled: { chip: 'bg-status-scheduled-bg text-accent-text', dot: 'bg-status-scheduled' },
  loading: { chip: 'bg-status-loading-bg text-status-loading', dot: 'bg-status-loading' },
  transit: { chip: 'bg-status-transit-bg text-status-transit', dot: 'bg-status-transit' },
  site: { chip: 'bg-status-site-bg text-status-site', dot: 'bg-status-site' },
  done: { chip: 'bg-status-done-bg text-status-done', dot: 'bg-status-done' },
}

export function statusClasses(status: OrderStatus) {
  return BAND_CLASS[STATUS_BAND[status]]
}

export function StatusChip({ status, className, rejected }: { status: OrderStatus; className?: string; rejected?: boolean }) {
  const t = useT()
  const c = statusClasses(status)
  return (
    <span
      data-status={status}
      className={cn('inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-2xs font-medium whitespace-nowrap', rejected ? 'bg-sev-critical-bg text-sev-critical-on-bg' : c.chip, className)}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', rejected ? 'bg-sev-critical' : c.dot)} aria-hidden />
      {rejected ? t('status.rejected') : t(statusKey(status))}
    </span>
  )
}

const PRIORITY_CLASS: Record<Priority, string> = {
  standard: 'border-border text-muted-foreground',
  priority: 'border-sev-high/40 bg-sev-high-bg text-sev-high-on-bg',
  urgent: 'border-sev-critical/40 bg-sev-critical-bg text-sev-critical-on-bg',
}

export function PriorityChip({ priority, className }: { priority: Priority; className?: string }) {
  const t = useT()
  return (
    <span data-priority={priority} className={cn('inline-flex rounded-xs border px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap', PRIORITY_CLASS[priority], className)}>
      {t(priorityKey(priority))}
    </span>
  )
}
