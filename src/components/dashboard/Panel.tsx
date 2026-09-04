import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * One panel, one question.
 *
 * The heading says what the panel answers in plain words, so reading only the
 * headings down the page tells you the story. That is the whole point: a
 * dashboard where every block is titled with a noun ("Metrics", "Overview")
 * makes you read the contents to find out what you are looking at.
 */
export function Panel({
  title, subtitle, action, children, className, tone = 'default', icon,
}: {
  title: string
  icon?: ReactNode
  subtitle?: string
  action?: { label: string; to: string }
  children: ReactNode
  className?: string
  tone?: 'default' | 'quiet' | 'ai'
}) {
  return (
    <section
      className={cn(
        'rounded-lg border',
        tone === 'quiet' ? 'border-border bg-muted/30'
        : tone === 'ai' ? 'border-ai-border ai-surface'
        : 'border-border bg-surface',
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <h2 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
            {icon}
            {title}
          </h2>
          {subtitle && <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>}
        </div>
        {action && (
          <Link
            to={action.to}
            className="text-accent-text focus-visible:ring-ring shrink-0 rounded-md text-xs font-medium whitespace-nowrap hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {action.label}
          </Link>
        )}
      </header>
      <div className="px-4 pb-4">{children}</div>
    </section>
  )
}
