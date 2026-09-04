import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface HeaderStat {
  label: string
  value: string | number
  tone?: 'default' | 'attention' | 'good'
}

const TONE = {
  default: 'text-foreground',
  attention: 'text-sev-critical',
  good: 'text-verdict-pass',
} as const

type Base = {
  title: string
  description?: ReactNode
  stats?: HeaderStat[]
  action?: ReactNode
  className?: string
}

/**
 * Every page opens with this, and it is a card rather than a bare heading on
 * the page background.
 *
 * The union below is deliberate: a header must supply stats, an action, or
 * both. A title floating in an empty band with nothing on the right is the one
 * shape this component will not compile.
 */
export type PageHeaderProps = Base & ({ stats: HeaderStat[] } | { action: ReactNode })

export function PageHeader({ title, description, stats, action, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'border-border bg-surface mb-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-lg border px-5 py-4 lift',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="text-muted-foreground mt-1 text-sm">{description}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
        {stats?.map((s) => (
          <div key={s.label}>
            <div
              className={cn(
                'figure tabular text-lg leading-none font-medium',
                TONE[s.tone ?? 'default'],
              )}
            >
              {s.value}
            </div>
            <div className="text-muted-foreground mt-1 text-xs whitespace-nowrap">{s.label}</div>
          </div>
        ))}
        {action}
      </div>
    </header>
  )
}
