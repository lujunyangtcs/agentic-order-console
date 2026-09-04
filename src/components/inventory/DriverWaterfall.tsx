import type { DriverTerm } from '@/services'
import { cn } from '@/lib/utils'

/**
 * How the recommendation reaches its number.
 *
 * Six terms and a total is table-shaped, and §15.6 requires an accessible table
 * underneath regardless. What earns the drawing is that **the total is the
 * number under attack**: a planner looking at 12 on file and 28 recommended
 * asks where 28 came from, and a waterfall answers by showing the arithmetic
 * closing rather than by asserting a result.
 *
 * The colour carries the argument. Two of the six terms are quantities the
 * customer's current process cannot compute at all — shared-variant exposure
 * needs a view across configurations that no single product structure gives,
 * and lead-time variability needs the supplier's own words. Together they are
 * most of the gap between the number on file and the number recommended. That
 * is the pitch, stated as arithmetic rather than as a claim, and it is why
 * those two bars look different from the other four.
 */

export interface DriverWaterfallProps {
  drivers: DriverTerm[]
  total: number
  currentSafety: number | null
  onEvidence?: (ref: string) => void
}

const W = 100
const H = 150
const PAD_T = 12
const PAD_B = 30

const CALLOUT: Record<string, string> = {
  configurations: 'only visible across configurations',
  'supplier-evidence': 'only visible from supplier evidence',
}

export function DriverWaterfall({ drivers, total, currentSafety, onEvidence }: DriverWaterfallProps) {
  /* Running totals, so each bar starts where the previous one finished. */
  let running = 0
  const bars = drivers.map((t) => {
    const from = running
    running = Math.round((running + t.value) * 10) / 10
    return { ...t, from, to: running }
  })

  /* Nothing to draw, and nothing to divide by.
   *
   * On a cold load the query has not resolved, `drivers` is empty and `total`
   * is zero — so `peak` was zero, `1 - v / 0` was `-Infinity`, and the SVG got
   * `-Infinity` line coordinates and `NaN` rect geometry. Four console errors
   * on every first paint of this page.
   *
   * They went unseen for three phases because the route sweeps navigated by
   * pushState, and TanStack Query had the data cached from an earlier visit
   * every time — so `drivers` was never actually empty when measured. Only a
   * cold load reaches this branch. */
  if (!bars.length) return null
  const peak = Math.max(total, ...bars.map((b) => Math.max(b.from, b.to)), 1)
  const y = (v: number) => PAD_T + (1 - v / peak) * (H - PAD_T - PAD_B)
  const slot = W / (bars.length + 1)
  const barW = slot * 0.52

  /* The two terms nothing else in the customer's stack can produce. */
  const invisible = bars.filter((b) => b.onlyVisibleAcross)
  const invisibleSum = Math.round(invisible.reduce((n, b) => n + b.value, 0) * 10) / 10
  const gap = currentSafety === null ? null : Math.round((total - currentSafety) * 10) / 10

  return (
    <section data-card="drivers" className="border-structural-border bg-surface flex flex-col rounded-lg border">
      <header className="border-border flex flex-wrap items-baseline gap-x-3 border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">How the recommendation reaches {total}</h2>
        {gap !== null && (
          <span className="text-muted-foreground text-xs">
            {invisibleSum} of the {gap} above the current target comes from two things
            nothing in a planning screen shows today.
          </span>
        )}
      </header>

      <div className="px-5 pt-4">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 w-full" role="img">
          <title>{`Recommendation drivers reconciling to ${total}`}</title>

          {currentSafety !== null && (
            <line
              x1={0} y1={y(currentSafety)} x2={W} y2={y(currentSafety)}
              stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {bars.map((b, i) => {
            const x = slot * (i + 0.5) - barW / 2
            const top = y(Math.max(b.from, b.to))
            const h = Math.abs(y(b.from) - y(b.to))
            const fill = b.value < 0
              ? 'var(--verdict-pass)'
              : b.onlyVisibleAcross
                ? 'var(--tenant-accent)'
                : 'var(--accent)'
            return (
              <g key={b.label}>
                {/* The connector, so the eye follows the running total. */}
                {i > 0 && (
                  <line
                    x1={slot * (i - 0.5) + barW / 2} y1={y(b.from)}
                    x2={x} y2={y(b.from)}
                    stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke"
                  />
                )}
                <rect x={x} y={top} width={barW} height={Math.max(h, 1)} fill={fill} opacity={b.onlyVisibleAcross ? 1 : 0.75} />
              </g>
            )
          })}

          {/* The total, drawn from the floor so it reads as a result. */}
          <rect
            x={slot * (bars.length + 0.5) - barW / 2}
            y={y(total)}
            width={barW}
            height={H - PAD_B - y(total)}
            fill="var(--foreground)"
          />
        </svg>

        {/* Labels sit outside the SVG — preserveAspectRatio="none" stretches the
            viewBox horizontally and would distort any text inside it. */}
        <ol className="divide-border mt-3 divide-y">
          {bars.map((b) => (
            <li key={b.label} className="flex items-baseline gap-3 py-1.5">
              <span
                className={cn('mt-1 size-2 shrink-0 rounded-xs')}
                style={{
                  background: b.value < 0
                    ? 'var(--verdict-pass)'
                    : b.onlyVisibleAcross ? 'var(--tenant-accent)' : 'var(--accent)',
                  opacity: b.onlyVisibleAcross || b.value < 0 ? 1 : 0.75,
                }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs">{b.label}</span>
                {b.onlyVisibleAcross && (
                  <span className="text-tenant-accent-text block text-2xs">
                    {CALLOUT[b.onlyVisibleAcross]}
                  </span>
                )}
              </span>
              {b.evidenceRef && onEvidence && (
                <button
                  type="button"
                  onClick={() => onEvidence(b.evidenceRef!)}
                  className="text-accent-text hover:text-accent focus-visible:ring-ring shrink-0 rounded-xs text-2xs focus-visible:ring-2 focus-visible:outline-none"
                >
                  evidence
                </button>
              )}
              <span className="tabular w-14 shrink-0 text-right text-xs font-medium">
                {b.value > 0 ? '+' : ''}{b.value.toFixed(1)}
              </span>
            </li>
          ))}
          <li className="flex items-baseline gap-3 py-2">
            <span className="bg-foreground mt-1 size-2 shrink-0 rounded-xs" aria-hidden />
            <span className="flex-1 text-xs font-semibold">Recommended target</span>
            <span className="tabular w-14 shrink-0 text-right text-sm font-semibold">
              {total.toFixed(1)}
            </span>
          </li>
        </ol>
      </div>

      <p className="text-muted-foreground border-border mt-1 border-t px-5 py-3 text-2xs leading-relaxed">
        Every term links to what it was computed from. The dashed line is the
        target currently held in the system of record.
      </p>
    </section>
  )
}
