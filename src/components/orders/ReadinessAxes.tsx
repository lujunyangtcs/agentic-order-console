import { Ban, GitCompareArrows } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Readiness, on two axes that do not add up.
 *
 * The failure this layout exists to prevent is specific and it is not a
 * rendering bug: somebody reads five numbers in a row, sums them, and gets more
 * lines than the order has. That happened in the the design notes's own first draft, where
 * `Covered · Below safety · Short · Part-resolution · Data issue` were listed
 * as one "mutually exclusive" set — and they are not, because rejecting an
 * incompatible substitute leaves a line that is both short *and* under review.
 *
 * A component cannot fix that. A layout can. Coverage sits on top as three
 * segments of one bar that visibly fills the whole width. Qualifiers sit
 * underneath as chips, each carrying its own glyph, separated from the bar and
 * never summed into it. The caption states the rule the layout implies.
 */

export interface ReadinessAxesProps {
  analysedLines: number
  coverage: { covered: number; belowSafetyAfterBuild: number; short: number }
  qualifiers: { partResolutionReview: number; blocked: number }
  onSelect?: (key: string) => void
  active?: string | null
}

const SEGMENTS = [
  { key: 'covered', label: 'Covered', fill: 'bg-verdict-pass', text: 'text-verdict-pass' },
  { key: 'below', label: 'Below policy after build', fill: 'bg-sev-high', text: 'text-sev-high-on-bg' },
  { key: 'short', label: 'Short', fill: 'bg-sev-critical', text: 'text-sev-critical-on-bg' },
] as const

export function ReadinessAxes({
  analysedLines, coverage, qualifiers, onSelect, active,
}: ReadinessAxesProps) {
  const values: Record<string, number> = {
    covered: coverage.covered,
    below: coverage.belowSafetyAfterBuild,
    short: coverage.short,
  }
  const sum = coverage.covered + coverage.belowSafetyAfterBuild + coverage.short

  const chips = [
    { key: 'part_resolution_review', label: 'Part resolution', count: qualifiers.partResolutionReview },
    { key: 'blocked', label: 'Blocked', count: qualifiers.blocked },
  ].filter((c) => c.count > 0)

  return (
    <section
      data-card="readiness"
      className="border-structural-border bg-surface flex flex-col gap-4 rounded-lg border p-5"
    >
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold">Material readiness</h2>
        <span className="text-muted-foreground tabular text-xs">
          {analysedLines.toLocaleString()} component lines analysed
        </span>
      </header>

      {/* Axis 1. One bar, three segments, full width — the sum is the picture. */}
      <div>
        <p className="text-muted-foreground eyebrow mb-2">Coverage · exclusive</p>
        <div className="border-border flex h-7 w-full overflow-hidden rounded-xs border">
          {SEGMENTS.map((seg) => {
            const v = values[seg.key]
            if (!v) return null
            return (
              <button
                key={seg.key}
                type="button"
                onClick={() => onSelect?.(seg.key)}
                aria-pressed={active === seg.key}
                title={`${seg.label}: ${v}`}
                style={{ width: `${(v / sum) * 100}%` }}
                className={cn(
                  'focus-visible:ring-ring relative min-w-[3px] transition-opacity focus-visible:ring-2 focus-visible:outline-none',
                  seg.fill,
                  active && active !== seg.key && 'opacity-40',
                )}
              >
                <span className="sr-only">{`${seg.label}: ${v} of ${analysedLines}`}</span>
              </button>
            )
          })}
        </div>

        <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1.5">
          {SEGMENTS.map((seg) => (
            <div key={seg.key} className="flex items-baseline gap-1.5">
              <span className={cn('size-2 shrink-0 rounded-xs', seg.fill)} aria-hidden />
              <dt className="text-muted-foreground text-xs">{seg.label}</dt>
              <dd className={cn('tabular text-sm font-semibold', seg.text)}>{values[seg.key]}</dd>
            </div>
          ))}
          <div className="text-muted-foreground ml-auto flex items-baseline gap-1.5 text-xs">
            <span>sums to</span>
            <span className="tabular text-foreground font-semibold">{sum.toLocaleString()}</span>
          </div>
        </dl>
      </div>

      {/* Axis 2, drawn under the bar with leaders pointing back into it. */}
      {chips.length > 0 && (
        <div>
          <p className="text-muted-foreground eyebrow mb-2">Qualifiers · overlay</p>
          <div className="flex flex-wrap items-start gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onSelect?.(c.key)}
                aria-pressed={active === c.key}
                className={cn(
                  'border-structural-border hover:bg-hover-tint focus-visible:ring-ring relative flex items-center gap-2',
                  'rounded-md border px-2.5 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none',
                  active === c.key && 'bg-hover-tint',
                )}
              >
                {/* An icon for the qualifier, where the leader line used to be.
                    The leaders pointed up into the bar to argue that these
                    lines are already counted above — but the caption below says
                    that in words, and two stray arrows floating over a row of
                    chips read as a rendering fault before they read as an
                    argument. The space they held is better spent saying which
                    qualifier this is. */}
                <QualifierIcon k={c.key} />
                <span>{c.label}</span>
                <span className="tabular font-semibold">{c.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-muted-foreground border-border border-t pt-3 text-xs">
        Qualifiers overlay coverage. A line can be short <em>and</em> under part
        resolution, so the two axes are never added together.
      </p>
    </section>
  )
}

/** Two qualifiers, two glyphs. Both read at 14px, which is the size available. */
function QualifierIcon({ k }: { k: string }) {
  if (k === 'blocked') {
    return <Ban className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
  }
  return <GitCompareArrows className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
}
