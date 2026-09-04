import { Fragment } from 'react'
import { Check } from 'lucide-react'
import { ORDER_STATUSES, statusIndex, type OrderStatus } from '@/types/domain'
import { statusKey, useT } from '@/i18n'
import { formatTime } from '@/fixtures/calendar'
import { cn } from '@/lib/utils'

/**
 * The eleven statuses as a two-row rail.
 *
 * Done chips are quiet, the current one is loud, the ones ahead are outlines.
 * When the viewer owns the next step (a carrier on its own load, the yard on
 * a truck at the scale), the next chip is a button — the rail is the control,
 * not a picture of one.
 */
export interface StepperProps {
  current: OrderStatus
  /** ISO timestamps per reached status, for the caption under each chip. */
  reachedAt?: Partial<Record<OrderStatus, string>>
  /** Which statuses the viewer may record next; those chips become buttons. */
  actionable?: OrderStatus[]
  onAdvance?: (next: OrderStatus) => void
  busy?: boolean
  /** A rejected request shows the first chip in the attention tone. */
  rejected?: boolean
  className?: string
}

const ROWS: OrderStatus[][] = [ORDER_STATUSES.slice(0, 6), ORDER_STATUSES.slice(6)]

export function StatusStepper({ current, reachedAt, actionable = [], onAdvance, busy, rejected, className }: StepperProps) {
  const t = useT()
  const cur = statusIndex(current)

  return (
    <div data-stepper className={cn('flex flex-col gap-2', className)}>
      {ROWS.map((row, ri) => (
        <ol key={ri} className="flex items-stretch gap-1">
          {row.map((s, i) => {
            const idx = statusIndex(s)
            const done = idx < cur
            const active = idx === cur
            const canAct = actionable.includes(s) && !!onAdvance
            const at = reachedAt?.[s]
            const inner = (
              <>
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'flex size-3.5 shrink-0 items-center justify-center rounded-full',
                      done && 'bg-status-done text-primary-foreground',
                      active && !rejected && 'bg-accent',
                      active && rejected && 'bg-sev-critical',
                      !done && !active && 'border-structural-border border',
                    )}
                    aria-hidden
                  >
                    {done && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span className={cn('truncate text-2xs', active ? 'font-semibold' : 'font-medium')}>{t(statusKey(s))}</span>
                </span>
                <span className={cn('block min-h-3.5 truncate pl-5 text-2xs', active ? 'text-accent-text' : 'text-muted-foreground')}>
                  {at ? formatTime(at) : canAct ? '→' : ''}
                </span>
              </>
            )
            const chipClass = cn(
              'flex min-w-0 flex-1 flex-col rounded-md border px-2 py-1.5 text-left transition-colors duration-150',
              done && 'border-border bg-muted/50 text-muted-foreground',
              active && !rejected && 'border-accent bg-status-scheduled-bg text-foreground',
              active && rejected && 'border-sev-critical bg-sev-critical-bg text-sev-critical-on-bg',
              !done && !active && 'border-border bg-surface text-muted-foreground',
              canAct && 'border-accent border-dashed text-foreground hover:bg-status-scheduled-bg focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
            )
            return (
              <Fragment key={s}>
                <li className="flex min-w-0 flex-1" data-step={s} data-step-state={done ? 'done' : active ? 'active' : 'pending'}>
                  {canAct ? (
                    <button type="button" disabled={busy} onClick={() => onAdvance?.(s)} className={chipClass} data-advance={s}>
                      {inner}
                    </button>
                  ) : (
                    <div className={chipClass}>{inner}</div>
                  )}
                </li>
                {i < row.length - 1 && (
                  <li aria-hidden className="flex items-center">
                    <span className={cn('h-0.5 w-2 rounded-full', idx < cur ? 'bg-status-done' : 'bg-border')} />
                  </li>
                )}
              </Fragment>
            )
          })}
        </ol>
      ))}
    </div>
  )
}
