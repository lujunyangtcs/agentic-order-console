import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CircleAlert, Clock, XCircle } from 'lucide-react'
import { api } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { LoadingRows } from '@/components/state/States'
import { relativeAge } from '@/lib/format'
import { useT, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

type Kind = 'deviation' | 'rejected' | 'overdue'
interface ExceptionRow {
  id: string
  kind: Kind
  orderId: string
  erpRef: string
  customerName: string
  detail: string
  at: string
  state: string
}

const ICON: Record<Kind, typeof CircleAlert> = { deviation: CircleAlert, rejected: XCircle, overdue: Clock }
const TONE: Record<Kind, string> = { deviation: 'bg-sev-high-bg text-sev-high-on-bg', rejected: 'bg-sev-critical-bg text-sev-critical-on-bg', overdue: 'bg-status-pending-bg text-sev-high-on-bg' }

/**
 * Everything that left the happy path, in one list: a problem reported at
 * the site, a carrier that said no, a request nobody has answered. Each row
 * leads to the order, where the decision is made.
 */
export function ExceptionsRoute() {
  const t = useT()
  const [filter, setFilter] = useState<Kind | 'all'>('all')
  const deviations = useQuery({ queryKey: ['deviations'], queryFn: () => api.pod.deviations() })
  const requests = useQuery({ queryKey: ['requests'], queryFn: () => api.carrier.requests() })

  const rows = useMemo<ExceptionRow[]>(() => {
    const dv = (deviations.data ?? []).map((d) => ({ id: d.id, kind: 'deviation' as const, orderId: d.orderId, erpRef: d.erpRef, customerName: d.customerName, detail: `${t(`deviation.kind.${d.kind}` as I18nKey)}${d.qtyDelta ? ` (${d.qtyDelta > 0 ? '+' : ''}${d.qtyDelta} t)` : ''} · ${d.note}`, at: d.filedAt, state: t(`exceptions.state.${d.state}` as I18nKey) }))
    const rj = (requests.data ?? []).filter((r) => r.state === 'rejected').map((r) => ({ id: r.requestId, kind: 'rejected' as const, orderId: r.orderId, erpRef: r.erpRef, customerName: r.customerName, detail: `${r.carrierName} · ${r.reason ?? t('exceptions.noReason')}`, at: r.respondedAt ?? r.sentAt, state: t('exceptions.state.needsCarrier') }))
    const od = (requests.data ?? []).filter((r) => r.state === 'sent' && r.overdue).map((r) => ({ id: r.requestId, kind: 'overdue' as const, orderId: r.orderId, erpRef: r.erpRef, customerName: r.customerName, detail: `${r.carrierName} · ${t('exceptions.waiting', { n: r.minutesOpen })}${r.reminders ? ` · ${t('exceptions.reminders', { n: r.reminders })}` : ''}`, at: r.sentAt, state: t('exceptions.state.open') }))
    return [...dv, ...rj, ...od].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  }, [deviations.data, requests.data, t])

  const counts = { deviation: rows.filter((r) => r.kind === 'deviation').length, rejected: rows.filter((r) => r.kind === 'rejected').length, overdue: rows.filter((r) => r.kind === 'overdue').length }
  const shown = filter === 'all' ? rows : rows.filter((r) => r.kind === filter)

  const columns = useMemo<ColumnDef<ExceptionRow>[]>(() => [
    { key: 'kind', header: t('exceptions.kind'), width: '170px', pinned: 'left', sortValue: (r) => r.kind, render: (r) => { const Icon = ICON[r.kind]; return <span className={cn('inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-2xs font-medium', TONE[r.kind])}><Icon className="size-3" aria-hidden />{t(`exceptions.kind.${r.kind}` as I18nKey)}</span> } },
    { key: 'order', header: t('col.order'), width: '120px', sortValue: (r) => r.erpRef, render: (r) => <Link to={`/orders/${r.orderId}`} className="text-accent-text font-mono text-xs font-medium hover:underline">{r.erpRef}</Link> },
    { key: 'customer', header: t('col.customer'), width: '190px', render: (r) => <span className="text-xs">{r.customerName}</span> },
    { key: 'detail', header: t('exceptions.detail'), width: '380px', render: (r) => <span className="text-xs">{r.detail}</span> },
    { key: 'at', header: t('exceptions.age'), width: '120px', numeric: true, sortValue: (r) => r.at, render: (r) => <span className="tabular text-muted-foreground text-xs">{relativeAge(r.at)}</span> },
    { key: 'state', header: t('col.status'), width: '150px', pinned: 'right', render: (r) => <span className="bg-muted text-muted-foreground rounded-xs px-2 py-0.5 text-2xs">{r.state}</span> },
  ], [t])

  const loading = deviations.isLoading || requests.isLoading

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader title={t('page.exceptions.title')} description={t('page.exceptions.desc')} stats={[{ label: t('exceptions.open'), value: rows.length, tone: rows.length ? 'attention' : 'good' }]} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiTile label={t('exceptions.kind.deviation')} value={counts.deviation} footnote={t('exceptions.deviationFoot')} icon={CircleAlert} tone={counts.deviation ? 'warning' : 'good'} />
        <KpiTile label={t('exceptions.kind.rejected')} value={counts.rejected} footnote={t('exceptions.rejectedFoot')} icon={XCircle} tone={counts.rejected ? 'warning' : 'good'} />
        <KpiTile label={t('exceptions.kind.overdue')} value={counts.overdue} footnote={t('exceptions.overdueFoot')} icon={AlertTriangle} tone={counts.overdue ? 'warning' : 'good'} />
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('exceptions.kind')}>
        {(['all', 'deviation', 'rejected', 'overdue'] as const).map((k) => (
          <button key={k} role="radio" aria-checked={filter === k} data-exception-filter={k} onClick={() => setFilter(k)} className={cn('rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors', filter === k ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface hover:bg-hover-tint')}>
            {k === 'all' ? t('exceptions.all') : t(`exceptions.kind.${k}` as I18nKey)} · {k === 'all' ? rows.length : counts[k]}
          </button>
        ))}
      </div>

      {loading ? <LoadingRows rows={6} /> : (
        <DataTable name="exceptions" rows={shown} columns={columns} rowKey={(r) => `${r.kind}-${r.id}`} maxHeight={440} empty={t('exceptions.empty')} />
      )}
    </div>
  )
}
