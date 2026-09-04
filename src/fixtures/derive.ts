import {
  ORDER_STATUSES, statusIndex,
  type CarrierRequest, type Deviation, type Order, type OrderStatus, type PodDocument, type Priority, type StatusEvent,
} from '@/types/domain'
import type {
  Eta, HistoryRow, Lane, OrderDetail, OrderDocument, TruckPosition, WorklistFilter, WorklistRow, WorklistSummary,
  YardRow, DispatchColumn, RequestRow, RequestsSummary,
} from '@/services/contracts'
import type { MockState } from '@/services/mock/store'
import { ORDERS, SEED_REQUESTS, SEED_DEVIATIONS, SEED_PODS, LOCKED_ORDER, LOCKED_BY } from './orders'
import { eventChain, laneOf, projectedAt, minutesInto, terminalFor } from './chain'
import { interpolate, travelMinutes } from './geo'
import { CARRIER_BY_ID, CUSTOMER_BY_ID, SHIP_TO_BY_ID, TERMINAL_BY_ID, TRUCK_BY_ID, CARRIERS } from './network'
import { USER_BY_ID } from './people'
import { TODAY, nowIso } from './calendar'
import { SYSTEMS } from '@/app/product'

/**
 * Everything a screen shows is computed here from fixtures ⊕ the store.
 * Components render; they never total.
 */

// ── orders and events ───────────────────────────────────────────────────────

export function allOrders(state: MockState): Order[] {
  return [...ORDERS, ...state.liveOrders]
}

export function orderById(state: MockState, id: string): Order | undefined {
  return state.liveOrders.find((o) => o.id === id) ?? ORDERS.find((o) => o.id === id)
}

/** The carrier actually on the order: the seed, unless the walk changed it. */
export function carrierIdOf(order: Order, state: MockState): string | null {
  const a = state.assignments[order.id]
  if (a === undefined) return order.carrierId
  return a.carrierId
}

export function truckIdOf(order: Order, state: MockState): string | null {
  const a = state.assignments[order.id]
  if (a === undefined) return order.truckId
  return a.truckId
}

export function priorityOf(order: Order, state: MockState): Priority {
  return state.priorities[order.id] ?? order.priority
}

export function eventsOf(order: Order, state: MockState): StatusEvent[] {
  const live = state.events.filter((e) => e.orderId === order.id)
  return [...eventChain(order), ...live].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

export function lastEventOf(order: Order, state: MockState): StatusEvent {
  const ev = eventsOf(order, state)
  return ev[ev.length - 1]
}

export function statusOf(order: Order, state: MockState): OrderStatus {
  return lastEventOf(order, state).status
}

/** A timestamp for a new event: the wall clock, but never before the last
 *  recorded event on the order — clicks made before the authored time of a
 *  seeded event would otherwise sort into the past. */
export function stampFor(order: Order, state: MockState): string {
  const last = Date.parse(lastEventOf(order, state).at)
  return new Date(Math.max(Date.parse(nowIso()), last + 60_000)).toISOString()
}

export function requestsOf(orderId: string, state: MockState): CarrierRequest[] {
  const byId = new Map<string, CarrierRequest>()
  for (const r of SEED_REQUESTS) if (r.orderId === orderId) byId.set(r.id, r)
  for (const r of Object.values(state.requests)) if (r.orderId === orderId) byId.set(r.id, r)
  return [...byId.values()].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt))
}

export function allRequests(state: MockState): CarrierRequest[] {
  const byId = new Map<string, CarrierRequest>()
  for (const r of SEED_REQUESTS) byId.set(r.id, r)
  for (const r of Object.values(state.requests)) byId.set(r.id, r)
  return [...byId.values()]
}

export function openRequestOf(orderId: string, state: MockState): CarrierRequest | undefined {
  return requestsOf(orderId, state).find((r) => r.state === 'sent')
}

export function hasRejection(orderId: string, state: MockState): boolean {
  const rs = requestsOf(orderId, state)
  const lastRejected = [...rs].reverse().find((r) => r.state === 'rejected')
  if (!lastRejected) return false
  /* A rejection followed by a newer request is history, not a flag. */
  return !rs.some((r) => r.state !== 'rejected' && Date.parse(r.sentAt) > Date.parse(lastRejected.sentAt))
}

export function podOf(orderId: string, state: MockState): PodDocument | null {
  return state.pods[orderId] ?? SEED_PODS.find((p) => p.orderId === orderId) ?? null
}

export function deviationsOf(orderId: string, state: MockState): Deviation[] {
  return [...SEED_DEVIATIONS, ...state.deviations].filter((d) => d.orderId === orderId)
}

export function allDeviations(state: MockState): Deviation[] {
  return [...SEED_DEVIATIONS, ...state.deviations]
}

export function lockOf(orderId: string, state: MockState): string | null {
  if (orderId in state.locks) return state.locks[orderId] || null
  return orderId === LOCKED_ORDER ? LOCKED_BY : null
}

// ── lane, position, estimate ────────────────────────────────────────────────

export function laneDetail(order: Order): Lane {
  const l = laneOf(order)
  return {
    path: l.path,
    km: l.km,
    terminal: { id: l.terminal.id, name: l.terminal.name, latLng: l.terminal.latLng },
    shipTo: { id: l.shipTo.id, name: l.shipTo.name, latLng: l.shipTo.latLng },
  }
}

/** 0 before the truck leaves the terminal, 1 once it is on site. */
export function progressOf(order: Order, state: MockState): number {
  const last = lastEventOf(order, state)
  const i = statusIndex(last.status)
  if (i < statusIndex('in_transit')) return 0
  if (i > statusIndex('in_transit')) return 1
  if (state.events.some((e) => e.orderId === order.id && e.status === 'in_transit')) {
    /* Live: distance covered since the truck left, capped so it never
     * arrives before somebody says it has. */
    const elapsed = (Date.parse(nowIso()) - Date.parse(last.at)) / 60_000
    return Math.max(0.05, Math.min(0.93, elapsed / travelMinutes(laneOf(order).km)))
  }
  return order.transitProgress
}

export function etaOf(order: Order, state: MockState): Eta | null {
  const last = lastEventOf(order, state)
  const i = statusIndex(last.status)
  if (i >= statusIndex('on_site')) return null
  const carrierId = carrierIdOf(order, state)
  const lane = laneOf(order)
  const travel = travelMinutes(lane.km)
  let at: number
  if (last.status === 'in_transit') {
    at = Date.parse(last.at) + travel * (1 - progressOf(order, state)) * 60_000
  } else {
    at = Date.parse(projectedAt(order, last, 'on_site', carrierId))
  }
  const basisParts = [`${lane.km} km at ${Math.round(lane.km / (travel / 60))} km/h`]
  if (i < statusIndex('in_transit')) {
    const remaining = ORDER_STATUSES.slice(i + 1, statusIndex('in_transit') + 1)
      .reduce((m, s) => m + minutesInto(order, s, carrierId), 0)
    basisParts.unshift(`${remaining} min to leave the terminal`)
  }
  return {
    at: new Date(at).toISOString(),
    lowAt: new Date(at - 60 * 60_000).toISOString(),
    highAt: new Date(at + 60 * 60_000).toISOString(),
    basis: basisParts.join(' · '),
    progress: progressOf(order, state),
  }
}

export function positionOf(order: Order, state: MockState): TruckPosition | null {
  const status = statusOf(order, state)
  const i = statusIndex(status)
  if (i < statusIndex('transit_to_terminal') || i >= statusIndex('delivery_completed')) return null
  const lane = laneDetail(order)
  const progress = progressOf(order, state)
  const latLng = i < statusIndex('in_transit') ? lane.terminal.latLng : interpolate(lane.path, progress)
  const carrierId = carrierIdOf(order, state)
  return {
    orderId: order.id,
    erpRef: order.erpRef,
    carrierName: carrierId ? CARRIER_BY_ID[carrierId].name : '—',
    customerName: CUSTOMER_BY_ID[order.customerId].name,
    status,
    latLng,
    progress,
    eta: etaOf(order, state)?.at ?? null,
    lane,
  }
}

// ── documents ───────────────────────────────────────────────────────────────

export function documentsOf(order: Order, state: MockState): OrderDocument[] {
  const ev = eventsOf(order, state)
  const docs: OrderDocument[] = []
  const created = ev.find((e) => e.status === 'order_created')
  if (created) {
    docs.push({ id: `DOC-${order.id}-erp`, kind: 'erp_order', title: `${SYSTEMS.erp} order ${order.erpRef}`, issuedAt: created.at, source: SYSTEMS.erp, reference: order.erpRef })
  }
  const loaded = ev.find((e) => e.status === 'load_completed')
  const bol = `BOL-${order.erpRef.slice(-5)}`
  if (loaded) {
    docs.push({ id: `DOC-${order.id}-bol`, kind: 'bol', title: `Bill of lading ${bol}`, issuedAt: loaded.at, source: 'Weigh scale', reference: bol })
  }
  const pod = podOf(order.id, state)
  if (pod) {
    docs.push({ id: `DOC-${order.id}-signed`, kind: 'signed_bol', title: `Signed bill of lading ${pod.bolNumber}`, issuedAt: pod.signedAt, source: pod.source === 'upload' ? SYSTEMS.carrierTms : 'Customer signature', reference: pod.bolNumber })
  }
  const delivered = ev.find((e) => e.status === 'delivery_completed')
  if (delivered) {
    docs.push({ id: `DOC-${order.id}-record`, kind: 'delivery_record', title: 'Delivery record', issuedAt: delivered.at, source: 'Order console', reference: order.id })
    docs.push({ id: `DOC-${order.id}-inv`, kind: 'invoice', title: `${SYSTEMS.billing} invoice`, issuedAt: new Date(Date.parse(delivered.at) + 2 * 3_600_000).toISOString(), source: SYSTEMS.billing, reference: `INV-${order.erpRef.slice(-6)}` })
  }
  return docs
}

// ── rows ────────────────────────────────────────────────────────────────────

/** "Today" for the open book: the last twenty hours, so the day closes out
 *  the same way whatever the wall clock says. */
const RECENT_MS = 20 * 3_600_000
function isToday(iso: string): boolean {
  return Date.parse(nowIso()) - Date.parse(iso) < RECENT_MS
}
void TODAY

export function rowOf(order: Order, state: MockState): WorklistRow {
  const last = lastEventOf(order, state)
  const carrierId = carrierIdOf(order, state)
  const openReq = openRequestOf(order.id, state)
  const shipTo = SHIP_TO_BY_ID[order.shipToId]
  const cvr = USER_BY_ID[order.cvrId]
  return {
    id: order.id,
    erpRef: order.erpRef,
    customerId: order.customerId,
    customerName: CUSTOMER_BY_ID[order.customerId].name,
    shipToName: shipTo.name,
    shipToCity: shipTo.city,
    terminalId: order.terminalId,
    terminalName: TERMINAL_BY_ID[order.terminalId].name,
    carrierId: carrierId ?? openReq?.carrierId ?? null,
    carrierName: carrierId ? CARRIER_BY_ID[carrierId].name : openReq ? CARRIER_BY_ID[openReq.carrierId].name : null,
    status: last.status,
    priority: priorityOf(order, state),
    windowStart: order.window.start,
    windowEnd: order.window.end,
    eta: etaOf(order, state)?.at ?? null,
    tonnes: order.tonnes,
    product: order.product,
    region: shipTo.region,
    cvrId: order.cvrId,
    cvrName: cvr?.name ?? 'Service desk',
    lockedBy: lockOf(order.id, state) ? USER_BY_ID[lockOf(order.id, state)!]?.name ?? null : null,
    rejected: hasRejection(order.id, state) && last.status === 'order_created',
    expedited: openReq?.expedited ?? false,
    isRequest: false,
    statusAt: last.at,
  }
}

/** Portal requests the desk has not sent to the ERP yet, shown as rows. */
export function draftRows(state: MockState): WorklistRow[] {
  return state.orderRequests.map((d) => {
    const shipTo = SHIP_TO_BY_ID[d.shipToId]
    return {
      id: d.id,
      erpRef: '—',
      customerId: d.customerId,
      customerName: CUSTOMER_BY_ID[d.customerId].name,
      shipToName: shipTo.name,
      shipToCity: shipTo.city,
      terminalId: '',
      terminalName: TERMINAL_BY_ID[laneTerminal(d.shipToId)].name,
      carrierId: null,
      carrierName: null,
      status: 'order_created',
      priority: 'standard',
      windowStart: d.windowStart,
      windowEnd: d.windowEnd,
      eta: null,
      tonnes: d.tonnes,
      product: d.product as WorklistRow['product'],
      region: shipTo.region,
      cvrId: 'U-0412',
      cvrName: USER_BY_ID['U-0412'].name,
      lockedBy: null,
      rejected: false,
      expedited: false,
      isRequest: true,
      statusAt: d.at,
    }
  })
}

function laneTerminal(shipToId: string): string {
  return terminalFor(shipToId)
}

/** The open book: every order that has not reached delivery, plus today's
 *  deliveries so the desk sees the day close out. */
export function openRows(state: MockState): WorklistRow[] {
  const rows = allOrders(state)
    .map((o) => rowOf(o, state))
    .filter((r) => r.status !== 'delivery_completed' || isToday(r.statusAt))
  return [...draftRows(state), ...rows].sort((a, b) => Date.parse(b.statusAt) - Date.parse(a.statusAt))
}

export function needsAttention(r: WorklistRow, state: MockState): boolean {
  if (r.isRequest) return false
  if (r.rejected) return true
  const req = openRequestOf(r.id, state)
  if (req && Date.parse(nowIso()) - Date.parse(req.sentAt) > 45 * 60_000) return true
  return allDeviations(state).some((d) => d.orderId === r.id && d.state === 'open')
}

export function filterRows(rows: WorklistRow[], f: WorklistFilter | undefined, state: MockState): WorklistRow[] {
  if (!f) return rows
  let out = rows
  if (f.status && f.status !== 'all') {
    out = f.status === 'needs_attention' ? out.filter((r) => needsAttention(r, state)) : out.filter((r) => r.status === f.status)
  }
  if (f.priority) out = out.filter((r) => r.priority === f.priority)
  if (f.cvrId) out = out.filter((r) => r.cvrId === f.cvrId)
  if (f.customerId) out = out.filter((r) => r.customerId === f.customerId)
  if (f.carrierId) out = out.filter((r) => r.carrierId === f.carrierId)
  if (f.terminalId) out = out.filter((r) => r.terminalId === f.terminalId)
  if (f.region) out = out.filter((r) => r.region === f.region)
  if (f.q) {
    const q = f.q.toLowerCase()
    out = out.filter((r) =>
      [r.id, r.erpRef, r.customerName, r.shipToName, r.shipToCity, r.carrierName ?? '', r.terminalName]
        .some((s) => s.toLowerCase().includes(q)),
    )
  }
  return out
}

export function onTimeOf(order: Order, state: MockState): boolean | null {
  const delivered = eventsOf(order, state).find((e) => e.status === 'delivery_completed')
  if (!delivered) return null
  return Date.parse(delivered.at) <= Date.parse(order.window.end)
}

export function summaryOf(state: MockState): WorklistSummary {
  const rows = openRows(state)
  const deliveredOrders = allOrders(state).filter((o) => statusOf(o, state) === 'delivery_completed')
  const recent = deliveredOrders.filter((o) => Date.parse(nowIso()) - Date.parse(lastEventOf(o, state).at) < 30 * 86_400_000)
  const onTime = recent.filter((o) => onTimeOf(o, state)).length
  return {
    newRequests: rows.filter((r) => r.status === 'order_created').length,
    pendingCarrier: rows.filter((r) => r.status === 'pending_carrier').length,
    inTransit: rows.filter((r) => ['in_transit', 'on_site', 'unloading'].includes(r.status)).length,
    needsAttention: rows.filter((r) => needsAttention(r, state)).length,
    deliveredToday: rows.filter((r) => r.status === 'delivery_completed').length,
    onTimePct: recent.length ? onTime / recent.length : 0,
    dataAsOf: nowIso(),
  }
}

export function detailOf(order: Order, state: MockState): OrderDetail {
  const row = rowOf(order, state)
  const truckId = truckIdOf(order, state)
  const truck = truckId ? TRUCK_BY_ID[truckId] : null
  const pod = podOf(order.id, state)
  const shipTo = SHIP_TO_BY_ID[order.shipToId]
  return {
    ...row,
    shipToId: order.shipToId,
    shipToAddress: `${shipTo.name}, ${shipTo.city}, ${shipTo.province}`,
    customerContact: CUSTOMER_BY_ID[order.customerId].contact,
    truck: truck ? { id: truck.id, plate: truck.plate, driver: truck.driver } : null,
    events: eventsOf(order, state),
    requests: requestsOf(order.id, state).map((r) => ({ ...r, carrierName: CARRIER_BY_ID[r.carrierId].name })),
    documents: documentsOf(order, state),
    deviations: deviationsOf(order.id, state),
    pod,
    lane: laneDetail(order),
    etaDetail: etaOf(order, state),
    note: '',
    createdAt: eventsOf(order, state)[0].at,
    locationMatch: pod ? (state.flags[`mismatch:${order.id}`] ? 'mismatch' : 'match') : 'unknown',
  }
}

export function historyRows(state: MockState): HistoryRow[] {
  return allOrders(state)
    .filter((o) => statusOf(o, state) === 'delivery_completed')
    .map((o) => {
      const carrierId = carrierIdOf(o, state)
      return {
        id: o.id,
        erpRef: o.erpRef,
        customerName: CUSTOMER_BY_ID[o.customerId].name,
        carrierName: carrierId ? CARRIER_BY_ID[carrierId].name : '—',
        shipToName: SHIP_TO_BY_ID[o.shipToId].name,
        deliveredAt: lastEventOf(o, state).at,
        onTime: onTimeOf(o, state) ?? false,
        tonnes: o.tonnes,
        documents: documentsOf(o, state),
        customerId: o.customerId,
        carrierId,
      } as HistoryRow & { customerId: string; carrierId: string | null }
    })
    .sort((a, b) => Date.parse(b.deliveredAt) - Date.parse(a.deliveredAt))
}

// ── requests, yard, dispatch ────────────────────────────────────────────────

export function requestRows(state: MockState): RequestRow[] {
  const now = Date.parse(nowIso())
  return allRequests(state)
    .filter((r) => {
      const o = orderById(state, r.orderId)
      return o && (statusOf(o, state) !== 'delivery_completed' || isToday(lastEventOf(o, state).at))
    })
    .map((r) => {
      const o = orderById(state, r.orderId)!
      const end = r.respondedAt ? Date.parse(r.respondedAt) : now
      const minutesOpen = Math.max(0, Math.round((end - Date.parse(r.sentAt)) / 60_000))
      return {
        requestId: r.id,
        orderId: r.orderId,
        erpRef: o.erpRef,
        carrierId: r.carrierId,
        carrierName: CARRIER_BY_ID[r.carrierId].name,
        customerName: CUSTOMER_BY_ID[o.customerId].name,
        state: r.state,
        sentAt: r.sentAt,
        respondedAt: r.respondedAt,
        minutesOpen,
        overdue: r.state === 'sent' && minutesOpen > 45,
        expedited: r.expedited,
        reminders: r.reminders.length,
        reason: r.reason,
        rank: r.rank,
      }
    })
    .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))
}

export function requestsSummaryOf(state: MockState): RequestsSummary {
  const rows = requestRows(state)
  const answered = allRequests(state).filter((r) => r.respondedAt).map((r) => (Date.parse(r.respondedAt!) - Date.parse(r.sentAt)) / 60_000).sort((a, b) => a - b)
  return {
    open: rows.filter((r) => r.state === 'sent').length,
    overdue: rows.filter((r) => r.overdue).length,
    rejected: rows.filter((r) => r.state === 'rejected' && hasRejection(r.orderId, state)).length,
    medianResponseMinutes: answered.length ? Math.round(answered[Math.floor(answered.length / 2)]) : 0,
  }
}

const YARD_STATUSES: OrderStatus[] = ['transit_to_terminal', 'starting_load', 'load_completed']

export function yardRows(state: MockState, terminalId?: string): YardRow[] {
  return allOrders(state)
    .filter((o) => !terminalId || o.terminalId === terminalId)
    .map((o) => ({ o, last: lastEventOf(o, state) }))
    .filter(({ last }) => YARD_STATUSES.includes(last.status))
    .map(({ o, last }, i) => {
      const carrierId = carrierIdOf(o, state)
      const truckId = truckIdOf(o, state)
      return {
        orderId: o.id,
        erpRef: o.erpRef,
        carrierName: carrierId ? CARRIER_BY_ID[carrierId].name : '—',
        truckPlate: truckId ? TRUCK_BY_ID[truckId].plate : '—',
        status: last.status,
        since: last.at,
        tonnes: o.tonnes,
        product: o.product,
        bay: last.status === 'starting_load' ? (i % 3) + 1 : null,
        customerName: CUSTOMER_BY_ID[o.customerId].name,
      }
    })
    .sort((a, b) => statusIndex(b.status) - statusIndex(a.status) || Date.parse(a.since) - Date.parse(b.since))
}

export function dispatchColumns(state: MockState): DispatchColumn[] {
  const now = Date.parse(nowIso())
  return CARRIERS.map((c) => {
    const loads = allOrders(state)
      .map((o) => ({ o, status: statusOf(o, state), req: openRequestOf(o.id, state) }))
      .filter(({ o, status, req }) =>
        (carrierIdOf(o, state) === c.id && status !== 'delivery_completed' && status !== 'order_created') ||
        (req?.carrierId === c.id && status === 'pending_carrier'),
      )
      .map(({ o, status, req }) => ({
        orderId: o.id,
        erpRef: o.erpRef,
        status,
        customerName: CUSTOMER_BY_ID[o.customerId].name,
        terminalName: TERMINAL_BY_ID[o.terminalId].name,
        shipToCity: SHIP_TO_BY_ID[o.shipToId].city,
        windowEnd: o.window.end,
        stalled: !!req && now - Date.parse(req.sentAt) > 45 * 60_000,
      }))
    const delivered = allOrders(state).filter((o) => carrierIdOf(o, state) === c.id && statusOf(o, state) === 'delivery_completed')
    const onTime = delivered.filter((o) => onTimeOf(o, state)).length
    return {
      carrierId: c.id,
      carrierName: c.name,
      hasTms: c.hasTms,
      onTimePct: delivered.length ? onTime / delivered.length : 0,
      loads,
    }
  }).filter((col) => col.loads.length > 0)
}
