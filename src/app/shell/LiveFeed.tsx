import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Activity, AlertTriangle, CheckCircle2, Dot } from 'lucide-react'
import { api } from '@/services'
import type { ActivityItem } from '@/services'
import { cn } from '@/lib/utils'
import { relativeAge } from '@/lib/format'
import { useT } from '@/i18n'

const GLYPH = {
  attention: AlertTriangle,
  good: CheckCircle2,
  neutral: Dot,
} as const

const TONE = {
  attention: 'text-sev-high',
  good: 'text-verdict-pass',
  neutral: 'text-muted-foreground',
} as const

/**
 * A slow ticker of things that actually happened.
 *
 * Two rules keep it from being decoration. Every item is a real event with a
 * real timestamp and a link to the thing it happened to; and it pauses on hover
 * so anything worth reading can be read and clicked. Under reduced-motion it
 * stops moving entirely and becomes a scrollable row.
 */
export function LiveFeed() {
  const t = useT()
  const { data } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.activity.recent(12),
  })

  if (!data || data.length === 0) return null

  /* Long lists must not scroll faster than short ones, so the duration is tied
   * to how much there is to read: roughly six seconds per item. */
  const seconds = Math.max(30, data.length * 6)

  return (
    <div data-print-hide className="border-border bg-surface hidden h-9 shrink-0 items-center gap-3 overflow-hidden border-b pl-4 md:flex">
      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 eyebrow">
        <Activity className="text-accent-text size-3.5" aria-hidden />
        {t('chrome.recentActivity')}
      </span>
      <div className="border-border h-4 border-l" aria-hidden />

      <div className="ticker-mask ticker-scroller group min-w-0 flex-1 overflow-hidden">
        <div
          className="ticker-track flex w-max items-center group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]"
          style={{ animationDuration: `${seconds}s` }}
        >
          {/* Rendered twice so the -50% loop lands on an identical frame. */}
          <Row items={data} />
          <Row items={data} ariaHidden />
        </div>
      </div>
    </div>
  )
}

function Row({ items, ariaHidden }: { items: ActivityItem[]; ariaHidden?: boolean }) {
  return (
    <ul
      className="flex items-center"
      aria-hidden={ariaHidden}
      aria-label={ariaHidden ? undefined : 'Recent activity'}
    >
      {items.map((item) => {
        const Icon = GLYPH[item.tone]
        const body = (
          <>
            <Icon className={cn('size-3.5 shrink-0', TONE[item.tone])} aria-hidden />
            <span className="text-foreground truncate">{item.text}</span>
            <span className="text-muted-foreground shrink-0">{relativeAge(item.at)}</span>
          </>
        )
        return (
          <li key={item.id} className="flex shrink-0 items-center">
            {item.to ? (
              <Link
                to={item.to}
                tabIndex={ariaHidden ? -1 : undefined}
                className="focus-visible:ring-ring hover:bg-hover-tint flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
              >
                {body}
              </Link>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs">{body}</span>
            )}
            <span className="bg-border size-1 rounded-full" aria-hidden />
          </li>
        )
      })}
    </ul>
  )
}
