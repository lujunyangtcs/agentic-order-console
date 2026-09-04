import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Truck } from 'lucide-react'
import { api } from '@/services'
import type { RequisitionGroup, RequisitionSet } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/fixtures/calendar'
import { cn } from '@/lib/utils'

/**
 * The replenishment workbench.
 *
 * Recommendations arrive grouped by supplier, site and currency, because that
 * is how they will be bought. §13.2 requires it, and a screen that showed one
 * flat list would be asking the reviewer to do the grouping in their head
 * before they could judge any of it.
 *
 * Every figure in a group header is derived from that group's own lines. There
 * is nowhere in the code to author a group total independently of the set, which
 * is what makes the subset rule hold by construction rather than by care.
 */

const SET_ID = 'REQ-DEMO-0007'

const REASON_LABEL = {
  protect_order: 'Protects the order',
  restore_safety: 'Restores safety',
} as const

export function ReplenishmentRoute() {
  const set = useQuery({ queryKey: ['req-set', SET_ID], queryFn: () => api.replenishment.set(SET_ID) })
  const s = set.data

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-6">
      <PageHeader
        title="Replenishment"
        description="Recommendations grouped by supplier, site and currency — the way they will be bought."
        stats={[
          { label: 'Lines', value: s ? String(s.totalLines) : '—' },
          { label: 'Suppliers', value: s ? String(s.groups.length) : '—' },
          { label: 'Value', value: s ? `$${s.totalSpend.toLocaleString()}` : '—' },
          { label: 'Customer orders protected', value: s ? String(s.customerOrdersProtected) : '—' },
        ]}
      />

      {s && (
        <>
          <div className="flex flex-col gap-4">
            {s.groups.map((g) => <GroupCard key={g.id} group={g} whole={s} />)}
          </div>

          <div className="border-structural-border bg-surface flex flex-wrap items-center gap-4 rounded-lg border p-4">
            <div className="mr-auto">
              <p className="text-sm font-medium">
                {s.totalLines} lines · {s.groups.length} suppliers · ${s.totalSpend.toLocaleString()}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {s.customerOrdersProtected} customer orders and {s.buildsProtected} builds protected.
                {s.status === 'written' && ' Already written back.'}
              </p>
            </div>
            <Button asChild size="sm" data-variant="primary">
              <Link to={`/requisitions/${SET_ID.toLowerCase()}`}>
                Review the set
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * A supplier group, and its share of what the set protects.
 *
 * The protected counts are stated as shares — "6 of 6" — rather than as bare
 * numbers. Three groups each printing "6 customer orders protected" beside a
 * set header printing the same 6 is arithmetically correct, because the sets
 * overlap rather than add, and reads to anyone in the room like the
 * double-count §8.6 calls the most visible arithmetic error the demo can make.
 *
 * A share cannot be mistaken for an addend. It also states the more
 * interesting fact: this one supplier alone stands behind every order in the
 * set, which is the argument for consolidating rather than splitting.
 */
function GroupCard({ group, whole }: { group: RequisitionGroup; whole: RequisitionSet }) {
  return (
    <section data-card={`group-${group.id}`} className="border-structural-border bg-surface rounded-lg border">
      <header className="border-border grid gap-3 border-b px-5 py-3.5 md:grid-cols-[1.6fr_repeat(4,auto)] md:items-baseline">
        <div className="flex items-center gap-2">
          <Truck className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{group.supplierName}</h2>
            <p className="text-muted-foreground font-mono text-2xs">
              {group.id} · {group.site} · {group.currency}
            </p>
          </div>
        </div>
        {[
          ['Lines', String(group.lines.length)],
          ['Spend', `$${group.spend.toLocaleString()}`],
          ['Lead time', group.leadTimeRange[0] === group.leadTimeRange[1]
            ? `${group.leadTimeRange[0]} days`
            : `${group.leadTimeRange[0]}–${group.leadTimeRange[1]} days`],
          ['Earliest need-by', formatDate(group.earliestNeedBy)],
        ].map(([k, v]) => (
          <div key={k} className="md:text-right">
            <p className="text-muted-foreground eyebrow">{k}</p>
            <p className="tabular mt-0.5 text-sm font-medium">{v}</p>
          </div>
        ))}
      </header>

      <div data-x-scroll={`group-${group.id}`} className="overflow-x-auto overscroll-x-contain">
        <table className="w-full text-sm" style={{ minWidth: 900 }}>
          <thead>
            <tr className="border-border text-muted-foreground border-b text-2xs uppercase">
              {['Part', 'Reason', 'Available', 'Shortfall', 'MOQ / mult.', 'Quantity', 'Need by', 'Arrives', 'Extended'].map((h, i) => (
                <th key={h} scope="col" className={cn('px-3 py-2 font-medium', i >= 2 ? 'text-right' : 'text-left', i === 0 && 'pl-5', i === 8 && 'pr-5')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.lines.map((l) => (
              <tr key={l.id} className="border-border border-b last:border-b-0">
                <td className="py-2 pr-3 pl-5">
                  <span className="block font-mono text-xs font-medium">{l.partNumber}</span>
                  <span className="text-muted-foreground block truncate text-2xs">{l.description}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={cn(
                    'rounded-xs px-1.5 py-0.5 text-2xs font-medium',
                    l.reason === 'protect_order'
                      ? 'bg-sev-critical-bg text-sev-critical-on-bg'
                      : 'bg-sev-high-bg text-sev-high-on-bg',
                  )}>
                    {REASON_LABEL[l.reason]}
                  </span>
                </td>
                <td className="tabular px-3 py-2 text-right text-xs">{l.available}</td>
                <td className="tabular px-3 py-2 text-right text-xs">{l.projectedShortfall}</td>
                <td className="tabular text-muted-foreground px-3 py-2 text-right text-xs">
                  {l.moq} / {l.orderMultiple}
                </td>
                {/* The round-up, shown rather than smoothed over. A quantity that
                    silently exceeds the need is the kind of thing a buyer
                    notices later and trusts less for. */}
                <td className="tabular px-3 py-2 text-right text-xs font-medium">
                  {l.quantity}
                  {l.quantity > l.rawNeed && (
                    <span className="text-sev-high-on-bg ml-1 text-2xs font-normal">
                      ↑ from {l.rawNeed}
                    </span>
                  )}
                </td>
                <td className="tabular px-3 py-2 text-right text-xs">{formatDate(l.needByDate)}</td>
                <td className="tabular px-3 py-2 text-right text-xs">{formatDate(l.projectedReceiptDate)}</td>
                <td className="tabular py-2 pr-5 pl-3 text-right text-xs font-medium">
                  ${l.extendedCost.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="border-border text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 border-t px-5 py-2.5 text-2xs">
        <span>
          {group.customerOrdersProtected} of {whole.customerOrdersProtected} customer orders protected
        </span>
        <span>
          {group.buildsProtected} of {whole.buildsProtected} builds protected
        </span>
        {group.externalReference && (
          <span className="text-verdict-pass ml-auto font-mono">{group.externalReference}</span>
        )}
      </footer>
    </section>
  )
}
