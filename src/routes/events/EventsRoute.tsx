import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, CheckCircle2, Timer, X } from 'lucide-react'
import { api } from '@/services'
import type { StatusEvent } from '@/types/domain'
import { PageHeader } from '@/components/shell/PageHeader'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { Bars } from '@/components/dashboard/Bars'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { LoadingRows } from '@/components/state/States'
import { StatusChip } from '@/components/status/StatusChip'
import { Button } from '@/components/ui/button'
import { TIP, AXIS, GRID } from '@/components/charts/chart'
import { formatDateTime } from '@/fixtures/calendar'
import { statusKey, useLang, type I18nKey } from '@/i18n'

type Row = StatusEvent & { erpRef: string; customerName: string }

/**
 * Every status change, oldest at the bottom, with the live figures above
 * it fed by the same query — so the widget and the log can never disagree
 * about how many things happened today.
 */
export function EventsRoute() {
  const { t, lang } = useLang()
  const [params, setParams] = useSearchParams()
  const orderId = params.get('order') ?? undefined
  const live = useQuery({ queryKey: ['live'], queryFn: () => api.reports.live(), refetchInterval: 15_000 })
  const log = useQuery({ queryKey: ['events', orderId ?? 'all'], queryFn: () => api.reports.eventLog({ orderId, limit: 300 }) })
  const rows = log.data ?? []
  const l = live.data

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { key: 'at', header: t('common.when'), width: '170px', pinned: 'left', numeric: true, sortValue: (r) => r.at, render: (r) => <span className="tabular text-xs">{formatDateTime(r.at, lang)}</span> },
    { key: 'order', header: t('col.order'), width: '120px', sortValue: (r) => r.erpRef, render: (r) => <Link to={`/orders/${r.orderId}`} className="text-accent-text font-mono text-xs font-medium hover:underline">{r.erpRef}</Link> },
    { key: 'customer', header: t('col.customer'), width: '200px', render: (r) => <span className="text-xs">{r.customerName}</span> },
    { key: 'status', header: t('col.status'), width: '170px', render: (r) => <StatusChip status={r.status} /> },
    { key: 'actor', header: t('common.who'), width: '180px', sortValue: (r) => r.actor, render: (r) => <span className="text-xs">{r.actor}</span> },
    { key: 'source', header: t('events.source'), width: '120px', sortValue: (r) => r.source, render: (r) => <span className="text-muted-foreground text-xs">{t(`events.source.${r.source}` as I18nKey)}</span> },
  ], [t, lang])

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.events.title')}
        description={t('page.events.desc')}
        action={orderId ? (
          <Button variant="outline" onClick={() => { const n = new URLSearchParams(params); n.delete('order'); setParams(n) }} data-events-clear><X className="size-4" aria-hidden />{t('events.clearFilter', { id: orderId })}</Button>
        ) : <span />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-card="live">
        <KpiTile label={t('events.today')} value={l?.eventsToday ?? 0} footnote={t('events.todayFoot')} icon={Activity} tone="neutral" />
        <KpiTile label={t('events.acceptance')} value={l?.medianAcceptanceMinutes ?? 0} footnote={t('events.acceptanceFoot')} icon={Timer} tone={(l?.medianAcceptanceMinutes ?? 0) <= 30 ? 'good' : 'warning'} />
        <KpiTile label={t('events.onTime')} value={l?.onTimePct ?? 0} unit="%" footnote={t('events.onTimeFoot')} icon={CheckCircle2} tone={(l?.onTimePct ?? 0) >= 0.9 ? 'good' : 'warning'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px] xl:items-stretch">
        <section className="border-structural-border bg-surface flex h-full flex-col rounded-lg border px-5 py-4" data-card="by-hour">
          <h2 className="text-sm font-semibold">{t('events.byHour')}</h2>
          <div className="mt-3 h-[200px] flex-1">
            {!l ? <div className="bg-muted h-full animate-pulse rounded-md" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={l.byHour} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid {...GRID} vertical={false} />
                  <XAxis dataKey="hour" tick={AXIS} tickFormatter={(h: number) => `${String(h).padStart(2, '0')}h`} interval={2} />
                  <YAxis tick={AXIS} allowDecimals={false} />
                  <Tooltip {...TIP} labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`} formatter={(v: number) => [v, t('events.events')]} />
                  <Bar dataKey="count" fill="var(--accent)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        <section className="border-structural-border bg-surface flex h-full flex-col rounded-lg border px-5 py-4" data-card="by-status">
          <h2 className="text-sm font-semibold">{t('events.byStatus')}</h2>
          <div className="mt-3 flex-1">
            <Bars rows={(l?.byStatus ?? []).map((s) => ({ key: s.status, label: t(statusKey(s.status)), count: s.count, to: `/worklist?status=${s.status}` }))} emptyCopy={t('common.empty')} />
          </div>
        </section>
      </div>

      {log.isLoading ? <LoadingRows rows={8} /> : (
        <DataTable name="events" rows={rows} columns={columns} rowKey={(r) => r.id} maxHeight={420} empty={t('common.empty')} />
      )}
    </div>
  )
}
