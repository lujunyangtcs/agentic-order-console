import { ORDER_STATUSES, type Order, type OrderStatus, type StatusEvent } from '@/types/domain'
import { LOAD_MIN, lanePath, pathKm, travelMinutes } from './geo'
import { CARRIER_BY_ID, LANES, RESPONSE_MINUTES, SHIP_TO_BY_ID, TERMINAL_BY_ID } from './network'
import { SYSTEMS } from '@/app/product'

/**
 * How long each stage takes, in minutes, for the seeded chain.
 *
 * Authored once here so the timeline, the estimated arrival, the hours-per-
 * stage report and the scorecard all agree. Two stages are not constants:
 * the carrier's answer takes as long as that carrier usually takes, and the
 * drive takes as long as the lane is.
 */
export const DWELL: Partial<Record<OrderStatus, number>> = {
  pending_carrier: 20,       // desk sends the request
  transit_to_terminal: 180,  // truck released and driving to the terminal
  starting_load: 25,         // queue at the scale
  load_completed: LOAD_MIN,
  in_transit: 10,            // paperwork and pull-out
  unloading: 8,
  delivery_completed: 5,     // signature after the last bag is out
}

/** Stable small integer from a string, for deterministic jitter. */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function laneOf(order: Pick<Order, 'terminalId' | 'shipToId'>) {
  const terminal = TERMINAL_BY_ID[order.terminalId]
  const shipTo = SHIP_TO_BY_ID[order.shipToId]
  const path = lanePath(terminal.id, terminal.latLng, shipTo.id, shipTo.latLng)
  return { terminal, shipTo, path, km: pathKm(path) }
}

export function terminalFor(shipToId: string): string {
  return LANES[shipToId]
}

/** Minutes the stage BEFORE `status` lasts — i.e. the gap between the
 *  previous status and this one. */
export function minutesInto(order: Order, status: OrderStatus, carrierId: string | null): number {
  switch (status) {
    case 'order_created': return 0
    case 'order_scheduled': {
      const base = carrierId ? RESPONSE_MINUTES[carrierId] ?? 30 : 30
      const jitter = (hash(order.id + status) % 21) - 10
      return Math.max(4, base + jitter)
    }
    case 'on_site': return travelMinutes(laneOf(order).km)
    case 'unload_completed': return SHIP_TO_BY_ID[order.shipToId].unloadMinutes
    default: return DWELL[status] ?? 15
  }
}

function actorFor(status: OrderStatus, order: Order, carrierId: string | null): { actor: string; source: StatusEvent['source']; note?: string } {
  const carrier = carrierId ? CARRIER_BY_ID[carrierId]?.name ?? 'Carrier' : 'Carrier'
  switch (status) {
    case 'order_created': return { actor: SYSTEMS.erp, source: 'erp', note: `${SYSTEMS.erp} order ${order.erpRef} received` }
    case 'pending_carrier': return { actor: 'Service desk', source: 'console', note: 'Carrier request sent' }
    case 'order_scheduled': return { actor: carrier, source: 'carrier', note: 'Request accepted' }
    case 'load_completed': return { actor: 'Weigh scale', source: 'scale', note: `Bill of lading printed at the scale (${SYSTEMS.erp})` }
    case 'delivery_completed': return { actor: 'Customer', source: 'customer', note: 'Bill of lading signed' }
    default: return { actor: carrier, source: 'carrier' }
  }
}

/**
 * Expand an authored `{ target, startAt }` into the timestamped chain up to
 * and including the target status.
 */
export function eventChain(order: Order): StatusEvent[] {
  const target = order.seed.target
  const end = ORDER_STATUSES.indexOf(target)
  let at = Date.parse(order.seed.startAt)
  const out: StatusEvent[] = []
  for (let i = 0; i <= end; i += 1) {
    const status = ORDER_STATUSES[i]
    at += minutesInto(order, status, order.carrierId) * 60_000
    const a = actorFor(status, order, order.carrierId)
    out.push({
      id: `EV-${order.id}-${i}`,
      orderId: order.id,
      status,
      at: new Date(at).toISOString(),
      actor: a.actor,
      source: a.source,
      note: a.note,
    })
  }
  return out
}

/** When the chain would reach `status` if it ran uninterrupted from the last
 *  recorded event — the basis of the estimated arrival. */
export function projectedAt(order: Order, from: StatusEvent, status: OrderStatus, carrierId: string | null): string {
  const start = ORDER_STATUSES.indexOf(from.status)
  const end = ORDER_STATUSES.indexOf(status)
  let at = Date.parse(from.at)
  for (let i = start + 1; i <= end; i += 1) at += minutesInto(order, ORDER_STATUSES[i], carrierId) * 60_000
  return new Date(at).toISOString()
}
