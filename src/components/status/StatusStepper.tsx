import { Check } from 'lucide-react'
import { ORDER_STATUSES, statusIndex, type OrderStatus } from '@/types/domain'
import { statusKey, useT } from '@/i18n'
import { formatTime } from '@/fixtures/calendar'
import { cn } from '@/lib/utils'

/**
 * The eleven statuses as one rail of small circles on an equal grid.
 *
 * Done is a green circle with a check, the current one is the accent with a
 * slow breathing ring, the ones ahead are grey outlines. Every cell is the
 * same width, so the gaps are identical whatever the label says; connectors
 * run from circle centre to circle centre and turn green as they are passed.
 * When the viewer owns the next step (a carrier on its own load, the yard on
 * a truck at the scale) that step is a button — the rail is the control, not
 * a picture of one.
 */
export interface StepperProps {
  current: OrderStatus
  /** ISO timestamps per reached status, for the caption under each circle. */
  reachedAt?: Partial<Record<OrderStatus, string>>
  /** Which statuses the viewer may record next; those steps become buttons. */
  actionable?: OrderStatus[]
  onAdvance?: (next: OrderStatus) => void
  busy?: boolean
  /** A rejected request shows the current circle in the attention tone. */
  rejected?: boolean
  className?: string
}

const N = ORDER_STATUSES.length
const R = 14 // circle radius in px, for the connector inset

export function StatusStepper({ current, reachedAt, actionable = [], onAdvance, busy, rejected, className }: StepperProps) {
  const t = useT()
  const cur = statusIndex(current)

  return (
    <div data-stepper className={cn('-mx-1 overflow-x-auto px-1 pt-4 pb-1 [contain:inline-size]', className)}>
      <ol className="grid" style={{ gridTemplateColumns: `repeat(${N}, minmax(76px, 1fr))` }}>
        {ORDER_STATUSES.map((s, i) => {
          const idx = statusIndex(s)
          const done = idx < cur
          const active = idx === cur
          const canAct = actionable.includes(s) && !!onAdvance
          const at = (done || active) ? reachedAt?.[s] : undefined
          const circle = (
            <span className="relative flex size-7 items-center justify-center">
              {active && (
                <span
                  aria-hidden
                  className={cn('absolute inset-0 rounded-full', rejected ? 'bg-sev-critical' : 'bg-accent')}
                  style={{ animation: 'step-pulse 2s ease-out infinite' }}
                />
              )}
              <span
                className={cn(
                  'relative flex size-7 items-center justify-center rounded-full border-2 transition-colors duration-200',
                  done && 'border-status-done bg-status-done text-primary-foreground',
                  active && !rejected && 'border-accent bg-accent text-accent-foreground',
                  active && rejected && 'border-sev-critical bg-sev-critical text-primary-foreground',
                  !done && !active && !canAct && 'border-border bg-surface text-muted-foreground',
                  canAct && 'border-accent bg-surface border-dashed text-accent-text',
                )}
                aria-hidden
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : active ? <span className="size-2.5 rounded-full bg-current" /> : canAct ? <span className="text-[12px] leading-none font-semibold">→</span> : null}
              </span>
            </span>
          )
          const caption = (
            <>
              <span className={cn('mt-2 block text-center text-2xs leading-tight', active ? 'text-foreground font-semibold' : done ? 'text-foreground font-medium' : canAct ? 'text-accent-text font-medium' : 'text-muted-foreground')}>
                {t(statusKey(s))}
              </span>
              <span className={cn('tabular block min-h-3.5 text-center text-2xs', active ? 'text-accent-text' : 'text-muted-foreground')}>
                {at ? formatTime(at) : ''}
              </span>
            </>
          )
          return (
            <li key={s} className="relative flex min-w-0 flex-col items-center px-1" data-step={s} data-step-state={done ? 'done' : active ? 'active' : 'pending'}>
              {i < N - 1 && (
                <span
                  aria-hidden
                  className={cn('absolute top-[13px] h-0.5 rounded-full', idx < cur ? 'bg-status-done' : 'bg-border')}
                  style={{ left: `calc(50% + ${R + 4}px)`, right: `calc(-50% + ${R + 4}px)` }}
                />
              )}
              {canAct ? (
                <button type="button" disabled={busy} onClick={() => onAdvance?.(s)} className="flex w-full flex-col items-center rounded-md py-0.5 transition-colors hover:bg-status-scheduled-bg focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none" data-advance={s}>
                  {circle}
                  {caption}
                </button>
              ) : (
                <div className="flex w-full flex-col items-center py-0.5">
                  {circle}
                  {caption}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
