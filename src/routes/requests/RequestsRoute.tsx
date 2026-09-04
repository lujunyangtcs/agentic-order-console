import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bell, Zap } from 'lucide-react'
import { api } from '@/services'
import type { RequestRow } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { LoadingRows } from '@/components/state/States'
import { Button } from '@/components/ui/button'
import { useActor } from '@/app/useActor'
import { formatTime, formatDate } from '@/fixtures/calendar'
import { useLang, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'open' | 'overdue' | 'rejected' | 'answered'

const STATE_CLASS: Record<RequestRow['state'], string> = {
  sent: 'bg-status-pending-bg text-sev-high-on-bg',
  accepted: 'bg-verdict-pass-bg text-verdict-pass',
  rejected: 'bg-sev-critical-bg text-sev-critical-on-bg',
  withdrawn: 'bg-muted text-muted-foreground',
}

/**
 * Requests the desk has sent, who has answered, and who is late. The list
 * page pattern from the donor: header stats, filter chips, a pinned-column
 * table, and the actions on the row.
 */
export function RequestsRoute() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const actor = useActor()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('filter') ?? 'open') as Filter

  const rows = useQuery({ queryKey: ['requests'], queryFn: () => api.carrier.requests() })
  const summary = useQuery({ queryKey: ['requests-summary'], queryFn: () => api.carrier.requestsSummary() })

  const remind = useMutation({
    mutationFn: (id: string) => api.carrier.remind(id, actor),
    onSuccess: (r) => { toast.success(t('order.toast.reminder', { carrier: r.carrierName })); qc.invalidateQueries() },
  })
  const expedite = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api.carrier.expedite(id, on, actor),
    onSuccess: () => { toast.success(t('order.toast.expedite')); qc.invalidateQueries() },
  })

  const all = rows.data ?? []
  const filtered = all.filter((r) => {
    switch (filter) {
      case 'open': return r.state === 'sent'
      case 'overdue': return r.overdue
      case 'rejected': return r.state === 'rejected'
      case 'answered': return r.state !== 'sent'
      default: return true
    }
  })

  const columns = useMemo<ColumnDef<RequestRow>[]>(() => [
    { key: 'order', header: t('col.order'), width: '130px', pinned: 'left', sortValue: (r) => r.erpRef, render: (r) => <Link to={`/orders/${r.orderId}`} className="font-mono text-xs font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{r.erpRef}</Link> },
    { key: 'carrier', header: t('col.carrier'), width: '200px', sortValue: (r) => r.carrierName, render: (r) => <span className="text-xs">{r.carrierName}</span> },
    { key: 'customer', header: t('col.customer'), width: '190px', sortValue: (r) => r.customerName, render: (r) => <span className="text-muted-foreground text-xs">{r.customerName}</span> },
    { key: 'state', header: t('col.state'), width: '130px', sortValue: (r) => r.state, render: (r) => (
      <span className={cn('inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-2xs font-medium', STATE_CLASS[r.state])}>
        {t(`requests.state.${r.state}` as I18nKey)}{r.expedited && <Zap className="size-3" aria-hidden />}
      </span>
    ) },
    { key: 'sent', header: t('col.sent'), width: '150px', numeric: true, sortValue: (r) => r.sentAt, render: (r) => <span className="tabular text-xs">{formatDate(r.sentAt, lang)} {formatTime(r.sentAt)}</span> },
    { key: 'answered', header: t('col.answered'), width: '110px', numeric: true, sortValue: (r) => r.respondedAt ?? '', render: (r) => <span className="tabular text-xs">{r.respondedAt ? formatTime(r.respondedAt) : '—'}</span> },
    { key: 'open', header: t('col.open'), width: '120px', numeric: true, sortValue: (r) => r.minutesOpen, render: (r) => (
      <span className={cn('tabular text-xs', r.overdue && 'text-sev-critical-on-bg font-medium')}>{t('requests.minutes', { n: r.minutesOpen })}{r.overdue ? ` · ${t('requests.overdueHint')}` : ''}</span>
    ) },
    { key: 'rank', header: t('assign.done'), width: '150px', render: (r) => <span className="text-muted-foreground text-xs">{r.rank ? t('requests.rank', { n: r.rank }) : t('requests.manual')}{r.reason ? ` · ${r.reason}` : ''}</span> },
    { key: 'actions', header: '', width: '210px', pinned: 'right', render: (r) => r.state === 'sent' ? (
      <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="outline" disabled={remind.isPending} onClick={() => remind.mutate(r.requestId)} data-remind={r.requestId}><Bell className="size-3.5" aria-hidden />{t('requests.remind')}</Button>
        <Button size="sm" variant="outline" disabled={expedite.isPending} onClick={() => expedite.mutate({ id: r.requestId, on: !r.expedited })} data-expedite={r.requestId}><Zap className="size-3.5" aria-hidden />{t('requests.expedite')}</Button>
      </span>
    ) : (
      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${r.orderId}`) }}>{t('requests.open')}</Button>
    ) },
  ], [t, lang, remind, expedite, navigate])

  const s = summary.data
  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'open', label: t('requests.filter.open'), count: all.filter((r) => r.state === 'sent').length },
    { key: 'overdue', label: t('requests.filter.overdue'), count: all.filter((r) => r.overdue).length },
    { key: 'rejected', label: t('requests.filter.rejected'), count: all.filter((r) => r.state === 'rejected').length },
    { key: 'answered', label: t('requests.filter.answered'), count: all.filter((r) => r.state !== 'sent').length },
    { key: 'all', label: t('requests.filter.all'), count: all.length },
  ]

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.requests.title')}
        description={t('page.requests.desc')}
        stats={[
          { label: t('requests.kpi.open'), value: s?.open ?? '—' },
          { label: t('requests.kpi.overdue'), value: s?.overdue ?? '—', tone: s?.overdue ? 'attention' : 'default' },
          { label: t('requests.kpi.rejected'), value: s?.rejected ?? '—', tone: s?.rejected ? 'attention' : 'default' },
          { label: t('requests.kpi.median'), value: s ? t('requests.minutes', { n: s.medianResponseMinutes }) : '—' },
        ]}
      />
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            data-filter={c.key}
            onClick={() => { const next = new URLSearchParams(params); next.set('filter', c.key); setParams(next, { replace: true }) }}
            className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-150', filter === c.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground hover:bg-hover-tint hover:text-foreground')}
          >
            {c.label}<span className="tabular opacity-70">{c.count}</span>
          </button>
        ))}
      </div>
      {rows.isLoading ? (
        <LoadingRows rows={6} />
      ) : (
        <DataTable name="requests" rows={filtered} columns={columns} rowKey={(r) => r.requestId} maxHeight={440} empty={t('requests.table.empty')} onRowClick={(r) => navigate(`/orders/${r.orderId}`)} />
      )}
    </div>
  )
}
