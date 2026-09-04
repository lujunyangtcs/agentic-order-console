import { formatDate, daysBetween, TODAY } from '@/fixtures/calendar'

/**
 * The finding, drawn.
 *
 * Everything else in this flow is setup for one sentence: the supplier has
 * confirmed a longer lead time, so the replenishment for this component lands
 * *after* the order it was raised alongside has already shipped — and the
 * exposure is not to this order but to the ones promised in between.
 *
 * A table cannot say that. A table can say "projected zero 09 Sep" on one row
 * and "arrives 30 Sep" on another, and leave the reader to notice that the
 * second is three weeks after the first. This draws the gap between them and
 * labels it, which is the difference between reporting two dates and reporting
 * a finding.
 *
 * Two things it must not do. It must not read as an alarm about *this* order —
 * this order is covered, its units are already netted, and saying otherwise
 * would be the same overstatement the the design notes's first draft made when it claimed
 * an unrecoverable ship date. And it must not present the gap as unsolvable,
 * because three alternatives exist and ranking them is the product's job.
 */

export interface CoverageGapProps {
  partNumber: string
  projectedZero: string
  replenishmentArrives: string
  shipDate: string
  uncoveredDays: number
  alternatives: number
  onOpenAlternatives?: () => void
}

const H = 132
const PAD_L = 12
const PAD_R = 12

export function CoverageGap({
  partNumber, projectedZero, replenishmentArrives, shipDate, uncoveredDays,
  alternatives, onOpenAlternatives,
}: CoverageGapProps) {
  /* The strip runs from today to a little past the arrival, so the arrival has
   * somewhere to sit rather than pinning to the right edge. */
  const span = Math.max(daysBetween(TODAY, replenishmentArrives) + 6, 14)
  const at = (iso: string) => {
    const pct = daysBetween(TODAY, iso) / span
    return PAD_L + pct * (100 - PAD_L - PAD_R)
  }

  const xZero = at(projectedZero)
  const xShip = at(shipDate)
  const xArrive = at(replenishmentArrives)

  return (
    <section
      data-card="coverage-gap"
      className="border-structural-border bg-surface flex flex-col rounded-lg border"
    >
      <header className="border-border flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-5 py-3.5">
        <h3 className="text-sm font-semibold">Coverage gap</h3>
        <span className="text-muted-foreground font-mono text-xs">{partNumber}</span>
        <span className="text-sev-high-on-bg bg-sev-high-bg ml-auto rounded-xs px-2 py-0.5 text-2xs font-medium">
          {uncoveredDays} days uncovered
        </span>
      </header>

      <div className="px-5 pt-5 pb-2">
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="h-32 w-full" role="img">
          <title>{`Position falls to zero on ${formatDate(projectedZero)}; replenishment arrives ${formatDate(replenishmentArrives)}`}</title>

          {/* The hatch. Everything between running out and being restocked. */}
          <defs>
            <pattern id="gap-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--sev-high)" strokeWidth="1.1" opacity="0.5" />
            </pattern>
          </defs>
          <rect x={xZero} y={16} width={Math.max(0, xArrive - xZero)} height={H - 52} fill="url(#gap-hatch)" />

          {/* The covered run, drawn as the position walking down to zero. */}
          <path
            d={`M ${PAD_L} 24 L ${xZero} ${H - 36}`}
            stroke="var(--accent)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke"
          />
          {/* After zero there is nothing to draw, and drawing nothing is the point. */}
          <line
            x1={xZero} y1={H - 36} x2={xArrive} y2={H - 36}
            stroke="var(--sev-critical)" strokeWidth="2" strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          {/* Restocked. */}
          <path
            d={`M ${xArrive} ${H - 36} L ${xArrive} 30`}
            stroke="var(--accent)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke"
          />

          {/* The floor. */}
          <line x1={PAD_L} y1={H - 36} x2={100 - PAD_R} y2={H - 36}
                stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />

          {[
            { x: xZero, tone: 'var(--sev-critical)' },
            { x: xShip, tone: 'var(--tenant-accent)' },
            { x: xArrive, tone: 'var(--accent)' },
          ].map((m, i) => (
            <line key={i} x1={m.x} y1={12} x2={m.x} y2={H - 30}
                  stroke={m.tone} strokeWidth="1" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        {/* Labels live outside the SVG: preserveAspectRatio="none" stretches the
            viewBox horizontally, which would distort any text inside it. */}
        <div className="relative mt-1 h-9 text-2xs">
          {[
            { x: xZero, label: 'Position reaches zero', date: projectedZero, tone: 'text-sev-critical-on-bg' },
            { x: xShip, label: 'This order ships', date: shipDate, tone: 'text-tenant-accent-text' },
            { x: xArrive, label: 'Replenishment arrives', date: replenishmentArrives, tone: 'text-accent-text' },
          ].map((m) => (
            <div
              key={m.label}
              className="absolute -translate-x-1/2 text-center leading-tight"
              style={{ left: `${m.x}%`, maxWidth: 110 }}
            >
              <div className={`font-medium ${m.tone}`}>{m.label}</div>
              <div className="text-muted-foreground tabular">{formatDate(m.date)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* The sentence the picture is making, said in words as well. Neither one
          is decoration for the other; a reviewer who reads and a reviewer who
          scans should reach the same place. */}
      <div className="border-border bg-muted/40 border-t px-5 py-3.5">
        <p className="text-sm leading-relaxed">
          <b>This order is protected.</b> Its units are already netted, and it ships
          on {formatDate(shipDate)} — before the position runs down. The exposure is
          to orders promised after {formatDate(projectedZero)}.
        </p>
        {onOpenAlternatives && (
          <button
            type="button"
            onClick={onOpenAlternatives}
            className="text-accent-text hover:text-accent focus-visible:ring-ring mt-2 rounded-md text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            {alternatives} alternatives available →
          </button>
        )}
      </div>
    </section>
  )
}
