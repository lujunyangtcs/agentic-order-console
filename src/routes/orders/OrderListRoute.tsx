import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services'
import type { OrderRow } from '@/services'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { PageHeader } from '@/components/shell/PageHeader'
import { LoadingRows } from '@/components/state/States'
import { formatDate } from '@/fixtures/calendar'
import { cn } from '@/lib/utils'

/**
 * Configured orders, ranked by what they need from a planner.
 *
 * Readiness is a share of covered lines, and lines that fall below policy after
 * the build are deliberately outside the numerator. A part that covers this
 * build but breaches its target once the order ships is a problem deferred, and
 * counting it as ready is how a queue stops being a queue.
 */

const columns: ColumnDef<OrderRow>[] = [
  {
    key: 'id', header: 'Order', width: '170px', pinned: 'left',
    sortValue: (r) => r.id,
    render: (r) => <span className="font-mono text-xs font-medium">{r.id}</span>,
  },
  {
    key: 'config', header: 'Product / configuration', width: '250px',
    sortValue: (r) => r.configurationLabel,
    render: (r) => (
      <span className="flex flex-col">
        <span className="text-xs">{r.configurationLabel}</span>
        <span className="text-muted-foreground font-mono text-2xs">{r.configurationId}</span>
      </span>
    ),
  },
  {
    key: 'customer', header: 'Customer', width: '200px',
    sortValue: (r) => r.customer,
    render: (r) => <span className="text-xs">{r.customer}</span>,
  },
  {
    key: 'qty', header: 'Qty', width: '80px', numeric: true,
    sortValue: (r) => r.quantity,
    render: (r) => <span className="text-xs">{r.quantity}</span>,
  },
  {
    key: 'ship', header: 'Required ship', width: '140px', numeric: true,
    sortValue: (r) => r.requiredShipDate,
    render: (r) => <span className="text-xs">{formatDate(r.requiredShipDate)}</span>,
  },
  {
    key: 'readiness', header: 'Material readiness', width: '190px',
    sortValue: (r) => r.readinessPct,
    render: (r) => (
      <span className="flex items-center gap-2">
        <span className="bg-muted h-1.5 w-20 shrink-0 rounded-full">
          <span
            className={cn('block h-full rounded-full', r.short ? 'bg-sev-high' : 'bg-verdict-pass')}
            style={{ width: `${Math.round(r.readinessPct * 100)}%` }}
          />
        </span>
        <span className="tabular text-xs">{Math.round(r.readinessPct * 100)}%</span>
      </span>
    ),
  },
  {
    key: 'short', header: 'Short', width: '90px', numeric: true,
    sortValue: (r) => r.short,
    render: (r) => (
      <span className={cn('text-xs font-medium', r.short ? 'text-sev-critical-on-bg' : 'text-muted-foreground')}>
        {r.short || '—'}
      </span>
    ),
  },
  {
    key: 'below', header: 'Below policy after build', width: '190px', numeric: true,
    sortValue: (r) => r.belowSafetyAfterBuild,
    render: (r) => (
      <span className={cn('text-xs', r.belowSafetyAfterBuild ? 'text-sev-high-on-bg font-medium' : 'text-muted-foreground')}>
        {r.belowSafetyAfterBuild || '—'}
      </span>
    ),
  },
  {
    key: 'blocked', header: 'Blocked', width: '110px', numeric: true, pinned: 'right',
    sortValue: (r) => r.blocked,
    render: (r) => (
      <span className={cn('text-xs', r.blocked ? 'font-medium' : 'text-muted-foreground')}>
        {r.blocked || '—'}
      </span>
    ),
  },
]

export function OrderListRoute() {
  const navigate = useNavigate()
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => api.orders.list() })

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-6">
      <PageHeader
        title="Order Impact"
        description="Configured customer orders ranked by material readiness and required action."
        stats={[
          { label: 'Open orders', value: String(orders.data?.length ?? '—') },
          {
            label: 'With a shortage',
            value: String(orders.data?.filter((o) => o.short > 0).length ?? '—'),
            tone: orders.data?.some((o) => o.short > 0) ? 'attention' : undefined,
          },
        ]}
      />
      {orders.isLoading ? (
        <LoadingRows rows={6} />
      ) : (
        <DataTable
          name="orders"
          rows={orders.data ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          empty="No open orders."
          onRowClick={(r) => navigate(`/orders/${r.id.toLowerCase()}/impact`)}
        />
      )}
    </div>
  )
}
