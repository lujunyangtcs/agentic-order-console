import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { api } from '@/services'
import { cn } from '@/lib/utils'

/**
 * What this page cannot see, said on the page that would use it.
 *
 * §18's partial-data clause has four parts, and the second is the one that is
 * almost always dropped: *identify the missing source or field*. The
 * Integrations screen already reports two connectors as not connected, but a
 * disclosure that lives only on the governance page is a disclosure nobody
 * reads at the moment it matters. The planner deciding whether to trust an
 * on-hand figure is looking at the on-hand figure, not at a connector list.
 *
 * So the caveat renders where the gap bites, and it renders *from the connector
 * record* rather than from a sentence typed into the page. Connect the feed in
 * the fixture and the caveat disappears everywhere at once — which is the same
 * master-data rule the rest of the build follows, applied to an absence rather
 * than to a number.
 *
 * §18 also says to block only unsafe actions rather than the whole page. This
 * blocks nothing. The data is shown, the limit is named, and the reader decides
 * what it is worth — which is the honest position when the feed genuinely is
 * not there.
 */
export function SourceCaveat({
  connectorId, consequence, className,
}: {
  /** Matches a connector id in §16.3's list — `bom` or `counts` here. */
  connectorId: string
  /** What the absence means for the numbers on *this* page, in the planner's terms. */
  consequence: string
  className?: string
}) {
  const { data } = useQuery({ queryKey: ['connectors'], queryFn: () => api.integrations.connectors() })
  const connector = data?.find((c) => c.id === connectorId)

  /* Nothing to say while the connector list is loading, and nothing to say once
   * the feed is connected. Both silences are correct. */
  if (!connector || connector.connected) return null

  return (
    <p
      data-source-caveat={connectorId}
      className={cn(
        'text-muted-foreground flex items-start gap-1.5 text-2xs leading-relaxed',
        className,
      )}
    >
      <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
      <span>
        {consequence}{' '}
        <span className="text-foreground">{connector.name}</span> is not connected.
      </span>
    </p>
  )
}
