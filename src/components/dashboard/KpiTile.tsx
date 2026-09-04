import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type KpiTone = 'good' | 'warning' | 'neutral'

export interface KpiTileProps {
  label: string
  /** Percentages pass 0–1 and set unit='%'. Counts and currency pass the number
   *  itself; currency sets unit='$'. */
  value: number
  unit?: '%' | '$'
  footnote: string
  icon: LucideIcon
  tone?: KpiTone
}

const TONE = {
  good: { bar: 'bg-verdict-pass', chip: 'bg-verdict-pass-bg text-verdict-pass' },
  warning: { bar: 'bg-sev-high', chip: 'bg-sev-high-bg text-sev-high' },
  neutral: { bar: 'bg-accent', chip: 'bg-muted text-muted-foreground' },
} as const

/**
 * One figure, its scale, and what it was counted from.
 *
 * The bar only appears for rates, because a bar under a raw count implies a
 * ceiling the number does not have. The footnote always names the numerator
 * and denominator, so the percentage above it can be checked rather than
 * trusted.
 */
export function KpiTile({ label, value, unit, footnote, icon: Icon, tone = 'neutral' }: KpiTileProps) {
  const isRate = unit === '%'
  /* A six-figure number with no symbol is not a number anyone can read. The
   * summary band above these tiles renders the same figure as `$14,630`, so a
   * bare `14,630` here put one value on one screen in two notations — and
   * `2,099,808` beside it could as easily have been a part count. */
  const isMoney = unit === '$'
  const shown = isRate ? Math.round(value * 100) : value
  const t = TONE[tone]

  return (
    <div className="border-border bg-surface flex flex-col rounded-lg border p-3.5 lift">
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground eyebrow">
          {label}
        </span>
        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-sm', t.chip)}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>

      <div className="mt-2.5 flex items-baseline gap-0.5">
        {isMoney && (
          <span className="text-muted-foreground text-base leading-none font-medium">$</span>
        )}
        <span className="text-foreground figure tabular text-2xl leading-none font-medium">
          {shown.toLocaleString()}
        </span>
        {isRate && <span className="text-muted-foreground text-sm font-medium">%</span>}
      </div>

      {isRate && (
        <div className="bg-muted mt-2.5 h-1.5 w-full overflow-hidden rounded-xs">
          <div
            className={cn('h-full rounded-xs transition-all duration-150', t.bar)}
            style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
          />
        </div>
      )}

      <p className="text-muted-foreground mt-2 text-xs leading-snug">{footnote}</p>
    </div>
  )
}
