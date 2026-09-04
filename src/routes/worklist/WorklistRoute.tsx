import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ClipboardList, Send, Truck } from 'lucide-react'
import { api } from '@/services'
import type { WorklistRow, WorklistFilter } from '@/services'
import { TodayBand } from '@/components/dashboard/TodayBand'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { AnalysisPanel } from '@/components/dashboard/AnalysisPanel'
import { Panel } from '@/components/dashboard/Panel'
import { Bars } from '@/components/dashboard/Bars'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { LoadingRows } from '@/components/state/States'
import { StatusChip, PriorityChip } from '@/components/status/StatusChip'
import { ORDER_STATUSES, type OrderStatus } from '@/types/domain'
import { formatTime, formatDate } from '@/fixtures/calendar'
import { productKey, statusKey, useLang } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * The service desk's home. Same composition as the donor's command centre:
 * one loud decision band, four counted tiles, a rail of what stands out,
 * why it stands out, and the queue itself.
 */
export function WorklistRoute() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? 'all') as WorklistFilter['status']
  const q = params.get('q') ?? undefined

  const summary = useQuery({ queryKey: ['summary'], queryFn: () => api.orders.summary() })
  const all = useQuery({ queryKey: ['worklist', 'all', q], queryFn: () => api.orders.worklist({ q }) })
  const rows = useQuery({ queryKey: ['worklist', status, q], queryFn: () => api.orders.worklist({ status, q }) })
  const requests = useQuery({ queryKey: ['requests'], queryFn: () => api.carrier.requests() })
  const deviations = useQuery({ queryKey: ['deviations'], queryFn: () => api.pod.deviations() })
  const attention = useQuery({ queryKey: ['exceptions'], queryFn: () => api.orders.exceptions() })

  const s = summary.data
  const newOrders = (all.data ?? []).filter((r) => r.status === 'order_created' && !r.rejected)
  const first = newOrders[0]
  const overdue = (requests.data ?? []).filter((r) => r.overdue)
  const rejected = (all.data ?? []).filter((r) => r.rejected)
  const openDeviations = (deviations.data ?? []).filter((d) => d.state === 'open')
  const urgentEarly = (all.data ?? []).filter((r) => r.priority === 'urgent' && ['order_created', 'pending_carrier', 'order_scheduled', 'transit_to_terminal'].includes(r.status))

  const waiting = (s?.newRequests ?? 0) + (s?.needsAttention ?? 0)
  const sentence = s
    ? newOrders.length > 0 && first
      ? t('worklist.read', { n: newOrders.length, order: first.erpRef, customer: first.customerName, time: formatTime(first.windowEnd) })
      : t('worklist.readClear', { attention: s.needsAttention })
    : null

  const observations = [
    rejected.length > 0 && { key: 'rejected', tone: 'act' as const, eyebrow: t('worklist.obs.rejected'), title: t('worklist.obs.rejectedTitle'), figure: String(rejected.length), unit: t('worklist.obs.unit'), meta: rejected.map((r) => r.erpRef).slice(0, 3).join(' · '), href: '/worklist?status=needs_attention' },
    overdue.length > 0 && { key: 'overdue', tone: 'watch' as const, eyebrow: t('worklist.obs.overdue'), title: t('worklist.obs.overdueTitle'), figure: String(overdue.length), unit: t('worklist.obs.unit'), meta: overdue.map((r) => r.carrierName).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(' · '), href: '/requests' },
    urgentEarly.length > 0 && { key: 'urgent', tone: 'watch' as const, eyebrow: t('worklist.obs.urgent'), title: t('worklist.obs.urgentTitle'), figure: String(urgentEarly.length), unit: t('worklist.obs.unit'), meta: urgentEarly.map((r) => r.erpRef).slice(0, 3).join(' · '), href: '/worklist?status=pending_carrier' },
    openDeviations.length > 0 && { key: 'deviations', tone: 'act' as const, eyebrow: t('worklist.obs.deviations'), title: t('worklist.obs.deviationsTitle'), figure: String(openDeviations.length), unit: t('worklist.obs.unit'), meta: openDeviations.map((d) => d.erpRef).slice(0, 3).join(' · '), href: '/exceptions' },
  ].filter((o): o is Exclude<typeof o, false> => !!o)

  const analysis = [
    overdue.length > 0 && { key: 'overdue', text: t('worklist.sentence.overdue', { n: overdue.length, carrier: overdue[0].carrierName }), href: '/requests', linkText: overdue[0].carrierName },
    rejected.length > 0 && { key: 'rejected', text: t('worklist.sentence.rejected', { n: rejected.length }), href: '/worklist?status=needs_attention', linkText: String(rejected.length) },
    openDeviations.length > 0 && { key: 'deviations', text: t('worklist.sentence.deviations', { n: openDeviations.length, order: openDeviations[0].erpRef }), href: `/orders/${openDeviations[0].orderId}`, linkText: openDeviations[0].erpRef },
  ].filter((a): a is Exclude<typeof a, false> => !!a)
  if (analysis.length === 0) analysis.push({ key: 'quiet', text: t('worklist.sentence.quiet'), href: '/worklist', linkText: '' })

  const why = [
    { key: 'rejected', label: t('worklist.why.rejected'), count: rejected.length, to: '/worklist?status=needs_attention' },
    { key: 'overdue', label: t('worklist.why.overdue'), count: overdue.length, to: '/requests' },
    { key: 'deviation', label: t('worklist.why.deviation'), count: openDeviations.length, to: '/exceptions' },
  ].filter((r) => r.count > 0)

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of all.data ?? []) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [all.data])

  const columns = useMemo<ColumnDef<WorklistRow>[]>(() => [
    {
      key: 'order', header: t('col.order'), width: '150px', pinned: 'left', sortValue: (r) => r.statusAt,
      render: (r) => (
        <span className="flex flex-col">
          <span className="font-mono text-xs font-medium">{r.isRequest ? r.id : r.erpRef}</span>
          <span className="text-muted-foreground text-2xs">{r.isRequest ? t('worklist.request') : r.id}</span>
        </span>
      ),
    },
    { key: 'customer', header: t('col.customer'), width: '190px', sortValue: (r) => r.customerName, render: (r) => <span className="text-xs">{r.customerName}</span> },
    { key: 'shipTo', header: t('col.shipTo'), width: '140px', sortValue: (r) => r.shipToCity, render: (r) => <span className="text-xs">{r.shipToCity}</span> },
    { key: 'terminal', header: t('col.terminal'), width: '160px', sortValue: (r) => r.terminalName, render: (r) => <span className="text-muted-foreground text-xs">{r.terminalName}</span> },
    { key: 'carrier', header: t('col.carrier'), width: '190px', sortValue: (r) => r.carrierName ?? '', render: (r) => <span className="text-xs">{r.carrierName ?? '—'}</span> },
    { key: 'status', header: t('col.status'), width: '170px', sortValue: (r) => ORDER_STATUSES.indexOf(r.status), render: (r) => <StatusChip status={r.status} rejected={r.rejected} /> },
    { key: 'priority', header: t('col.priority'), width: '110px', sortValue: (r) => r.priority, render: (r) => <PriorityChip priority={r.priority} /> },
    { key: 'window', header: t('col.window'), width: '170px', numeric: true, sortValue: (r) => r.windowEnd, render: (r) => <span className="tabular text-xs">{formatDate(r.windowStart, lang)} {formatTime(r.windowStart)}–{formatTime(r.windowEnd)}</span> },
    { key: 'eta', header: t('col.eta'), width: '130px', numeric: true, sortValue: (r) => r.eta ?? '', render: (r) => <span className="tabular text-xs">{r.eta ? formatTime(r.eta) : '—'}</span> },
    { key: 'product', header: t('col.product'), width: '110px', render: (r) => <span className="text-muted-foreground text-xs">{r.tonnes} t {r.product}</span> },
    { key: 'owner', header: t('col.owner'), width: '150px', pinned: 'right', sortValue: (r) => r.cvrName, render: (r) => (
      <span className="flex flex-col">
        <span className="text-xs">{r.cvrName}</span>
        {r.lockedBy && <span className="text-sev-high-on-bg text-2xs">{t('worklist.locked', { name: r.lockedBy })}</span>}
      </span>
    ) },
  ], [t, lang])

  const chips: { key: string; label: string; count: number }[] = [
    { key: 'all', label: t('worklist.filter.all'), count: all.data?.length ?? 0 },
    { key: 'needs_attention', label: t('worklist.filter.attention'), count: attention.data?.length ?? 0 },
    ...ORDER_STATUSES.filter((st) => counts[st]).map((st) => ({ key: st, label: t(statusKey(st)), count: counts[st] })),
  ]

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6">
      {s ? (
        <TodayBand
          title={t('page.worklist.title')}
          subtitle={t('page.worklist.desc')}
          waiting={waiting}
          unit={waiting === 1 ? t('worklist.unit.one') : t('worklist.unit.many')}
          severities={[
            { severity: 'critical', count: s.needsAttention },
            { severity: 'high', count: s.newRequests },
          ]}
          sentence={sentence}
          primaryTo={first ? `/orders/${first.id}` : null}
          secondaryTo="/worklist?status=needs_attention"
          metrics={[
            { label: t('worklist.metric.delivered'), value: s.deliveredToday },
            { label: t('worklist.metric.onTime'), value: `${Math.round(s.onTimePct * 100)}%`, tone: s.onTimePct < 0.9 ? 'attention' : 'default' },
            { label: t('worklist.metric.transit'), value: s.inTransit },
          ]}
        />
      ) : (
        <div className="border-structural-border bg-surface h-52 animate-pulse rounded-lg border" />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {s && (
          <>
            <KpiTile label={t('worklist.kpi.new')} value={s.newRequests} icon={ClipboardList} tone={s.newRequests > 0 ? 'warning' : 'good'} footnote={t('worklist.kpi.newFoot')} />
            <KpiTile label={t('worklist.kpi.pending')} value={s.pendingCarrier} icon={Send} tone="neutral" footnote={t('worklist.kpi.pendingFoot')} />
            <KpiTile label={t('worklist.kpi.transit')} value={s.inTransit} icon={Truck} tone="neutral" footnote={t('worklist.kpi.transitFoot')} />
            <KpiTile label={t('worklist.kpi.attention')} value={s.needsAttention} icon={AlertTriangle} tone={s.needsAttention > 0 ? 'warning' : 'good'} footnote={t('worklist.kpi.attentionFoot')} />
          </>
        )}
      </div>

      <AnalysisPanel
        observations={observations}
        analysis={analysis}
        copy={{
          title: t('worklist.rail.title'), subtitle: t('worklist.rail.sub'), empty: t('worklist.rail.empty'),
          written: t('worklist.rail.written'), chip: t('worklist.rail.chip'), foot: t('worklist.rail.foot'),
          toneLabels: { act: t('worklist.obs.act'), watch: t('worklist.obs.watch'), held: t('worklist.obs.held') },
        }}
      />

      <Panel title={t('worklist.why.title')} action={{ label: t('nav.exceptions'), to: '/exceptions' }}>
        <Bars rows={why} emptyCopy={t('worklist.why.empty')} />
      </Panel>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{t('worklist.table.title')}</h2>
          <span className="text-muted-foreground text-xs">{t('worklist.table.count', { n: rows.data?.length ?? 0 })}</span>
        </div>
        <div data-x-scroll="worklist-filters" className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              data-filter={c.key}
              onClick={() => {
                const next = new URLSearchParams(params)
                if (c.key === 'all') next.delete('status')
                else next.set('status', c.key)
                setParams(next, { replace: true })
              }}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors duration-150',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                status === c.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground hover:bg-hover-tint hover:text-foreground',
              )}
            >
              {c.label}
              <span className="tabular opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
        {rows.isLoading ? (
          <LoadingRows rows={6} />
        ) : (
          <DataTable
            name="worklist"
            rows={rows.data ?? []}
            columns={columns}
            rowKey={(r) => r.id}
            maxHeight={308}
            empty={t('worklist.table.empty')}
            onRowClick={(r) => navigate(`/orders/${r.id}`)}
          />
        )}
      </section>
    </div>
  )
}

export type { OrderStatus }
export const productLabelKey = productKey
