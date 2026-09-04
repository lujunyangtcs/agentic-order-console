import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { LatLng, OrderStatus } from '@/types/domain'
import { interpolate } from '@/fixtures/geo'
import { statusKey, useT } from '@/i18n'
import { formatTime } from '@/fixtures/calendar'
import { cn } from '@/lib/utils'

/**
 * The map.
 *
 * Real tiles when the room has a network, a drawn schematic when it does not
 * — same props, same markers, same behaviour. Trucks move once, from where
 * they were to where they are, when a status changes; nothing loops.
 */
export interface MapPlace {
  id: string
  name: string
  latLng: LatLng
}

export interface MapRoute {
  orderId: string
  erpRef: string
  path: LatLng[]
  progress: number
  status: OrderStatus
  carrierName: string
  customerName: string
  eta: string | null
  /** True when the truck is at or before the terminal (not on the lane yet). */
  atTerminal: boolean
}

export interface TrackMapProps {
  terminals: MapPlace[]
  sites: MapPlace[]
  routes: MapRoute[]
  focusOrderId?: string | null
  onSelect?: (orderId: string) => void
  className?: string
  /** For verification: skip tiles and render the schematic. */
  forceSvg?: boolean
}

/* Esri's light grey canvas: no API key, attribution only. CARTO's free
   basemaps started stamping "API key required" on every tile. */
const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const ATTRIBUTION = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'

function icon(kind: 'terminal' | 'site' | 'truck', label?: string, active?: boolean) {
  const cls = kind === 'terminal' ? 'map-pin map-pin--terminal' : kind === 'site' ? 'map-pin map-pin--site' : cn('map-pin map-pin--truck', active && 'map-pin--active')
  const html = kind === 'truck'
    ? `<span class="${cls}"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg><b>${label ?? ''}</b></span>`
    : `<span class="${cls}"><b>${label ?? ''}</b></span>`
  return L.divIcon({ html, className: 'map-pin-wrap', iconSize: kind === 'truck' ? [92, 22] : [10, 10], iconAnchor: kind === 'truck' ? [46, 11] : [5, 5] })
}

/** Fit the view to the points once per key, so a status change does not
 *  yank the map around under the presenter. */
function FitBounds({ points, fitKey }: { points: LatLng[]; fitKey: string }) {
  const map = useMap()
  const done = useRef<string>('')
  useEffect(() => {
    if (!points.length || done.current === fitKey) return
    done.current = fitKey
    const b = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])))
    map.fitBounds(b.pad(0.25), { animate: false, maxZoom: 10 })
    // The map may already be gone when this fires (route change, StrictMode
    // remount); sizing a removed map throws inside Leaflet.
    const id = window.setTimeout(() => { if (map.getContainer()?.isConnected) map.invalidateSize() }, 50)
    return () => window.clearTimeout(id)
  }, [map, points, fitKey])
  return null
}

/** Tween each truck from its last drawn progress to the new one, once. */
function useTweenedProgress(routes: MapRoute[]): Record<string, number> {
  const [shown, setShown] = useState<Record<string, number>>({})
  const last = useRef<Record<string, number>>({})
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const targets = Object.fromEntries(routes.map((r) => [r.orderId, r.progress]))
    const from = { ...last.current }
    const changed = routes.filter((r) => from[r.orderId] !== undefined && from[r.orderId] !== r.progress)
    if (reduced || changed.length === 0) {
      last.current = targets
      setShown(targets)
      return
    }
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 4000)
      const eased = 1 - (1 - k) ** 3
      const next: Record<string, number> = { ...targets }
      for (const r of changed) next[r.orderId] = from[r.orderId] + (r.progress - from[r.orderId]) * eased
      setShown(next)
      if (k < 1) raf = requestAnimationFrame(step)
      else last.current = targets
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [routes])
  return shown
}

export function TrackMap({ terminals, sites, routes, focusOrderId, onSelect, className, forceSvg }: TrackMapProps) {
  const [tileErrors, setTileErrors] = useState(0)
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const useSvg = forceSvg || offline || tileErrors >= 6
  const shown = useTweenedProgress(routes)

  const focus = routes.find((r) => r.orderId === focusOrderId)
  const points = useMemo<LatLng[]>(() => {
    if (focus) return focus.path
    return [...terminals.map((p) => p.latLng), ...sites.map((p) => p.latLng), ...routes.flatMap((r) => r.path)]
  }, [focus, terminals, sites, routes])
  const fitKey = focus ? `focus:${focus.orderId}` : `all:${routes.length}:${terminals.length}`

  const truckPos = (r: MapRoute): LatLng => (r.atTerminal ? r.path[0] : interpolate(r.path, shown[r.orderId] ?? r.progress))

  if (useSvg) {
    return <SvgMap terminals={terminals} sites={sites} routes={routes} shown={shown} focusOrderId={focusOrderId} onSelect={onSelect} className={className} />
  }

  return (
    <div data-map="leaflet" className={cn('relative h-full min-h-[320px] w-full overflow-hidden rounded-lg', className)}>
      <MapContainer key="track-map" center={[52, -96]} zoom={4} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer url={TILES} attribution={ATTRIBUTION} subdomains="abcd" eventHandlers={{ tileerror: () => setTileErrors((n) => n + 1) }} />
        <FitBounds points={points} fitKey={fitKey} />
        {routes.map((r) => (
          <Polyline
            key={`lane-${r.orderId}`}
            positions={r.path}
            pathOptions={{ color: focusOrderId && focusOrderId !== r.orderId ? '#93b4ff' : '#1963ff', weight: focusOrderId === r.orderId ? 4 : 2.5, opacity: 0.85, dashArray: r.atTerminal ? '4 6' : undefined }}
          />
        ))}
        {terminals.map((p) => (
          <Marker key={p.id} position={p.latLng} icon={icon('terminal')}>
            <Popup>{p.name}</Popup>
          </Marker>
        ))}
        {sites.map((p) => (
          <Marker key={p.id} position={p.latLng} icon={icon('site')}>
            <Popup>{p.name}</Popup>
          </Marker>
        ))}
        {routes.map((r) => (
          <TruckMarker key={`truck-${r.orderId}`} route={r} position={truckPos(r)} active={focusOrderId === r.orderId} onSelect={onSelect} />
        ))}
      </MapContainer>
    </div>
  )
}

function TruckMarker({ route: r, position, active, onSelect }: { route: MapRoute; position: LatLng; active: boolean; onSelect?: (id: string) => void }) {
  const t = useT()
  return (
    <Marker
      position={position}
      icon={icon('truck', r.erpRef, active)}
      zIndexOffset={active ? 1000 : 100}
      eventHandlers={{ click: () => onSelect?.(r.orderId) }}
    >
      <Popup>
        <div className="text-xs">
          <p className="font-mono font-semibold">{r.erpRef}</p>
          <p>{r.carrierName} · {r.customerName}</p>
          <p>{t(statusKey(r.status))}{r.eta ? ` · ${t('track.eta')} ${formatTime(r.eta)}` : ''}</p>
        </div>
      </Popup>
    </Marker>
  )
}

/** The schematic: an equirectangular projection over the points, drawn in
 *  the house tokens. Same props, same click behaviour. */
function SvgMap({ terminals, sites, routes, shown, focusOrderId, onSelect, className }: {
  terminals: MapPlace[]; sites: MapPlace[]; routes: MapRoute[]; shown: Record<string, number>
  focusOrderId?: string | null; onSelect?: (id: string) => void; className?: string
}) {
  const t = useT()
  const W = 1000, H = 560, PAD = 60
  const all = [...terminals.map((p) => p.latLng), ...sites.map((p) => p.latLng), ...routes.flatMap((r) => r.path)]
  const lats = all.map((p) => p[0]), lngs = all.map((p) => p[1])
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const sx = (W - 2 * PAD) / Math.max(0.5, maxLng - minLng)
  const sy = (H - 2 * PAD) / Math.max(0.5, maxLat - minLat)
  const s = Math.min(sx, sy)
  const x = (lng: number) => PAD + (lng - minLng) * s + ((W - 2 * PAD) - (maxLng - minLng) * s) / 2
  const y = (lat: number) => H - PAD - (lat - minLat) * s - ((H - 2 * PAD) - (maxLat - minLat) * s) / 2
  return (
    <div data-map="svg" className={cn('bg-muted/40 border-border relative h-full min-h-[320px] w-full overflow-hidden rounded-lg border', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={t('track.schematic')}>
        {routes.map((r) => (
          <polyline key={`l-${r.orderId}`} points={r.path.map((p) => `${x(p[1])},${y(p[0])}`).join(' ')} fill="none" stroke={focusOrderId && focusOrderId !== r.orderId ? 'var(--map-route-done)' : 'var(--map-route)'} strokeWidth={focusOrderId === r.orderId ? 4 : 2.5} strokeDasharray={r.atTerminal ? '4 6' : undefined} />
        ))}
        {terminals.map((p) => (
          <g key={p.id}>
            <rect x={x(p.latLng[1]) - 6} y={y(p.latLng[0]) - 6} width={12} height={12} fill="var(--map-terminal)" />
            <text x={x(p.latLng[1]) + 10} y={y(p.latLng[0]) + 4} fontSize={12} fill="var(--foreground)">{p.name}</text>
          </g>
        ))}
        {sites.map((p) => (
          <g key={p.id}>
            <circle cx={x(p.latLng[1])} cy={y(p.latLng[0])} r={6} fill="var(--map-site)" />
            <text x={x(p.latLng[1]) + 10} y={y(p.latLng[0]) + 4} fontSize={11} fill="var(--muted-foreground)">{p.name}</text>
          </g>
        ))}
        {routes.map((r) => {
          const p = r.atTerminal ? r.path[0] : interpolate(r.path, shown[r.orderId] ?? r.progress)
          const active = focusOrderId === r.orderId
          return (
            <g key={`t-${r.orderId}`} onClick={() => onSelect?.(r.orderId)} className="cursor-pointer" data-svg-truck={r.orderId}>
              <rect x={x(p[1]) - 34} y={y(p[0]) - 11} width={68} height={22} rx={11} fill={active ? 'var(--accent)' : 'var(--map-truck)'} />
              <text x={x(p[1])} y={y(p[0]) + 4} fontSize={11} textAnchor="middle" fill="#fff" fontFamily="ui-monospace, monospace">{r.erpRef}</text>
            </g>
          )
        })}
      </svg>
      <p className="text-muted-foreground absolute right-2 bottom-2 rounded-xs bg-white/80 px-1.5 py-0.5 text-2xs">{t('track.schematic')}</p>
    </div>
  )
}
