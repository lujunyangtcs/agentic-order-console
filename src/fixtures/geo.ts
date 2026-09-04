import type { LatLng } from '@/types/domain'

/**
 * Road geometry, simplified.
 *
 * Every lane is a terminal, a ship-to, and one or two waypoints that bend the
 * line the way the highway bends. Distances are great-circle along that
 * polyline with a 1.18 road factor, which lands within a few percent of the
 * real driving distance for the corridors in the fixture.
 */

/** Average loaded speed the estimate uses, km/h. */
export const AVG_KMH = 72
/** Minutes from arriving at the terminal to leaving loaded. */
export const LOAD_MIN = 45
/** Road distance ÷ straight line, for these corridors. */
const ROAD_FACTOR = 1.18

const R = 6371

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function pathKm(path: LatLng[]): number {
  let km = 0
  for (let i = 1; i < path.length; i += 1) km += haversineKm(path[i - 1], path[i])
  return Math.round(km * ROAD_FACTOR)
}

/** Waypoints between specific terminal → ship-to pairs, so a route follows
 *  the highway rather than cutting across a lake. Keyed `${terminalId}>${shipToId}`. */
const VIA: Record<string, LatLng[]> = {
  'TERM-BATH>ST-02': [[44.60, -76.15], [45.10, -75.80]],
  'TERM-BATH>ST-11': [[44.20, -77.05]],
  'TERM-STCON>ST-02': [[45.40, -74.30], [45.45, -75.10]],
  'TERM-MISS>ST-05': [[43.45, -79.75]],
  'TERM-EXSHAW>ST-07': [[51.10, -114.80]],
  'TERM-RICH>ST-10': [[49.13, -122.95]],
}

export function lanePath(terminalId: string, terminal: LatLng, shipToId: string, shipTo: LatLng): LatLng[] {
  const via = VIA[`${terminalId}>${shipToId}`] ?? []
  return [terminal, ...via, shipTo]
}

/** Point along a polyline at 0–1 of its length. */
export function interpolate(path: LatLng[], progress: number): LatLng {
  const p = Math.max(0, Math.min(1, progress))
  const segs: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i += 1) {
    const k = haversineKm(path[i - 1], path[i])
    segs.push(k)
    total += k
  }
  if (total === 0) return path[0]
  let target = p * total
  for (let i = 0; i < segs.length; i += 1) {
    if (target <= segs[i] || i === segs.length - 1) {
      const f = segs[i] === 0 ? 0 : Math.max(0, Math.min(1, target / segs[i]))
      const a = path[i], b = path[i + 1]
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
    }
    target -= segs[i]
  }
  return path[path.length - 1]
}

export function travelMinutes(km: number): number {
  return Math.round((km / AVG_KMH) * 60)
}
