import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Bell, CheckCircle2, Package, Plus, Truck } from 'lucide-react'
import { api } from '@/services'
import { TodayBand } from '@/components/dashboard/TodayBand'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { Panel } from '@/components/dashboard/Panel'
import { EmptyState } from '@/components/state/States'
import { StatusChip } from '@/components/status/StatusChip'
import { Button } from '@/components/ui/button'
import { RaiseOrderDialog } from '@/components/portal/RaiseOrderDialog'
import { useAuth } from '@/app/auth'
import { CUSTOMER_BY_ID } from '@/fixtures/network'
import { statusIndex } from '@/types/domain'
import { formatDate, formatTime } from '@/fixtures/calendar'
import { productKey, useLang, type I18nKey } from '@/i18n'

/**
 * The customer's home: their orders, where each one is, and one button to
 * ask for more. Same bones as the desk's page, with nothing the customer
 * does not own.
 */
export function PortalRoute() {
  const { t, lang } = useLang()
  const { session } = useAuth()
  const customerId = session?.customerId ?? ''
  const customer = CUSTOMER_BY_ID[customerId]
  const [raising, setRaising] = useState(false)

  const open = useQuery({ queryKey: ['worklist', 'customer', customerId], queryFn: () => api.orders.worklist({ customerId }) })
  const history = useQuery({ queryKey: ['history', 'customer', customerId], queryFn: () => api.orders.history({ customerId }) })
  const notes = useQuery({ queryKey: ['notifications', 'Customer', customerId], queryFn: () => api.notifications.list('Customer', customerId) })

  const rows = open.data ?? []
  const onRoad = rows.filter((r) => statusIndex(r.status) >= statusIndex('in_transit') && r.status !== 'delivery_completed')
  /* Trucks that have arrived and unloaded: the customer's one job is to sign. */
  const toSign = rows.filter((r) => statusIndex(r.status) >= statusIndex('on_site') && r.status !== 'delivery_completed')
  const arrivingNext = [...onRoad].filter((r) => r.eta).sort((a, b) => Date.parse(a.eta!) - Date.parse(b.eta!))[0]
  const delivered30 = (history.data ?? []).filter((h) => Date.parse(h.deliveredAt) > Date.now() - 30 * 86_400_000)
  const onTime = delivered30.length ? delivered30.filter((h) => h.onTime).length / delivered30.length : 0

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6">
      <TodayBand
        title={t('page.portal.title')}
        subtitle={customer?.name ?? ''}
        waiting={onRoad.length}
        unit={onRoad.length === 1 ? t('portal.unit.one') : t('portal.unit.many')}
        headline={onRoad.length === 1 ? t('portal.unit.one') : t('portal.unit.many')}
        primaryLabel={toSign.length ? t('order.action.sign') : t('portal.openNext')}
        secondaryLabel={t('portal.trackAll')}
        metricsLabel={t('portal.stands')}
        severities={[]}
        sentence={open.data ? (arrivingNext ? t('portal.read', { order: arrivingNext.erpRef, city: arrivingNext.shipToCity, time: formatTime(arrivingNext.eta!) }) : t('portal.readQuiet', { n: rows.length })) : null}
        primaryTo={toSign.length ? `/orders/${toSign[0].id}?sign=1` : arrivingNext ? `/orders/${arrivingNext.id}` : null}
        secondaryTo="/track"
        metrics={[
          { label: t('portal.metric.open'), value: rows.length },
          { label: t('portal.metric.delivered'), value: delivered30.length },
          { label: t('portal.metric.onTime'), value: `${Math.round(onTime * 100)}%` },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiTile label={t('portal.kpi.open')} value={rows.length} icon={Package} tone="neutral" footnote={t('portal.kpi.openFoot')} />
        <KpiTile label={t('portal.kpi.road')} value={onRoad.length} icon={Truck} tone="neutral" footnote={t('portal.kpi.roadFoot')} />
        <KpiTile label={t('portal.kpi.onTime')} value={onTime} unit="%" icon={CheckCircle2} tone={onTime >= 0.9 ? 'good' : 'warning'} footnote={t('portal.kpi.onTimeFoot')} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-stretch">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{t('portal.orders')}</h2>
            <Button size="sm" onClick={() => setRaising(true)} data-raise-open data-variant="primary"><Plus className="size-3.5" aria-hidden />{t('portal.raise')}</Button>
          </div>
          {toSign.length > 0 && (
            <section data-card="to-sign" className="border-accent/40 bg-status-scheduled-bg rounded-lg border p-4">
              <p className="eyebrow text-accent-text">{t('portal.toSignTitle')}</p>
              <p className="mt-1 text-sm font-semibold">{toSign.length === 1 ? t('portal.toSign.one') : t('portal.toSign.many', { n: toSign.length })}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {toSign.map((r) => (
                  <li key={r.id} className="bg-surface border-border flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5" data-to-sign={r.id}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-semibold">{r.erpRef}</span>
                      <span className="text-muted-foreground block text-xs">{r.shipToName} · {r.tonnes} t {t(productKey(r.product))} · {r.carrierName}</span>
                    </span>
                    <StatusChip status={r.status} rejected={false} />
                    <Button asChild size="sm" data-variant="primary"><Link to={`/orders/${r.id}?sign=1`} data-sign-link={r.id}>{t('order.action.sign')}</Link></Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {rows.length === 0 ? (
            <EmptyState title={t('portal.empty')} />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 md:items-stretch">
              {rows.map((r) => (
                <li key={r.id} className="h-full">
                  <Link to={`/orders/${r.id}`} data-portal-order={r.id} className="border-structural-border bg-surface flex h-full flex-col rounded-lg border p-4 lift lift-link focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-muted-foreground eyebrow">{r.shipToName}</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold">{r.isRequest ? t('worklist.request') : r.erpRef}</p>
                      </div>
                      <StatusChip status={r.status} rejected={false} />
                    </div>
                    <dl className="mt-3 flex flex-col gap-1 text-xs">
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.product')}</dt><dd>{r.tonnes} t {t(productKey(r.product))}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.window')}</dt><dd className="tabular">{formatDate(r.windowStart, lang)} {formatTime(r.windowStart)}–{formatTime(r.windowEnd)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.eta')}</dt><dd className="tabular">{r.eta ? formatTime(r.eta) : '—'}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.carrier')}</dt><dd className="truncate">{r.carrierName ?? '—'}</dd></div>
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Panel title={t('portal.recent')} action={{ label: t('nav.notifications'), to: '/notifications' }} className="h-full">
          {(notes.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-xs">{t('notifications.empty')}</p>
          ) : (
            <ul className="divide-border divide-y">
              {(notes.data ?? []).slice(0, 6).map((n) => (
                <li key={n.id} className="flex items-start gap-2 py-2 text-xs">
                  <Bell className={n.read ? 'text-muted-foreground mt-0.5 size-3.5 shrink-0' : 'text-accent-text mt-0.5 size-3.5 shrink-0'} aria-hidden />
                  <span className="min-w-0">
                    <span className="block leading-snug">{t(n.textKey as I18nKey, n.params)}</span>
                    <span className="text-muted-foreground tabular block text-2xs">{formatTime(n.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <RaiseOrderDialog customerId={customerId} open={raising} onOpenChange={setRaising} />
    </div>
  )
}
