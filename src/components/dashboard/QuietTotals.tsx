import { Sparkline } from './Sparkline'

/**
 * Context, kept deliberately small.
 *
 * These numbers are reassurance, not decisions — nobody acts on "20 received".
 * As six equal cards they drowned the one number that mattered, so they are a
 * single line now.
 */
export function QuietTotals({
  items,
  trend,
  trendLabel,
}: {
  items: { label: string; value: number; suffix?: string }[]
  trend?: number[]
  trendLabel?: string
}) {
  return (
    <div className="border-border bg-surface flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border px-4 py-3 lift">
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline gap-2">
          <span className="text-foreground tabular text-lg leading-none font-semibold">{i.value}</span>
          <span className="text-muted-foreground text-xs">
            {i.label}
            {i.suffix ? ` ${i.suffix}` : ''}
          </span>
        </div>
      ))}
      {trend && trend.length > 1 && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{trendLabel}</span>
          <Sparkline values={trend} />
        </div>
      )}
    </div>
  )
}
