import { useMemo } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock, Route, Truck, Warehouse } from 'lucide-react'
import { api } from '@/services'
import type { WorklistRow, YardRow } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { StatusChip, PriorityChip } from '@/components/status/StatusChip'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/app/auth'
import { STAKEHOLDER_KINDS, statusIndex, type StakeholderKind } from '@/types/domain'
import { formatTime, formatDate } from '@/fixtures/calendar'
import { kindKey, productKey, useLang } from '@/i18n'
import { cn } from '@/lib/utils'

const ICON: Record<StakeholderKind, typeof Truck> = { sales: BriefcaseBusiness, planner: CalendarClock, dispatcher: Route, shipping_point: Warehouse }

/**
 * Four teams look at the same orders and need four different first
 * questions answered. The chooser changes the figures and the columns,
 * not the data — so a number seen here is the same number the desk sees.
 */
export function StakeholderRoute() {
  const { t, lang } = useLang()
  const { session, setStakeholderKind } = useAuth()
  const kind = session?.stakeholderKind ?? 'sales'

  const worklist = useQuery({ queryKey: ['worklist', 'all'], queryFn: () => api.orders.worklist() })
  const summary = useQuery({ queryKey: ['summary'], queryFn: () => api.orders.summary() })
  const yard = useQuery({ queryKey: ['yard', 'all'], queryFn: () => api.tracking.yard(), enabled: kind === 'shipping_point' })
  const board = useQuery({ queryKey: ['dispatch'], queryFn: () => api.tracking.dispatchBoard(), enabled: kind === 'dispatcher' })

  const rows = (worklist.data ?? []).filter((r) => !r.isRequest)
  const now = Date.now()
  const late = rows.filter((r) => r.status !== 'delivery_completed' && Date.parse(r.windowEnd) < now)
  const today = rows.filter((r) => formatDate(r.windowStart) === formatDate(new Date(now).toISOString()))
  const tonnesToday = today.reduce((n, r) => n + r.tonnes, 0)
  const terminalsActive = new Set(rows.filter((r) => r.status !== 'delivery_completed').map((r) => r.terminalId)).size
  const stalled = (board.data ?? []).flatMap((c) => c.loads.filter((l) => l.stalled))
  const yardRows = yard.data ?? []

  const base = useMemo<ColumnDef<WorklistRow>[]>(() => [
    { key: 'order', header: t('col.order'), width: '120px', pinned: 'left', sortValue: (r) => r.erpRef, render: (r) => <Link to={`/orders/${r.id}`} className="text-accent-text font-mono text-xs font-medium hover:underline">{r.erpRef}</Link> },
    { key: 'status', header: t('col.status'), width: '150px', sortValue: (r) => statusIndex(r.status), render: (r) => <StatusChip status={r.status} rejected={r.rejected} /> },
  ], [t])

  const columnsByKind: Record<StakeholderKind, ColumnDef<WorklistRow>[]> = {
    sales: [
      base[0],
      { key: 'customer', header: t('col.customer'), width: '200px', sortValue: (r) => r.customerName, render: (r) => <span className="text-xs">{r.customerName}</span> },
      { key: 'shipTo', header: t('col.shipTo'), width: '200px', render: (r) => <span className="text-muted-foreground text-xs">{r.shipToName}</span> },
      base[1],
      { key: 'priority', header: t('col.priority'), width: '110px', render: (r) => <PriorityChip priority={r.priority} /> },
      { key: 'windowEnd', header: t('stake.windowEnd'), width: '150px', numeric: true, sortValue: (r) => r.windowEnd, render: (r) => <span className={cn('tabular text-xs', Date.parse(r.windowEnd) < now && r.status !== 'delivery_completed' && 'text-sev-high-on-bg font-medium')}>{formatDate(r.windowEnd, lang)} {formatTime(r.windowEnd)}</span> },
      { key: 'eta', header: t('col.eta'), width: '120px', numeric: true, render: (r) => <span className="tabular text-xs">{r.eta ? formatTime(r.eta) : '—'}</span> },
    ],
    planner: [
      base[0],
      { key: 'terminal', header: t('col.terminal'), width: '170px', sortValue: (r) => r.terminalName, render: (r) => <span className="text-xs">{r.terminalName}</span> },
      { key: 'product', header: t('col.product'), width: '170px', sortValue: (r) => r.product, render: (r) => <span className="text-xs">{t(productKey(r.product))}</span> },
      { key: 'tonnes', header: t('col.tonnes'), width: '90px', numeric: true, sortValue: (r) => r.tonnes, render: (r) => <span className="tabular text-xs">{r.tonnes} t</span> },
      base[1],
      { key: 'window', header: t('col.window'), width: '170px', numeric: true, sortValue: (r) => r.windowStart, render: (r) => <span className="tabular text-xs">{formatDate(r.windowStart, lang)} {formatTime(r.windowStart)}–{formatTime(r.windowEnd)}</span> },
      { key: 'carrier', header: t('col.carrier'), width: '170px', render: (r) => <span className="text-xs">{r.carrierName ?? '—'}</span> },
    ],
    dispatcher: [
      base[0],
      { key: 'carrier', header: t('col.carrier'), width: '190px', sortValue: (r) => r.carrierName ?? '', render: (r) => <span className="text-xs">{r.carrierName ?? '—'}</span> },
      base[1],
      { key: 'customer', header: t('col.customer'), width: '200px', render: (r) => <span className="text-xs">{r.customerName}</span> },
      { key: 'windowEnd', header: t('stake.windowEnd'), width: '150px', numeric: true, sortValue: (r) => r.windowEnd, render: (r) => <span className="tabular text-xs">{formatDate(r.windowEnd, lang)} {formatTime(r.windowEnd)}</span> },
      { key: 'flag', header: t('stake.flag'), width: '140px', render: (r) => r.rejected ? <span className="text-sev-critical-on-bg flex items-center gap-1 text-2xs font-medium"><AlertTriangle className="size-3" aria-hidden />{t('stake.rejected')}</span> : r.expedited ? <span className="text-sev-high-on-bg text-2xs font-medium">{t('stake.expedited')}</span> : <span className="text-muted-foreground text-2xs">—</span> },
    ],
    shipping_point: [],
  }

  const yardColumns = useMemo<ColumnDef<YardRow>[]>(() => [
    { key: 'truck', header: t('yard.truck'), width: '120px', pinned: 'left', render: (r) => <span className="font-mono text-xs font-medium">{r.truckPlate}</span> },
    { key: 'status', header: t('col.status'), width: '160px', sortValue: (r) => statusIndex(r.status), render: (r) => <StatusChip status={r.status} /> },
    { key: 'carrier', header: t('col.carrier'), width: '180px', render: (r) => <span className="text-xs">{r.carrierName}</span> },
    { key: 'order', header: t('col.order'), width: '110px', render: (r) => <Link to={`/orders/${r.orderId}`} className="text-accent-text font-mono text-xs font-medium hover:underline">{r.erpRef}</Link> },
    { key: 'load', header: t('col.product'), width: '170px', render: (r) => <span className="text-xs">{r.tonnes} t {t(productKey(r.product))}</span> },
    { key: 'bay', header: t('yard.bay'), width: '80px', numeric: true, render: (r) => <span className="tabular text-xs">{r.bay ?? '—'}</span> },
  ], [t])

  const tableRows: Record<StakeholderKind, WorklistRow[]> = {
    sales: rows,
    planner: rows.filter((r) => r.status !== 'delivery_completed'),
    dispatcher: rows.filter((r) => r.status === 'pending_carrier' || r.rejected || r.expedited),
    shipping_point: [],
  }

  const kpis: Record<StakeholderKind, { label: string; value: number; unit?: '%'; footnote: string; icon: typeof Truck; tone?: 'good' | 'warning' | 'neutral' }[]> = {
    sales: [
      { label: t('stake.sales.open'), value: rows.filter((r) => r.status !== 'delivery_completed').length, footnote: t('stake.sales.openFoot'), icon: BriefcaseBusiness },
      { label: t('stake.sales.late'), value: late.length, footnote: t('stake.sales.lateFoot'), icon: AlertTriangle, tone: late.length ? 'warning' : 'good' },
      { label: t('stake.sales.requests'), value: summary.data?.newRequests ?? 0, footnote: t('stake.sales.requestsFoot'), icon: CalendarClock },
      { label: t('stake.sales.onTime'), value: summary.data?.onTimePct ?? 0, unit: '%', footnote: t('stake.sales.onTimeFoot'), icon: Truck, tone: (summary.data?.onTimePct ?? 0) >= 0.9 ? 'good' : 'warning' },
    ],
    planner: [
      { label: t('stake.planner.tonnes'), value: tonnesToday, footnote: t('stake.planner.tonnesFoot'), icon: CalendarClock },
      { label: t('stake.planner.terminals'), value: terminalsActive, footnote: t('stake.planner.terminalsFoot'), icon: Warehouse },
      { label: t('stake.planner.transit'), value: summary.data?.inTransit ?? 0, footnote: t('stake.planner.transitFoot'), icon: Truck },
      { label: t('stake.planner.pending'), value: summary.data?.pendingCarrier ?? 0, footnote: t('stake.planner.pendingFoot'), icon: Route, tone: (summary.data?.pendingCarrier ?? 0) > 3 ? 'warning' : 'neutral' },
    ],
    dispatcher: [
      { label: t('stake.dispatcher.pending'), value: summary.data?.pendingCarrier ?? 0, footnote: t('stake.dispatcher.pendingFoot'), icon: Route },
      { label: t('stake.dispatcher.stalled'), value: stalled.length, footnote: t('stake.dispatcher.stalledFoot'), icon: AlertTriangle, tone: stalled.length ? 'warning' : 'good' },
      { label: t('stake.dispatcher.rejected'), value: rows.filter((r) => r.rejected).length, footnote: t('stake.dispatcher.rejectedFoot'), icon: AlertTriangle },
      { label: t('stake.dispatcher.carriers'), value: board.data?.length ?? 0, footnote: t('stake.dispatcher.carriersFoot'), icon: Truck },
    ],
    shipping_point: [
      { label: t('yard.stat.inbound'), value: yardRows.filter((r) => r.status === 'transit_to_terminal').length, footnote: t('stake.yard.inboundFoot'), icon: Truck },
      { label: t('yard.stat.loading'), value: yardRows.filter((r) => r.status === 'starting_load').length, footnote: t('stake.yard.loadingFoot'), icon: Warehouse, tone: 'neutral' },
      { label: t('yard.stat.loaded'), value: yardRows.filter((r) => r.status === 'load_completed').length, footnote: t('stake.yard.loadedFoot'), icon: CalendarClock },
      { label: t('stake.yard.today'), value: summary.data?.deliveredToday ?? 0, footnote: t('stake.yard.todayFoot'), icon: BriefcaseBusiness },
    ],
  }

  const cta: Partial<Record<StakeholderKind, { to: string; label: string }>> = {
    dispatcher: { to: '/dispatch', label: t('stake.openDispatch') },
    shipping_point: { to: '/yard', label: t('stake.openYard') },
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.stakeholder.title')}
        description={t('page.stakeholder.desc')}
        action={cta[kind] ? (
          <Button asChild data-variant="primary"><Link to={cta[kind]!.to}>{cta[kind]!.label}<ArrowRight className="size-4" aria-hidden /></Link></Button>
        ) : <span />}
      />

      <div role="tablist" aria-label={t('stake.chooser')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAKEHOLDER_KINDS.map((k) => {
          const Icon = ICON[k]
          return (
            <button key={k} role="tab" aria-selected={kind === k} data-kind={k} onClick={() => setStakeholderKind(k)} className={cn('flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors', kind === k ? 'border-accent bg-surface shadow-xs' : 'border-border bg-muted/40 hover:bg-hover-tint')}>
              <Icon className={cn('size-5 shrink-0', kind === k ? 'text-accent-text' : 'text-muted-foreground')} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t(kindKey(k))}</span>
                <span className="text-muted-foreground block text-2xs">{t(`stake.${k}.question` as const)}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4" data-kind-kpis={kind}>
        {kpis[kind].map((k) => <KpiTile key={k.label} label={k.label} value={k.value} unit={k.unit} footnote={k.footnote} icon={k.icon} tone={k.tone ?? 'neutral'} />)}
      </div>

      {kind === 'shipping_point' ? (
        <DataTable name="stake-yard" rows={yardRows} columns={yardColumns} rowKey={(r) => r.orderId} maxHeight={360} empty={t('common.empty')} />
      ) : (
        <DataTable name={`stake-${kind}`} rows={tableRows[kind]} columns={columnsByKind[kind]} rowKey={(r) => r.id} maxHeight={360} empty={t('common.empty')} />
      )}
    </div>
  )
}
