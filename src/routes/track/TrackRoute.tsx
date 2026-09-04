import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Truck, Warehouse } from 'lucide-react'
import { api } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { EmptyState } from '@/components/state/States'
import { StatusChip } from '@/components/status/StatusChip'
import { TrackMap, type MapRoute } from '@/components/map/TrackMap'
import { useAuth } from '@/app/auth'
import { useScope } from '@/app/useActor'
import { TERMINALS, SHIP_TOS } from '@/fixtures/network'
import { statusIndex } from '@/types/domain'
import { formatTime } from '@/fixtures/calendar'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Where every truck is. The desk sees all of them; a customer sees their
 * own; a carrier sees its fleet. Click a row or a pin to focus the lane.
 */
export function TrackRoute() {
  const t = useT()
  const navigate = useNavigate()
  const { session } = useAuth()
  const scope = useScope()
  const [params] = useSearchParams()
  const [focus, setFocus] = useState<string | null>(params.get('order'))
  const forceSvg = params.get('map') === 'svg'

  const scopeArg = session?.role === 'Customer' ? { customerId: scope } : session?.role === 'Carrier' ? { carrierId: scope } : undefined
  const positions = useQuery({ queryKey: ['positions', scopeArg], queryFn: () => api.tracking.positions(scopeArg), refetchInterval: 30_000 })

  const routes = useMemo<MapRoute[]>(() => (positions.data ?? []).map((p) => ({
    orderId: p.orderId,
    erpRef: p.erpRef,
    path: p.lane.path,
    progress: p.progress,
    status: p.status,
    carrierName: p.carrierName,
    customerName: p.customerName,
    eta: p.eta,
    atTerminal: statusIndex(p.status) < statusIndex('in_transit'),
  })), [positions.data])

  const moving = routes.filter((r) => r.status === 'in_transit').length
  const atTerminal = routes.filter((r) => r.atTerminal).length
  const onSite = routes.filter((r) => statusIndex(r.status) >= statusIndex('on_site')).length

  const usedTerminalIds = new Set((positions.data ?? []).map((p) => p.lane.terminal.id))
  const usedSiteIds = new Set((positions.data ?? []).map((p) => p.lane.shipTo.id))
  const terminals = TERMINALS.filter((x) => usedTerminalIds.has(x.id) || routes.length === 0).map((x) => ({ id: x.id, name: x.name, latLng: x.latLng }))
  const sites = SHIP_TOS.filter((x) => usedSiteIds.has(x.id)).map((x) => ({ id: x.id, name: x.name, latLng: x.latLng }))

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader title={t('page.track.title')} description={t('page.track.desc')} stats={[{ label: t('track.trucks'), value: routes.length }]} />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiTile label={t('track.moving')} value={moving} icon={Truck} tone="neutral" footnote={t('track.movingFoot')} />
        <KpiTile label={t('track.atTerminal')} value={atTerminal} icon={Warehouse} tone="neutral" footnote={t('track.atTerminalFoot')} />
        <KpiTile label={t('track.onSite')} value={onSite} icon={MapPin} tone="good" footnote={t('track.onSiteFoot')} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-stretch">
        <section data-card="map" className="border-structural-border bg-surface flex h-[560px] flex-col rounded-lg border p-2">
          {positions.data && routes.length === 0 ? (
            <EmptyState title={t('track.empty')} />
          ) : (
            <TrackMap terminals={terminals} sites={sites} routes={routes} focusOrderId={focus} onSelect={(id) => setFocus(id)} forceSvg={forceSvg} className="h-full" />
          )}
        </section>

        <section data-card="trucks" className="border-structural-border bg-surface flex h-[560px] flex-col rounded-lg border">
          <header className="border-border border-b px-4 py-3"><h2 className="text-sm font-semibold">{t('track.list')}</h2></header>
          <ul className="divide-border flex-1 divide-y overflow-y-auto">
            {routes.map((r) => (
              <li key={r.orderId}>
                <button
                  type="button"
                  data-truck-row={r.orderId}
                  onClick={() => setFocus(r.orderId)}
                  onDoubleClick={() => navigate(`/orders/${r.orderId}`)}
                  className={cn('flex w-full flex-col gap-1 px-4 py-2.5 text-left text-xs transition-colors hover:bg-hover-tint focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none', focus === r.orderId && 'bg-muted')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium">{r.erpRef}</span>
                    <StatusChip status={r.status} />
                  </span>
                  <span className="text-muted-foreground truncate">{r.carrierName} · {r.customerName}</span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="bg-muted h-1 flex-1 overflow-hidden rounded-xs"><span className="bg-accent block h-full" style={{ width: `${Math.round(r.progress * 100)}%` }} /></span>
                    <span className="tabular text-muted-foreground shrink-0">{r.eta ? `${t('track.eta')} ${formatTime(r.eta)}` : '—'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {focus && (
            <footer className="border-border border-t px-4 py-2.5">
              <button type="button" className="text-accent-text text-xs font-medium hover:underline" onClick={() => navigate(`/orders/${focus}`)} data-open-focused>
                {t('requests.open')} →
              </button>
            </footer>
          )}
        </section>
      </div>
    </div>
  )
}
