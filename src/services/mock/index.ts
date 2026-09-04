import type {
  Actor, AdvanceResult, Api, ArchModule, AuditEntry, Connector, InboxRow, NotificationView, RequestRow, WorklistRow,
} from '../contracts'
import {
  ORDER_STATUSES, statusIndex, type CarrierRequest, type Deviation, type Notification, type Order, type OrderStatus,
  type PodDocument, type Priority, type Role, type StatusEvent, type Ticket, type User,
} from '@/types/domain'
import { respond } from './latency'
import { whenReady, mutate, getState, type MockState } from './store'
import { nowIso, ts } from '@/fixtures/calendar'
import { SYSTEMS } from '@/app/product'
import { CARRIER_BY_ID, CARRIERS, CUSTOMER_BY_ID, SHIP_TO_BY_ID, TRUCK_BY_ID, trucksOf, TERMINAL_BY_ID } from '@/fixtures/network'
import { USERS, TICKETS, SECURITY_DEFAULT } from '@/fixtures/people'
import { terminalFor, hash } from '@/fixtures/chain'
import { translate } from '@/i18n'
import {
  allOrders, orderById, carrierIdOf, eventsOf, lastEventOf, statusOf, stampFor, allRequests,
  openRequestOf, podOf, priorityOf, documentsOf, openRows, filterRows, summaryOf, detailOf, historyRows,
  positionOf, etaOf, yardRows, dispatchColumns, requestRows, requestsSummaryOf, allDeviations, needsAttention, lockOf,
} from '@/fixtures/derive'
import { recommendFor } from '@/fixtures/recommend'
import { evaluateRules, rulesOf, notificationsFor } from '@/fixtures/notify'
import { scorecardRows, benchmarkSeries, workloadCells, buildReport, eventLog, liveAnalytics } from '@/fixtures/analytics'

/**
 * The mock backend. Reads are fixtures ⊕ store deltas, computed in
 * `src/fixtures`; every mutation lands in the store, appends an audit entry,
 * and returns the consequence so the UI can show it.
 */

// ── helpers ────────────────────────────────────────────────────────────────

let seq = 0
function newId(prefix: string): string {
  seq += 1
  return `${prefix}-${Date.now().toString(36).slice(-5)}${seq}`
}

function audit(state: MockState, actor: Actor, entity: string, action: string, extra: Partial<AuditEntry> = {}, at = nowIso()): AuditEntry {
  const entry: AuditEntry = { id: newId('AUD'), at, actor: `${actor.name} (${actor.role})`, entity, action, ...extra }
  state.audit.unshift(entry)
  return entry
}

function sourceFor(actor: Actor, status: OrderStatus): StatusEvent['source'] {
  if (status === 'load_completed') return 'scale'
  switch (actor.role) {
    case 'Carrier': return 'carrier'
    case 'Customer': return 'customer'
    case 'Other Stakeholder': return 'console'
    default: return 'console'
  }
}

function pushEvent(state: MockState, order: Order, status: OrderStatus, actor: Actor, note?: string, source?: StatusEvent['source']): StatusEvent {
  const at = stampFor(order, state)
  const ev: StatusEvent = {
    id: newId('EV'),
    orderId: order.id,
    status,
    at,
    actor: actor.role === 'Carrier' ? CARRIER_BY_ID[carrierIdOf(order, state) ?? '']?.name ?? actor.name : actor.name,
    source: source ?? sourceFor(actor, status),
    note,
  }
  state.events.push(ev)
  return ev
}

function fire(state: MockState, order: Order, trigger: Parameters<typeof evaluateRules>[1], at: string, extra?: Record<string, string>): Notification[] {
  const ns = evaluateRules(rulesOf(state), trigger, order, carrierIdOf(order, state), priorityOf(order, state), at, extra)
  state.notifications.unshift(...ns)
  return ns
}

function result(state: MockState, order: Order, event: StatusEvent | null, notifications: Notification[], entries: AuditEntry[]): AdvanceResult {
  return { orderId: order.id, event, notifications, documents: documentsOf(order, state), audit: entries }
}

function view(state: MockState, n: Notification): NotificationView {
  const o = orderById(state, n.orderId)
  return {
    ...n,
    text: translate('en', n.textKey as never, n.params),
    erpRef: o?.erpRef ?? n.params.order ?? '',
  }
}

async function order(id: string): Promise<{ state: MockState; order: Order }> {
  const state = await whenReady()
  const o = orderById(state, id)
  if (!o) throw new Error(`Unknown order ${id}`)
  return { state, order: o }
}

/** Advance one status, with everything that follows from it. */
function advanceTo(state: MockState, o: Order, next: OrderStatus, actor: Actor, note?: string): AdvanceResult {
  const current = statusOf(o, state)
  if (statusIndex(next) <= statusIndex(current)) {
    return result(state, o, null, [], [])
  }
  const entries: AuditEntry[] = []
  const notifications: Notification[] = []
  let ev: StatusEvent | null = null
  /* Skipped stages are recorded too, a minute apart, so the timeline never
   * has a hole — a customer signing straight from "on site" still leaves
   * unloading and unload-complete stamps behind it. */
  for (let i = statusIndex(current) + 1; i <= statusIndex(next); i += 1) {
    const s = ORDER_STATUSES[i]
    const isTarget = s === next
    ev = pushEvent(state, o, s, actor, isTarget ? note : undefined, s === 'load_completed' ? 'scale' : undefined)
    notifications.push(...fire(state, o, s, ev.at))
  }
  entries.push(audit(state, actor, o.erpRef, `Status → ${next.replace(/_/g, ' ')}`, { before: current.replace(/_/g, ' '), after: next.replace(/_/g, ' ') }, ev!.at))
  if (next === 'delivery_completed') {
    entries.push(audit(state, { name: SYSTEMS.erp, role: 'Administrator' }, o.erpRef, 'Carrier payment released', { externalReference: `PAY-${o.erpRef.slice(-6)}` }, ev!.at))
    entries.push(audit(state, { name: SYSTEMS.billing, role: 'Administrator' }, o.erpRef, 'Customer invoice issued', { externalReference: `INV-${o.erpRef.slice(-6)}` }, ev!.at))
  }
  return result(state, o, ev, notifications, entries)
}

function inboxRowOf(state: MockState, r: CarrierRequest, o: Order): InboxRow {
  const shipTo = SHIP_TO_BY_ID[o.shipToId]
  return {
    requestId: r.id,
    orderId: o.id,
    erpRef: o.erpRef,
    customerName: CUSTOMER_BY_ID[o.customerId].name,
    terminalName: TERMINAL_BY_ID[o.terminalId].name,
    shipToName: shipTo.name,
    shipToCity: shipTo.city,
    tonnes: o.tonnes,
    product: o.product,
    windowStart: o.window.start,
    windowEnd: o.window.end,
    priority: priorityOf(o, state),
    sentAt: r.sentAt,
    expedited: r.expedited,
    reminders: r.reminders.length,
    state: r.state,
    trucks: trucksOf(r.carrierId).map((t) => ({ id: t.id, plate: t.plate, driver: t.driver })),
  }
}

function requestRowOf(state: MockState, id: string): RequestRow {
  const row = requestRows(state).find((r) => r.requestId === id)
  if (!row) throw new Error(`Unknown request ${id}`)
  return row
}

const SEED_AUDIT: AuditEntry[] = (() => {
  const out: AuditEntry[] = []
  return out
})()

function auditEntries(state: MockState): AuditEntry[] {
  const seeded: AuditEntry[] = allRequests(state)
    .filter((r) => r.respondedAt)
    .slice(0, 60)
    .map((r) => ({
      id: `AUD-${r.id}`,
      at: r.respondedAt!,
      actor: `${CARRIER_BY_ID[r.carrierId].name} (Carrier)`,
      entity: orderById(state, r.orderId)?.erpRef ?? r.orderId,
      action: r.state === 'accepted' ? 'Request accepted' : 'Request declined',
      after: r.state === 'accepted' ? 'order scheduled' : r.reason,
      evidence: `EDI message from ${SYSTEMS.carrierTms}`,
    }))
  return [...state.audit, ...SEED_AUDIT, ...seeded].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

// ── static admin content ──────────────────────────────────────────────────

const ARCHITECTURE: ArchModule[] = [
  { id: 'hub', name: 'Order console', kind: 'hub', state: 'live', direction: 'both', detail: 'Events, rules, roles and every screen in this demo.', exchanges: ['Status events', 'Carrier requests', 'Notifications', 'Documents'] },
  { id: 'erp', name: `${SYSTEMS.erp} orders`, kind: 'system', state: 'live', direction: 'in', detail: 'Order number and order lines arrive when the order is created; bills of lading arrive from the scale.', exchanges: ['Order number', 'Bill of lading', 'Carrier payment'] },
  { id: 'ora', name: SYSTEMS.orders, kind: 'system', state: 'live', direction: 'in', detail: 'The order-entry tool the desk types into. Orders flow through it into the ERP.', exchanges: ['Order request'] },
  { id: 'billing', name: SYSTEMS.billing, kind: 'system', state: 'live', direction: 'out', detail: 'Receives the signed bill of lading so the customer can be invoiced.', exchanges: ['Signed bill of lading'] },
  { id: 'scale', name: 'Weigh scale', kind: 'system', state: 'live', direction: 'in', detail: 'Prints the bill of lading when the truck passes the scale; the console records the moment.', exchanges: ['Load completed'] },
  { id: 'tms', name: 'Carrier systems', kind: 'channel', state: 'live', direction: 'both', detail: 'Requests go out and truck statuses come back over EDI or API. Carriers without a system use the portal.', exchanges: ['Request', 'Accept / reject', 'Truck status', 'Signed bill of lading'] },
  { id: 'notify', name: 'Notification gateway', kind: 'channel', state: 'live', direction: 'out', detail: 'Email, portal and SMS delivery for every rule that fires.', exchanges: ['Email', 'Portal', 'SMS'] },
  { id: 'itsm', name: SYSTEMS.itsm, kind: 'system', state: 'live', direction: 'both', detail: 'Application registration and new-user requests.', exchanges: ['Service ticket'] },
  { id: 'eta', name: SYSTEMS.eta, kind: 'module', state: 'planned', direction: 'in', detail: 'A third-party arrival-time feed to refine the estimate beyond distance and speed.', exchanges: ['Estimated arrival'] },
  { id: 'vmi', name: 'Vendor-managed inventory', kind: 'module', state: 'planned', direction: 'both', detail: 'Silo levels from customer sites, so orders can be raised before the customer calls.', exchanges: ['Silo level', 'Suggested order'] },
  { id: 'bidding', name: 'Freight bidding', kind: 'module', state: 'planned', direction: 'both', detail: 'Ask several carriers to price extra volume in peak weeks.', exchanges: ['Bid request', 'Bid'] },
]

const CONNECTORS: Connector[] = [
  { id: 'erp-sync', name: `${SYSTEMS.erp} — orders and bills of lading`, connected: true, freshness: 'fresh', objects: ['Order', 'Order line', 'Bill of lading'], records: 160, recordsLabel: 'Orders this quarter', lastSync: ts(0, '04:52'), writeBack: 'Signed bill of lading (optional)', mappingIssues: 0, permissions: 'Read orders and bills of lading. Write the signed bill of lading only.', direction: 'both', evidence: 'Order numbers on every worklist row come from this feed.' },
  { id: 'erp-async', name: `${SYSTEMS.erp} — master data`, connected: true, freshness: 'fresh', objects: ['Customer', 'Ship-to', 'Carrier', 'Contract rate'], records: 33, recordsLabel: 'Master records', lastSync: ts(0, '03:00'), writeBack: null, mappingIssues: 1, permissions: 'Read only, nightly, with an immediate refresh when the desk asks.', direction: 'in', note: 'One ship-to is missing a postal code; the map uses the site coordinates instead.' },
  { id: 'ora', name: `${SYSTEMS.orders} — order entry`, connected: true, freshness: 'fresh', objects: ['Order request'], records: 5, recordsLabel: 'Requests today', lastSync: ts(0, '04:52'), writeBack: null, mappingIssues: 0, permissions: 'Read only. Orders are created there, never here.', direction: 'in' },
  { id: 'billing', name: `${SYSTEMS.billing} — invoicing`, connected: true, freshness: 'delayed', objects: ['Signed bill of lading', 'Invoice'], records: 118, recordsLabel: 'Documents sent', lastSync: ts(-1, '23:10'), writeBack: 'Signed bill of lading', mappingIssues: 0, permissions: 'Write the signed bill of lading. Read invoice status.', direction: 'out', note: 'Batch runs overnight; documents signed today are sent tonight.' },
  { id: 'edi', name: 'Carrier systems — EDI and API', connected: true, freshness: 'fresh', objects: ['Request', 'Acceptance', 'Truck status', 'Signed bill of lading'], records: CARRIERS.filter((c) => c.hasTms).length, recordsLabel: 'Connected carriers', lastSync: ts(0, '04:58'), writeBack: 'Carrier request', mappingIssues: 0, permissions: 'Send requests. Receive statuses and documents.', direction: 'both', evidence: `${CARRIERS.filter((c) => !c.hasTms).length} carriers without a system use the portal instead.` },
  { id: 'eta', name: `${SYSTEMS.eta} — arrival times`, connected: false, freshness: null, objects: ['Estimated arrival', 'Truck position'], records: null, lastSync: null, writeBack: null, mappingIssues: 0, permissions: 'Would read positions and arrival estimates.', direction: 'in', note: 'Estimates today come from distance and speed. A provider feed is a planned module.' },
]

// ── the API ────────────────────────────────────────────────────────────────

export const mockApi: Api = {
  orders: {
    async worklist(filter) {
      const state = await whenReady()
      return respond(filterRows(openRows(state), filter, state))
    },
    async summary() {
      const state = await whenReady()
      return respond(summaryOf(state))
    },
    async detail(orderId) {
      const state = await whenReady()
      const draft = state.orderRequests.find((d) => d.id === orderId)
      if (draft) {
        const row = openRows(state).find((r) => r.id === orderId)!
        const shipTo = SHIP_TO_BY_ID[draft.shipToId]
        const terminal = TERMINAL_BY_ID[terminalFor(draft.shipToId)]
        return respond({
          ...row,
          shipToId: draft.shipToId,
          shipToAddress: `${shipTo.name}, ${shipTo.city}, ${shipTo.province}`,
          truck: null,
          events: [],
          requests: [],
          documents: [],
          deviations: [],
          pod: null,
          lane: { path: [terminal.latLng, shipTo.latLng], km: 0, terminal: { id: terminal.id, name: terminal.name, latLng: terminal.latLng }, shipTo: { id: shipTo.id, name: shipTo.name, latLng: shipTo.latLng } },
          etaDetail: null,
          note: draft.note,
          createdAt: draft.at,
          locationMatch: 'unknown',
        })
      }
      const o = orderById(state, orderId)
      return respond(o ? detailOf(o, state) : null)
    },
    async history(filter) {
      const state = await whenReady()
      let rows = historyRows(state) as (ReturnType<typeof historyRows>[number] & { customerId: string; carrierId: string | null })[]
      if (filter?.customerId) rows = rows.filter((r) => r.customerId === filter.customerId)
      if (filter?.carrierId) rows = rows.filter((r) => r.carrierId === filter.carrierId)
      if (filter?.q) {
        const q = filter.q.toLowerCase()
        rows = rows.filter((r) => [r.id, r.erpRef, r.customerName, r.carrierName, r.shipToName].some((s) => s.toLowerCase().includes(q)))
      }
      return respond(rows)
    },
    async lock(orderId) {
      const state = await whenReady()
      const by = lockOf(orderId, state)
      return respond(by ? { orderId, by: USERS.find((u) => u.id === by)?.name ?? by, since: ts(0, '04:40') } : null)
    },
    async setPriority(orderId, priority, actor) {
      const { state, order: o } = await order(orderId)
      const before = priorityOf(o, state)
      let entry!: AuditEntry
      await mutate((s) => {
        s.priorities[orderId] = priority
        entry = audit(s, actor, o.erpRef, 'Priority changed', { before, after: priority })
      })
      return respond(result(getState(), o, null, [], [entry]))
    },
    async raiseRequest(draft) {
      const state = await whenReady()
      const id = `SO-${1100 + state.orderRequests.length + state.liveOrders.length}`
      const at = nowIso()
      await mutate((s) => {
        s.orderRequests.unshift({ id, customerId: draft.customerId, shipToId: draft.shipToId, product: draft.product, tonnes: draft.tonnes, windowStart: draft.windowStart, windowEnd: draft.windowEnd, note: draft.note, at })
        audit(s, { name: CUSTOMER_BY_ID[draft.customerId].name, role: 'Customer' }, id, 'Order request raised in the portal', { after: `${draft.tonnes} t ${draft.product} to ${SHIP_TO_BY_ID[draft.shipToId].city}` }, at)
      })
      return respond(openRows(getState()).find((r) => r.id === id) as WorklistRow)
    },
    async createInErp(orderId, actor) {
      const state = await whenReady()
      const draft = state.orderRequests.find((d) => d.id === orderId)
      if (!draft) {
        const o = orderById(state, orderId)
        if (!o) throw new Error(`Unknown order ${orderId}`)
        return respond(result(state, o, null, [], []))
      }
      const erpRef = String(4501200 + (hash(orderId) % 700))
      const startAt = nowIso()
      const o: Order = {
        id: orderId,
        erpRef,
        customerId: draft.customerId,
        shipToId: draft.shipToId,
        terminalId: terminalFor(draft.shipToId),
        product: draft.product as Order['product'],
        tonnes: draft.tonnes,
        window: { start: draft.windowStart, end: draft.windowEnd },
        priority: 'standard',
        cvrId: 'U-0412',
        carrierId: null,
        truckId: null,
        transitProgress: 0,
        seed: { target: 'order_created', startAt },
      }
      let entries: AuditEntry[] = []
      let ns: Notification[] = []
      await mutate((s) => {
        s.orderRequests = s.orderRequests.filter((d) => d.id !== orderId)
        s.liveOrders.push(o)
        entries = [
          audit(s, actor, orderId, `Sent to ${SYSTEMS.orders} / ${SYSTEMS.erp}`, { evidence: 'Synchronous integration', externalReference: erpRef }, startAt),
        ]
        ns = fire(s, o, 'order_created', startAt)
      })
      const fresh = getState()
      return respond(result(fresh, o, eventsOf(o, fresh)[0], ns, entries))
    },
    async exceptions() {
      const state = await whenReady()
      return respond(openRows(state).filter((r) => needsAttention(r, state)))
    },
  },

  carrier: {
    async recommend(orderId) {
      const { state, order: o } = await order(orderId)
      return respond(recommendFor(o, state), 900)
    },
    async request(orderId, carrierId, rank, actor) {
      const { state, order: o } = await order(orderId)
      const open = openRequestOf(orderId, state)
      let entries: AuditEntry[] = []
      let ns: Notification[] = []
      let ev: StatusEvent | null = null
      await mutate((s) => {
        const at = stampFor(o, s)
        if (open) s.requests[open.id] = { ...open, state: 'withdrawn', respondedAt: at }
        const r: CarrierRequest = { id: newId('RQ'), orderId, carrierId, rank, state: 'sent', sentAt: at, respondedAt: null, reminders: [], expedited: false, by: actor.name }
        s.requests[r.id] = r
        if (statusOf(o, s) === 'order_created') {
          ev = pushEvent(s, o, 'pending_carrier', actor, `Request sent to ${CARRIER_BY_ID[carrierId].name}`)
        }
        entries = [audit(s, actor, o.erpRef, `Request sent to ${CARRIER_BY_ID[carrierId].name}`, { evidence: rank ? `Suggested carrier #${rank}` : 'Chosen from the full list', after: 'pending carrier' }, at)]
        ns = fire(s, o, 'pending_carrier', at, { carrier: CARRIER_BY_ID[carrierId].name })
      })
      return respond(result(getState(), o, ev, ns, entries))
    },
    async remind(requestId, actor) {
      await whenReady()
      await mutate((s) => {
        const r = s.requests[requestId] ?? allRequests(s).find((x) => x.id === requestId)
        if (!r) throw new Error(`Unknown request ${requestId}`)
        const at = nowIso()
        s.requests[requestId] = { ...r, reminders: [...r.reminders, at] }
        audit(s, actor, orderById(s, r.orderId)?.erpRef ?? r.orderId, `Reminder sent to ${CARRIER_BY_ID[r.carrierId].name}`, {}, at)
      })
      return respond(requestRowOf(getState(), requestId))
    },
    async expedite(requestId, on, actor) {
      await whenReady()
      await mutate((s) => {
        const r = s.requests[requestId] ?? allRequests(s).find((x) => x.id === requestId)
        if (!r) throw new Error(`Unknown request ${requestId}`)
        s.requests[requestId] = { ...r, expedited: on }
        audit(s, actor, orderById(s, r.orderId)?.erpRef ?? r.orderId, on ? 'Marked expedite' : 'Expedite removed')
      })
      return respond(requestRowOf(getState(), requestId))
    },
    async requests() {
      const state = await whenReady()
      return respond(requestRows(state))
    },
    async requestsSummary() {
      const state = await whenReady()
      return respond(requestsSummaryOf(state))
    },
    async inbox(carrierId) {
      const state = await whenReady()
      const rows = allRequests(state)
        .filter((r) => r.carrierId === carrierId && (r.state === 'sent' || r.state === 'accepted' || r.state === 'rejected'))
        .map((r) => ({ r, o: orderById(state, r.orderId) }))
        .filter((x): x is { r: CarrierRequest; o: Order } => !!x.o)
        .filter(({ r, o }) => r.state === 'sent' || Date.parse(r.respondedAt ?? '') > Date.parse(ts(-1, '00:00')) || statusOf(o, state) !== 'delivery_completed')
        .map(({ r, o }) => inboxRowOf(state, r, o))
        .sort((a, b) => (a.state === 'sent' ? -1 : 1) - (b.state === 'sent' ? -1 : 1) || Date.parse(b.sentAt) - Date.parse(a.sentAt))
      return respond(rows.slice(0, 12))
    },
    async loads(carrierId) {
      const state = await whenReady()
      return respond(openRows(state).filter((r) => r.carrierId === carrierId && !r.isRequest && r.status !== 'order_created' && r.status !== 'pending_carrier'))
    },
    async respond(requestId, decision, options, actor) {
      const state = await whenReady()
      const r = state.requests[requestId] ?? allRequests(state).find((x) => x.id === requestId)
      if (!r) throw new Error(`Unknown request ${requestId}`)
      const o = orderById(state, r.orderId)
      if (!o) throw new Error(`Unknown order ${r.orderId}`)
      const carrier = CARRIER_BY_ID[r.carrierId]
      let entries: AuditEntry[] = []
      let ns: Notification[] = []
      let ev: StatusEvent | null = null
      await mutate((s) => {
        const at = stampFor(o, s)
        if (decision === 'accept') {
          const truckId = options.truckId ?? trucksOf(r.carrierId)[0]?.id ?? null
          s.requests[requestId] = { ...r, state: 'accepted', respondedAt: at, truckId: truckId ?? undefined }
          s.assignments[o.id] = { carrierId: r.carrierId, truckId, at, by: carrier.name }
          ev = pushEvent(s, o, 'order_scheduled', { name: carrier.name, role: 'Carrier' }, `Accepted · ${truckId ? TRUCK_BY_ID[truckId]?.plate : 'truck to be confirmed'}`, 'carrier')
          entries = [audit(s, { name: carrier.name, role: 'Carrier' }, o.erpRef, 'Request accepted', { after: 'order scheduled', evidence: carrier.hasTms ? `EDI message from ${SYSTEMS.carrierTms}` : 'Carrier portal' }, at)]
          ns = fire(s, o, 'order_scheduled', at)
        } else {
          const reason = options.reason ?? 'No capacity in the window'
          s.requests[requestId] = { ...r, state: 'rejected', respondedAt: at, reason }
          delete s.assignments[o.id]
          s.assignments[o.id] = { carrierId: null as unknown as string, truckId: null, at, by: carrier.name }
          ev = pushEvent(s, o, 'order_created', { name: carrier.name, role: 'Carrier' }, `Declined by ${carrier.name}: ${reason}`, 'carrier')
          entries = [audit(s, { name: carrier.name, role: 'Carrier' }, o.erpRef, 'Request declined', { after: reason, evidence: carrier.hasTms ? `EDI message from ${SYSTEMS.carrierTms}` : 'Carrier portal' }, at)]
          ns = fire(s, o, 'request_rejected', at, { reason, carrier: carrier.name })
        }
      })
      void actor
      return respond(result(getState(), o, ev, ns, entries))
    },
    async reassign(orderId, carrierId, actor) {
      return mockApi.carrier.request(orderId, carrierId, 0, actor)
    },
    async scorecard(weights) {
      const state = await whenReady()
      return respond(scorecardRows(state, weights))
    },
    async carriers() {
      await whenReady()
      return respond(CARRIERS.map((c) => ({ id: c.id, name: c.name, hasTms: c.hasTms })))
    },
  },

  tracking: {
    async timeline(orderId) {
      const { state, order: o } = await order(orderId)
      return respond(eventsOf(o, state))
    },
    async advance(orderId, next, actor) {
      const { order: o } = await order(orderId)
      let out!: AdvanceResult
      await mutate((s) => {
        out = advanceTo(s, o, next, actor)
      })
      return respond({ ...out, documents: documentsOf(o, getState()) })
    },
    async positions(scope) {
      const state = await whenReady()
      const rows = allOrders(state)
        .filter((o) => !scope?.customerId || o.customerId === scope.customerId)
        .filter((o) => !scope?.carrierId || carrierIdOf(o, state) === scope.carrierId)
        .map((o) => positionOf(o, state))
        .filter((p): p is NonNullable<typeof p> => p !== null)
      return respond(rows)
    },
    async eta(orderId) {
      const { state, order: o } = await order(orderId)
      return respond(etaOf(o, state), 700)
    },
    async yard(terminalId) {
      const state = await whenReady()
      return respond(yardRows(state, terminalId))
    },
    async dispatchBoard() {
      const state = await whenReady()
      return respond(dispatchColumns(state))
    },
  },

  pod: {
    async get(orderId) {
      const state = await whenReady()
      return respond(podOf(orderId, state))
    },
    async sign(orderId, signature, actor) {
      const { order: o } = await order(orderId)
      let out!: AdvanceResult
      await mutate((s) => {
        const at = stampFor(o, s)
        const pod: PodDocument = {
          id: `EPOD-${o.id}`, orderId: o.id, bolNumber: `BOL-${o.erpRef.slice(-5)}`, source: 'signature',
          signedBy: signature.signedBy, signedAt: at, signaturePng: signature.signaturePng, file: null, annotations: [], archivedAt: at,
        }
        s.pods[o.id] = pod
        out = advanceTo(s, o, 'delivery_completed', actor, `Signed by ${signature.signedBy}`)
        out.audit.push(audit(s, actor, o.erpRef, 'Bill of lading signed', { evidence: 'Electronic signature captured on site', externalReference: pod.bolNumber }, at))
        out.audit.push(audit(s, { name: SYSTEMS.billing, role: 'Administrator' }, o.erpRef, `Signed bill of lading sent to ${SYSTEMS.billing}`, { externalReference: `DOC-${o.erpRef.slice(-6)}` }, at))
      })
      return respond({ ...out, documents: documentsOf(o, getState()) })
    },
    async upload(orderId, file, actor) {
      const { order: o } = await order(orderId)
      let out!: AdvanceResult
      await mutate((s) => {
        const at = stampFor(o, s)
        const pod: PodDocument = {
          id: `EPOD-${o.id}`, orderId: o.id, bolNumber: `BOL-${o.erpRef.slice(-5)}`, source: 'upload',
          signedBy: 'Site receiver', signedAt: at, signaturePng: null, file, annotations: [], archivedAt: at,
        }
        s.pods[o.id] = pod
        out = advanceTo(s, o, 'delivery_completed', actor, `Signed bill of lading uploaded (${file.name})`)
        out.notifications.push(...fire(s, o, 'bol_uploaded', at))
        out.audit.push(audit(s, actor, o.erpRef, 'Signed bill of lading uploaded', { evidence: file.name, externalReference: pod.bolNumber }, at))
      })
      return respond({ ...out, documents: documentsOf(o, getState()) })
    },
    async annotate(orderId, text, actor) {
      const { state, order: o } = await order(orderId)
      const existing = podOf(orderId, state)
      if (!existing) throw new Error('No proof of delivery to annotate')
      await mutate((s) => {
        const at = nowIso()
        s.pods[orderId] = { ...existing, annotations: [...existing.annotations, { by: `${actor.name} (${actor.role})`, at, text }] }
        audit(s, actor, o.erpRef, 'Proof of delivery annotated', { after: text }, at)
      })
      return respond(podOf(orderId, getState())!)
    },
    async fileDeviation(orderId, draft, actor) {
      const { order: o } = await order(orderId)
      let dev!: Deviation
      await mutate((s) => {
        const at = nowIso()
        dev = { id: newId('DEV'), orderId, kind: draft.kind, qtyDelta: draft.qtyDelta, note: draft.note, filedBy: `${actor.name} (${actor.role})`, filedAt: at, state: 'open' }
        s.deviations.unshift(dev)
        s.flags[`mismatch:${orderId}`] = draft.kind === 'handover_issue'
        audit(s, actor, o.erpRef, 'Delivery problem reported', { after: `${draft.kind.replace(/_/g, ' ')}${draft.qtyDelta ? ` (${draft.qtyDelta > 0 ? '+' : ''}${draft.qtyDelta} t)` : ''}` }, at)
        fire(s, o, 'deviation_filed', at)
      })
      return respond(dev)
    },
    async deviations(filter) {
      const state = await whenReady()
      return respond(
        allDeviations(state)
          .filter((dv) => !filter?.orderId || dv.orderId === filter.orderId)
          .map((dv) => {
            const o = orderById(state, dv.orderId)
            return { ...dv, erpRef: o?.erpRef ?? '', customerName: o ? CUSTOMER_BY_ID[o.customerId].name : '' }
          })
          .sort((a, b) => Date.parse(b.filedAt) - Date.parse(a.filedAt)),
      )
    },
  },

  notifications: {
    async list(audience, scope) {
      const state = await whenReady()
      return respond(notificationsFor(state, audience, scope).map((n) => view(state, n)))
    },
    async unreadCount(audience, scope) {
      const state = await whenReady()
      return respond(notificationsFor(state, audience, scope).filter((n) => !n.read).length)
    },
    async markRead(id) {
      await mutate((s) => {
        if (!s.reads.includes(id)) s.reads.push(id)
      })
    },
    async markAllRead(audience, scope) {
      const state = await whenReady()
      const ids = notificationsFor(state, audience, scope).map((n) => n.id)
      await mutate((s) => {
        for (const id of ids) if (!s.reads.includes(id)) s.reads.push(id)
      })
    },
    async rules() {
      const state = await whenReady()
      return respond(rulesOf(state))
    },
    async saveRule(rule) {
      await whenReady()
      await mutate((s) => {
        const current = rulesOf(s)
        const exists = current.some((r) => r.id === rule.id)
        s.rules = exists ? current.map((r) => (r.id === rule.id ? rule : r)) : [...current, rule]
        audit(s, { name: 'Administrator', role: 'Administrator' }, rule.name, exists ? 'Notification rule changed' : 'Notification rule created', { after: `${rule.trigger.replace(/_/g, ' ')} → ${rule.audience} via ${rule.channels.join(', ')}` })
      })
      return respond(rulesOf(getState()))
    },
    async deleteRule(id) {
      await whenReady()
      await mutate((s) => {
        const current = rulesOf(s)
        s.rules = current.filter((r) => r.id !== id)
        audit(s, { name: 'Administrator', role: 'Administrator' }, id, 'Notification rule deleted')
      })
      return respond(rulesOf(getState()))
    },
    async channels() {
      return respond(['email', 'portal', 'sms'])
    },
  },

  reports: {
    async build(spec) {
      const state = await whenReady()
      return respond(buildReport(state, spec), 500)
    },
    async saved() {
      const state = await whenReady()
      return respond(state.reports)
    },
    async save(spec) {
      await whenReady()
      await mutate((s) => {
        s.reports.unshift({ ...spec, id: newId('RPT'), createdAt: nowIso() })
        audit(s, { name: 'Service desk', role: 'CVC User' }, spec.name, 'Report saved', { after: `${spec.measure} by ${spec.dimension}` })
      })
      return respond(getState().reports)
    },
    async benchmark() {
      const state = await whenReady()
      return respond(benchmarkSeries(state))
    },
    async workload() {
      const state = await whenReady()
      return respond(workloadCells(state))
    },
    async eventLog(filter) {
      const state = await whenReady()
      return respond(eventLog(state, filter))
    },
    async audit() {
      const state = await whenReady()
      return respond(auditEntries(state))
    },
    async live() {
      const state = await whenReady()
      return respond(liveAnalytics(state))
    },
  },

  admin: {
    async users() {
      const state = await whenReady()
      return respond(state.users ?? USERS)
    },
    async createUser(user, actor) {
      const state = await whenReady()
      const current = state.users ?? USERS
      const n = current.length + 1
      const ticket: Ticket = { id: newId('TCK'), system: 'ServiceNow', key: `RITM00${49000 + n}`, state: 'open', subject: `Console access for ${user.name} (${user.role})`, userId: '', createdAt: nowIso() }
      const created: User = { id: `U-${String(600 + n).padStart(4, '0')}`, name: user.name, email: user.email, role: user.role, stakeholderKind: user.stakeholderKind, region: user.region, active: true, mfaEnrolled: false, ticketId: ticket.id }
      ticket.userId = created.id
      await mutate((s) => {
        s.users = [...current, created]
        s.tickets.unshift(ticket)
        audit(s, actor, created.email, 'User created', { after: created.role, externalReference: ticket.key })
      })
      return respond({ user: created, ticket })
    },
    async setRole(userId, role, actor) {
      const state = await whenReady()
      const current = state.users ?? USERS
      const u = current.find((x) => x.id === userId)
      if (!u) throw new Error(`Unknown user ${userId}`)
      await mutate((s) => {
        s.users = current.map((x) => (x.id === userId ? { ...x, role } : x))
        audit(s, actor, u.email, 'Role changed', { before: u.role, after: role })
      })
      return respond({ ...u, role })
    },
    async tickets() {
      const state = await whenReady()
      return respond([...state.tickets, ...TICKETS])
    },
    async security() {
      const state = await whenReady()
      return respond(state.security ?? SECURITY_DEFAULT)
    },
    async setSecurity(patch, actor) {
      const state = await whenReady()
      const before = state.security ?? SECURITY_DEFAULT
      await mutate((s) => {
        s.security = { ...before, ...patch }
        audit(s, actor, 'Security settings', 'Setting changed', { before: JSON.stringify(before), after: JSON.stringify(s.security) })
      })
      return respond(getState().security!)
    },
    async architecture() {
      await whenReady()
      return respond(ARCHITECTURE)
    },
  },

  activity: {
    async recent(limit) {
      const state = await whenReady()
      const items = eventLog(state, { limit }).map((e) => ({
        id: e.id,
        text: `${e.erpRef} · ${e.customerName} · ${e.status.replace(/_/g, ' ')}`,
        at: e.at,
        tone: (e.status === 'delivery_completed' ? 'good' : e.note?.startsWith('Declined') ? 'attention' : 'neutral') as 'good' | 'attention' | 'neutral',
        to: `/orders/${e.orderId}`,
      }))
      return respond(items)
    },
  },

  integrations: {
    async connectors() {
      await whenReady()
      return respond(CONNECTORS)
    },
  },
}

export type { Role, Priority }
export { lastEventOf }
