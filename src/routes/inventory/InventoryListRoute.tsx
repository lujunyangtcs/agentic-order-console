import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services'
import type { InventoryRow } from '@/services'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/state/States'
import { SourceCaveat } from '@/components/state/SourceCaveat'
import { LoadingRows } from '@/components/state/States'
import { formatDate } from '@/fixtures/calendar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * SKU by site, with the four numbers a planner is actually comparing.
 *
 * Criticality, the target on file, the recommended target and the current
 * status are four separate columns because they are four separate facts, and
 * §3.2 principle 3 exists because collapsing them is the usual mistake. A part
 * can be production-critical and perfectly healthy; a consumable can be the
 * thing that stops the line this week.
 */

const STATUS: Record<InventoryRow['status'], { label: string; tone: string }> = {
  action_required: { label: 'Action required', tone: 'bg-sev-critical-bg text-sev-critical-on-bg' },
  watch: { label: 'Watch', tone: 'bg-sev-high-bg text-sev-high-on-bg' },
  blocked: { label: 'Blocked', tone: 'bg-muted text-foreground' },
  excess: { label: 'Excess', tone: 'bg-verdict-ambiguous-bg text-verdict-ambiguous' },
  healthy: { label: 'Healthy', tone: 'bg-verdict-pass-bg text-verdict-pass' },
}

const ORDER: InventoryRow['status'][] = ['action_required', 'blocked', 'watch', 'excess', 'healthy']

export function InventoryListRoute() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<InventoryRow['status'] | null>(null)
  const rows = useQuery({ queryKey: ['inventory'], queryFn: () => api.inventory.list() })

  /* The header's search box navigates here with `?q=`, and an earlier revision of this route
   * ignored it — the ⌘K hint worked, the navigation worked, and the planner
   * landed on an unfiltered nineteen-hundred-row table. A search that visibly
   * does nothing is worse than no search box. */
  const [params, setParams] = useSearchParams()
  const q = params.get('q')?.trim() ?? ''

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows.data ?? []) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [rows.data])

  const shown = useMemo(() => {
    const all = rows.data ?? []
    const sorted = [...all].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))
    const byStatus = filter ? sorted.filter((r) => r.status === filter) : sorted
    if (!q) return byStatus
    const needle = q.toLowerCase()
    return byStatus.filter(
      (r) =>
        r.partNumber.toLowerCase().includes(needle) ||
        r.description.toLowerCase().includes(needle),
    )
  }, [rows.data, filter, q])

  const clearAll = () => {
    setFilter(null)
    setParams({}, { replace: true })
  }

  const columns: ColumnDef<InventoryRow>[] = useMemo(() => [
    {
      key: 'part', header: 'Part', width: '250px', pinned: 'left',
      sortValue: (r) => r.partNumber,
      render: (r) => (
        <span className="flex flex-col">
          <span className="font-mono text-xs font-medium">{r.partNumber}</span>
          <span className="text-muted-foreground truncate text-2xs">{r.description}</span>
        </span>
      ),
    },
    {
      key: 'loc', header: 'Site / warehouse', width: '150px',
      sortValue: (r) => `${r.site}${r.warehouse}`,
      render: (r) => <span className="text-xs">{r.site} / {r.warehouse}</span>,
    },
    {
      key: 'crit', header: 'Criticality', width: '160px',
      sortValue: (r) => r.criticality,
      render: (r) => <span className="text-muted-foreground text-xs">{r.criticality}</span>,
    },
    { key: 'avail', header: 'Available', width: '105px', numeric: true, sortValue: (r) => r.available, render: (r) => <span className="text-xs">{r.available}</span> },
    {
      key: 'cur', header: 'Target on file', width: '130px', numeric: true,
      sortValue: (r) => r.currentSafety ?? -1,
      /* "Not maintained" and "maintained at zero" are different facts. */
      render: (r) => r.currentSafety === null
        ? <span className="text-muted-foreground text-2xs italic">not maintained</span>
        : <span className="text-xs">{r.currentSafety}</span>,
    },
    { key: 'rec', header: 'Recommended', width: '125px', numeric: true, sortValue: (r) => r.recommendedSafety, render: (r) => <span className="text-xs font-medium">{r.recommendedSafety}</span> },
    {
      key: 'delta', header: 'Delta', width: '95px', numeric: true,
      sortValue: (r) => r.delta ?? 0,
      render: (r) => r.delta === null
        ? <span className="text-muted-foreground text-xs">—</span>
        : <span className={cn('text-xs font-medium', r.delta > 0 ? 'text-sev-high-on-bg' : r.delta < 0 ? 'text-verdict-pass' : 'text-muted-foreground')}>
            {r.delta > 0 ? '+' : ''}{r.delta}
          </span>,
    },
    {
      key: 'breach', header: 'Projected breach', width: '150px', numeric: true,
      sortValue: (r) => r.projectedBreach ?? '9999',
      render: (r) => <span className="text-xs">{r.projectedBreach ? formatDate(r.projectedBreach) : '—'}</span>,
    },
    {
      key: 'exposure', header: 'Variant exposure', width: '150px', numeric: true,
      sortValue: (r) => r.variantExposure,
      /* A scalar here, the matrix on the assembly view. §12.3 defines it as the
         number of configurations with live orders drawing this part. */
      render: (r) => (
        <span className="text-xs" title="Configurations with live orders drawing this part">
          {r.variantExposure || '—'}
        </span>
      ),
    },
    { key: 'supply', header: 'Open supply', width: '120px', numeric: true, sortValue: (r) => r.openSupply, render: (r) => <span className="text-xs">{r.openSupply || '—'}</span> },
    {
      key: 'conf', header: 'Confidence', width: '120px',
      sortValue: (r) => r.confidence,
      /* A band, never a bare percentage — §7.2, because three different
         quantities were all being called confidence. */
      render: (r) => <span className="text-muted-foreground text-xs capitalize">{r.confidence}</span>,
    },
    {
      key: 'status', header: 'Status', width: '150px', pinned: 'right',
      sortValue: (r) => ORDER.indexOf(r.status),
      render: (r) => (
        <span className={cn('rounded-xs px-1.5 py-0.5 text-2xs font-medium', STATUS[r.status].tone)}>
          {STATUS[r.status].label}
        </span>
      ),
    },
  ], [])

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-6">
      <PageHeader
        title="Inventory Intelligence"
        description="Safety policy, projected position and recommended action, by SKU and site."
        stats={[{ label: 'Positions', value: String(rows.data?.length ?? '—') }]}
      />

      <SourceCaveat
        connectorId="counts"
        consequence="On-hand is the quantity the system of record holds, not a counted quantity — no count age or quarantine state is available."
      />

      {/* Every status is clickable and filters the table. All five are shown
          even at zero, so a viewer can see the vocabulary is complete. */}
      <div className="flex flex-wrap gap-2">
        {ORDER.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter((f) => (f === k ? null : k))}
            aria-pressed={filter === k}
            className={cn(
              'border-structural-border focus-visible:ring-ring flex items-baseline gap-2 rounded-md border px-3 py-1.5',
              'text-xs focus-visible:ring-2 focus-visible:outline-none',
              filter === k ? 'bg-hover-tint' : 'hover:bg-hover-tint',
            )}
          >
            <span className={cn('size-2 rounded-xs', STATUS[k].tone.split(' ')[0])} aria-hidden />
            {STATUS[k].label}
            <span className="tabular font-semibold">{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* §18 requires an empty state to preserve active filters and explain
          itself. Preserving them silently is half the job — a planner who
          cannot see *what* is filtering has no way to reason about why the
          table is empty, so the active criteria are stated whenever any are
          set, not only when the result is zero. */}
      {(q || filter) && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span>
            Showing <span className="text-foreground tabular font-medium">{shown.length}</span> of{' '}
            <span className="tabular">{rows.data?.length ?? 0}</span> positions
          </span>
          {q && (
            <span className="border-border rounded-xs border px-1.5 py-0.5 text-2xs">
              matching <span className="font-mono">{q}</span>
            </span>
          )}
          {filter && (
            <span className="border-border rounded-xs border px-1.5 py-0.5 text-2xs">
              {STATUS[filter].label}
            </span>
          )}
          {/* The empty state carries its own Clear, so this one steps aside
              rather than putting two identical controls in one viewport. */}
          {shown.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-accent-text hover:text-accent focus-visible:ring-ring rounded-md font-medium focus-visible:ring-2 focus-visible:outline-none"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {rows.isLoading ? (
        <LoadingRows rows={8} />
      ) : shown.length === 0 ? (
        <EmptyState
          title="No positions match this selection"
          description={[
            q ? `Nothing matches “${q}”.` : null,
            filter ? `Status filter: ${STATUS[filter].label}.` : null,
            'The filters are still applied — clearing them brings the full list back.',
          ]
            .filter(Boolean)
            .join(' ')}
          action={
            <Button size="sm" variant="outline" onClick={clearAll}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <DataTable
          name="inventory"
          rows={shown}
          columns={columns}
          rowKey={(r) => `${r.partNumber}:${r.site}:${r.warehouse}`}
          maxHeight={620}
          empty="Nothing in this selection."
          onRowClick={(r) =>
            navigate(`/inventory/${r.site.toLowerCase()}/${r.warehouse.toLowerCase()}/${r.partNumber.toLowerCase()}`)
          }
        />
      )}
    </div>
  )
}
