import { Link } from 'react-router'
import { EyeOff } from 'lucide-react'
import { Panel } from './Panel'

export interface BlindSpot {
  label: string
  note: string
  ctaLabel: string
  ctaRoute: string
}

/**
 * Everything the account cannot answer, in one place.
 *
 * Before this, the same missing goods-receipt export was reported four times on
 * one screen: the readiness strip, two blank figures, and an observation. Saying
 * it once, with the consequences listed under it, is both shorter and clearer
 * than four polite reminders.
 */
export function BlindSpots({ spots }: { spots: BlindSpot[] }) {
  if (spots.length === 0) return null
  const cta = spots[0]

  return (
    <Panel
      tone="quiet"
      title="What we cannot tell you yet"
      subtitle="Left blank on purpose. We do not guess at numbers we have no source for."
    >
      {/* One tile per blind spot, on the surface tone, so two explanations do
          not run together into a paragraph. */}
      <ul className="grid gap-2 sm:grid-cols-2">
        {spots.map((s) => (
          <li
            key={s.label}
            className="border-border bg-surface lift flex gap-2.5 rounded-sm border px-3 py-2.5"
          >
            <span className="bg-muted text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm">
              <EyeOff className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <span className="text-foreground block text-sm font-medium">{s.label}</span>
              <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{s.note}</p>
            </div>
          </li>
        ))}
      </ul>
      <Link
        to={cta.ctaRoute}
        className="text-accent-text focus-visible:ring-ring mt-3 inline-block rounded-md text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        {cta.ctaLabel}
      </Link>
    </Panel>
  )
}
