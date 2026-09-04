import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, Truck, Warehouse } from 'lucide-react'
import { api } from '@/services'
import type { YardRow } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { StatusChip } from '@/components/status/StatusChip'
import { PermissionGate } from '@/components/state/PermissionGate'
import { Button } from '@/components/ui/button'
import { LoadingCompleteDialog } from '@/components/yard/LoadingCompleteDialog'
import { useActor } from '@/app/useActor'
import { useAuth } from '@/app/auth'
import { can } from '@/app/permissions'
import { TERMINALS } from '@/fixtures/network'
import { formatTime } from '@/fixtures/calendar'
import { relativeAge } from '@/lib/format'
import { productKey, useT } from '@/i18n'
import { cn } from '@/lib/utils'

const BAYS = [1, 2, 3]

/**
 * The loading board at a terminal: what is on its way in, what is on a bay,
 * what is loaded and waiting to leave. The shipping point owns two clicks —
 * start loading, loading complete — and the second one is where the ERP-owned
 * bill of lading enters the console as an event.
 */
export function YardRoute() {
  const t = useT()
  const qc = useQueryClient()
  const actor = useActor()
  const { session } = useAuth()
  const canLoad = !!session && can(session.role, 'yard.load')
  const [terminalId, setTerminalId] = useState(TERMINALS[0].id)
  const [completing, setCompleting] = useState<YardRow | null>(null)

  const yard = useQuery({ queryKey: ['yard', terminalId], queryFn: () => api.tracking.yard(terminalId) })
  const rows = yard.data ?? []
  const inbound = rows.filter((r) => r.status === 'transit_to_terminal')
  const loading = rows.filter((r) => r.status === 'starting_load')
  const loaded = rows.filter((r) => r.status === 'load_completed')

  const start = useMutation({
    mutationFn: (row: YardRow) => api.tracking.advance(row.orderId, 'starting_load', actor),
    onSuccess: (_res, row) => { toast.success(t('yard.started', { truck: row.truckPlate })); qc.invalidateQueries() },
  })

  const inboundColumns = useMemo<ColumnDef<YardRow>[]>(() => [
    { key: 'truck', header: t('yard.truck'), width: '120px', pinned: 'left', render: (r) => <span className="font-mono text-xs font-medium">{r.truckPlate}</span> },
    { key: 'carrier', header: t('col.carrier'), width: '180px', render: (r) => <span className="text-xs">{r.carrierName}</span> },
    { key: 'order', header: t('col.order'), width: '110px', render: (r) => <Link to={`/orders/${r.orderId}`} className="text-accent-text font-mono text-xs font-medium hover:underline">{r.erpRef}</Link> },
    { key: 'load', header: t('col.product'), width: '170px', render: (r) => <span className="text-xs">{r.tonnes} t {t(productKey(r.product))}</span> },
    { key: 'since', header: t('yard.since'), width: '120px', numeric: true, sortValue: (r) => r.since, render: (r) => <span className="tabular text-muted-foreground text-xs">{relativeAge(r.since)}</span> },
    { key: 'action', header: '', width: '150px', pinned: 'right', render: (r) => canLoad ? (
      <Button size="sm" variant="outline" disabled={start.isPending} onClick={(e) => { e.stopPropagation(); start.mutate(r) }} data-yard-start={r.orderId}>
        {t('yard.start')}<ArrowRight className="size-3.5" aria-hidden />
      </Button>
    ) : null },
  ], [t, start, canLoad])

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.yard.title')}
        description={t('page.yard.desc')}
        stats={[
          { label: t('yard.stat.inbound'), value: inbound.length },
          { label: t('yard.stat.loading'), value: loading.length, tone: loading.length ? 'attention' : 'default' },
          { label: t('yard.stat.loaded'), value: loaded.length },
        ]}
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('order.fact.terminal')}>
        {TERMINALS.map((term) => (
          <button key={term.id} role="tab" aria-selected={terminalId === term.id} data-terminal={term.id} onClick={() => setTerminalId(term.id)} className={cn('rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors', terminalId === term.id ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface hover:bg-hover-tint')}>
            {term.name}
          </button>
        ))}
      </div>

      <section aria-label={t('yard.bays')} className="grid gap-4 md:grid-cols-3 md:items-stretch">
        {BAYS.map((bay) => {
          const row = loading.find((r) => r.bay === bay)
          return (
            <article key={bay} data-bay={bay} data-occupied={!!row} className={cn('flex h-full flex-col rounded-lg border p-4', row ? 'border-accent/40 bg-surface' : 'border-border bg-muted/40 border-dashed')}>
              <header className="flex items-center justify-between gap-2">
                <p className="eyebrow text-muted-foreground">{t('yard.bayN', { n: bay })}</p>
                {row ? <StatusChip status={row.status} /> : <span className="text-muted-foreground text-2xs">{t('yard.bayFree')}</span>}
              </header>
              {row ? (
                <>
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold"><Truck className="text-accent-text size-4" aria-hidden />{row.truckPlate}</p>
                  <dl className="mt-2 flex flex-col gap-1 text-xs">
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.order')}</dt><dd className="font-mono">{row.erpRef}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.customer')}</dt><dd className="truncate">{row.customerName}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.product')}</dt><dd>{row.tonnes} t {t(productKey(row.product))}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('yard.since')}</dt><dd className="tabular">{formatTime(row.since)} · {relativeAge(row.since)}</dd></div>
                  </dl>
                  <PermissionGate capability="yard.load" className="mt-auto pt-4">
                    <Button size="sm" className="mt-auto w-full" data-variant="primary" onClick={() => setCompleting(row)} data-yard-complete={row.orderId}>
                      {t('yard.completeCta')}<ArrowRight className="size-3.5" aria-hidden />
                    </Button>
                  </PermissionGate>
                </>
              ) : (
                <p className="text-muted-foreground mt-auto flex items-center gap-2 pt-6 text-xs"><Warehouse className="size-4" aria-hidden />{t('yard.bayEmpty')}</p>
              )}
            </article>
          )
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px] xl:items-stretch">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t('yard.inbound')} · {inbound.length}</h2>
          <DataTable name="yard-inbound" rows={inbound} columns={inboundColumns} rowKey={(r) => r.orderId} maxHeight={320} empty={t('yard.inboundEmpty')} />
        </section>
        <section className="border-structural-border bg-surface flex h-full flex-col rounded-lg border">
          <header className="border-border border-b px-4 py-3"><h2 className="text-sm font-semibold">{t('yard.loaded')} · {loaded.length}</h2></header>
          {loaded.length === 0 ? (
            <p className="text-muted-foreground px-4 py-4 text-xs">{t('yard.loadedEmpty')}</p>
          ) : (
            <ul className="divide-border flex-1 divide-y">
              {loaded.map((r) => (
                <li key={r.orderId} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                  <Truck className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.truckPlate} · {r.carrierName}</span>
                    <span className="text-muted-foreground block text-2xs">{r.erpRef} · {r.tonnes} t · {t('yard.waitingDepart', { ago: relativeAge(r.since) })}</span>
                  </span>
                  <Link to={`/orders/${r.orderId}`} className="text-accent-text shrink-0 font-medium hover:underline">{t('common.open')}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <LoadingCompleteDialog row={completing} onOpenChange={(o) => !o && setCompleting(null)} />
    </div>
  )
}
