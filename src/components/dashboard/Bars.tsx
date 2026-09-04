import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export interface BarRow {
  key: string
  label: string
  /** Small qualifier after the label — "of 5 sent", "of 13 findings". */
  meta?: string
  count: number
  to?: string
}

/**
 * Ranked bars, sized against the largest row.
 *
 * Lengths rather than a pie: the question is always "which one first", and that
 * is a comparison humans do accurately with lengths and badly with angles.
 */
export function Bars({ rows, emptyCopy }: { rows: BarRow[]; emptyCopy: string }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">{emptyCopy}</p>
  }
  const max = Math.max(...rows.map((r) => r.count))

  /* Two columns once the panel is full-width.
   *
   * A bar's length is only readable against a track the eye can take in at
   * once. Across a 1150px panel the smallest count rendered as a sliver
   * indistinguishable from the next smallest, while the largest ran the whole
   * page — the comparison the chart exists to make became harder, not easier,
   * for having more room. Halving the track restores it. */
  return (
    <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-foreground truncate text-sm">{r.label}</span>
              <span className="text-muted-foreground tabular shrink-0 text-xs">
                <span className="text-foreground font-medium">{r.count}</span>
                {r.meta ? ` ${r.meta}` : ''}
              </span>
            </div>
            <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-150',
                  r.to ? 'bg-accent/70 group-hover:bg-accent' : 'bg-accent/70',
                )}
                style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }}
              />
            </div>
          </>
        )
        return (
          <li key={r.key}>
            {r.to ? (
              <Link
                to={r.to}
                className="group focus-visible:ring-ring block rounded-md focus-visible:ring-2 focus-visible:outline-none"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        )
      })}
    </ul>
  )
}
