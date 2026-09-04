import type { CarrierRequest, Deviation, Order, OrderStatus, PodDocument, Priority, Product } from '@/types/domain'
import { ts, ago, ahead } from './calendar'
import { CARRIERS, RELIABILITY, SHIP_TOS, SHIP_TO_BY_ID, carriersServing, trucksOf } from './network'
import { CVRS } from './people'
import { eventChain, hash, terminalFor } from './chain'

/**
 * Orders: forty open across every status, and a hundred and twenty delivered
 * over the last ninety days so the scorecard and the benchmark have volume.
 *
 * Three heroes carry the walk:
 *   SO-1042  T1 — just created, Bath → Kingston, no carrier yet.
 *   SO-1051  T3 — request pending with Capital Carriers, who will reject it.
 *   SO-1037  locked by another desk user, for the "already being worked" banner.
 *
 * Today's orders are authored relative to start-up (see `ago`), so a click
 * made during the walk always sorts after the seeded events.
 */

export const HERO_T1 = 'SO-1042'
export const HERO_T3 = 'SO-1051'
export const LOCKED_ORDER = 'SO-1037'
export const LOCKED_BY = 'U-0418'

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PRODUCTS: Product[] = ['GU', 'GU', 'GU', 'HE', 'GUL', 'MS']
const cvrFor = (shipToId: string): string => (SHIP_TO_BY_ID[shipToId].region === 'WCAN' ? 'U-0433' : CVRS[hash(shipToId) % 3].id)

function erpRef(n: number): string {
  return String(4500000 + n)
}

type Seed = [
  id: string, shipToId: string, product: Product, tonnes: number, priority: Priority,
  target: OrderStatus, startAt: string, windowStart: string, windowEnd: string,
  carrierId: string | null, progress: number,
]

/**
 * Today's open book, hand-authored relative to start-up.
 *
 * `ago(n)` is the moment the seeded chain started; the statuses that follow
 * are placed by the chain's dwell times, so an order authored to be
 * "in transit" started long enough ago to have loaded. Windows are minutes
 * ahead of now. Heroes are the first two rows.
 */
const OPEN: Seed[] = [
  // order_created (5) — received from the system of record minutes ago
  ['SO-1042', 'ST-01', 'GU', 34, 'priority', 'order_created', ago(9), ahead(300), ahead(540), null, 0],
  ['SO-1043', 'ST-06', 'GUL', 38, 'standard', 'order_created', ago(24), ahead(360), ahead(600), null, 0],
  ['SO-1044', 'ST-03', 'GU', 36, 'standard', 'order_created', ago(41), ahead(1440), ahead(1680), null, 0],
  ['SO-1045', 'ST-09', 'HE', 34, 'urgent', 'order_created', ago(15), ahead(330), ahead(510), null, 0],
  ['SO-1046', 'ST-05', 'GU', 38, 'standard', 'order_created', ago(58), ahead(1500), ahead(1740), null, 0],
  // pending_carrier (6) — request sent, answer not yet in
  ['SO-1051', 'ST-02', 'GU', 34, 'priority', 'pending_carrier', ago(32), ahead(330), ahead(570), 'CAR-D', 0],
  ['SO-1052', 'ST-04', 'MS', 36, 'standard', 'pending_carrier', ago(38), ahead(1440), ahead(1680), 'CAR-C', 0],
  ['SO-1053', 'ST-07', 'GU', 38, 'standard', 'pending_carrier', ago(74), ahead(420), ahead(660), 'CAR-H', 0],
  ['SO-1054', 'ST-10', 'GUL', 34, 'urgent', 'pending_carrier', ago(27), ahead(360), ahead(600), 'CAR-K', 0],
  ['SO-1055', 'ST-11', 'GU', 36, 'standard', 'pending_carrier', ago(44), ahead(1500), ahead(1740), 'CAR-A', 0],
  ['SO-1056', 'ST-06', 'HE', 38, 'standard', 'pending_carrier', ago(51), ahead(1380), ahead(1620), 'CAR-B', 0],
  // order_scheduled (5) — carrier accepted, truck not yet released
  ['SO-1031', 'ST-01', 'GU', 38, 'standard', 'order_scheduled', ago(95), ahead(240), ahead(480), 'CAR-A', 0],
  ['SO-1032', 'ST-05', 'GU', 34, 'priority', 'order_scheduled', ago(110), ahead(300), ahead(540), 'CAR-G', 0],
  ['SO-1033', 'ST-03', 'GUL', 36, 'standard', 'order_scheduled', ago(88), ahead(360), ahead(600), 'CAR-C', 0],
  ['SO-1034', 'ST-08', 'GU', 34, 'standard', 'order_scheduled', ago(102), ahead(420), ahead(660), 'CAR-I', 0],
  ['SO-1035', 'ST-10', 'MS', 38, 'standard', 'order_scheduled', ago(120), ahead(480), ahead(720), 'CAR-J', 0],
  // transit_to_terminal (3)
  ['SO-1036', 'ST-02', 'GU', 36, 'standard', 'transit_to_terminal', ago(300), ahead(180), ahead(420), 'CAR-D', 0],
  ['SO-1037', 'ST-06', 'GU', 38, 'urgent', 'transit_to_terminal', ago(290), ahead(150), ahead(390), 'CAR-B', 0],
  ['SO-1038', 'ST-07', 'HE', 34, 'standard', 'transit_to_terminal', ago(310), ahead(210), ahead(450), 'CAR-H', 0],
  // starting_load (3)
  ['SO-1026', 'ST-11', 'GU', 34, 'standard', 'starting_load', ago(330), ahead(120), ahead(360), 'CAR-E', 0],
  ['SO-1027', 'ST-04', 'GU', 36, 'priority', 'starting_load', ago(325), ahead(150), ahead(390), 'CAR-F', 0],
  ['SO-1028', 'ST-09', 'GUL', 38, 'standard', 'starting_load', ago(340), ahead(180), ahead(420), 'CAR-L', 0],
  // load_completed (2)
  ['SO-1021', 'ST-05', 'GU', 38, 'standard', 'load_completed', ago(370), ahead(90), ahead(330), 'CAR-G', 0],
  ['SO-1022', 'ST-08', 'GU', 34, 'standard', 'load_completed', ago(380), ahead(120), ahead(360), 'CAR-H', 0],
  // in_transit (5) — progress is how far along the lane the truck sits
  ['SO-1011', 'ST-01', 'GU', 34, 'standard', 'in_transit', ago(420), ahead(30), ahead(270), 'CAR-A', 0.62],
  ['SO-1012', 'ST-02', 'HE', 36, 'priority', 'in_transit', ago(410), ahead(60), ahead(300), 'CAR-D', 0.35],
  ['SO-1013', 'ST-03', 'GU', 38, 'standard', 'in_transit', ago(400), ahead(20), ahead(260), 'CAR-C', 0.8],
  ['SO-1014', 'ST-07', 'GUL', 34, 'standard', 'in_transit', ago(430), ahead(45), ahead(285), 'CAR-H', 0.48],
  ['SO-1015', 'ST-10', 'GU', 38, 'urgent', 'in_transit', ago(395), ahead(75), ahead(315), 'CAR-J', 0.2],
  // on_site (2)
  ['SO-1006', 'ST-06', 'GU', 36, 'standard', 'on_site', ago(520), ago(60), ahead(180), 'CAR-B', 1],
  ['SO-1007', 'ST-09', 'MS', 34, 'standard', 'on_site', ago(540), ago(40), ahead(200), 'CAR-K', 1],
  // unloading (2)
  ['SO-1004', 'ST-04', 'GU', 38, 'standard', 'unloading', ago(560), ago(90), ahead(150), 'CAR-C', 1],
  ['SO-1005', 'ST-11', 'GU', 34, 'priority', 'unloading', ago(555), ago(80), ahead(160), 'CAR-A', 1],
  ['SO-1060', 'ST-01', 'GUL', 36, 'standard', 'unload_completed', ago(600), ago(120), ahead(120), 'CAR-A', 1],
  // unload_completed (2)
  ['SO-1002', 'ST-05', 'GUL', 36, 'standard', 'unload_completed', ago(600), ago(120), ahead(120), 'CAR-G', 1],
  ['SO-1003', 'ST-08', 'GU', 38, 'standard', 'unload_completed', ago(610), ago(110), ahead(130), 'CAR-I', 1],
  // delivered in the last hours (5)
  ['SO-0996', 'ST-01', 'GU', 38, 'standard', 'delivery_completed', ago(720), ago(300), ago(60), 'CAR-A', 1],
  ['SO-0997', 'ST-03', 'GU', 34, 'standard', 'delivery_completed', ago(700), ago(280), ago(40), 'CAR-F', 1],
  ['SO-0998', 'ST-06', 'HE', 36, 'priority', 'delivery_completed', ago(690), ago(270), ago(30), 'CAR-B', 1],
  ['SO-0999', 'ST-07', 'GU', 38, 'standard', 'delivery_completed', ago(740), ago(320), ago(80), 'CAR-H', 1],
  ['SO-1000', 'ST-10', 'GUL', 34, 'standard', 'delivery_completed', ago(760), ago(340), ago(100), 'CAR-J', 1],
]

function truckFor(carrierId: string | null, id: string): string | null {
  if (!carrierId) return null
  const trucks = trucksOf(carrierId)
  return trucks[hash(id) % trucks.length].id
}

function fromSeed(s: Seed, index: number): Order {
  const [id, shipToId, product, tonnes, priority, target, startAt, windowStart, windowEnd, carrierId, progress] = s
  const scheduled = ['order_created', 'pending_carrier'].includes(target)
  return {
    id,
    erpRef: erpRef(index),
    customerId: SHIP_TO_BY_ID[shipToId].customerId,
    shipToId,
    terminalId: terminalFor(shipToId),
    product,
    tonnes,
    window: { start: windowStart, end: windowEnd },
    priority,
    cvrId: cvrFor(shipToId),
    carrierId: scheduled ? null : carrierId,
    truckId: scheduled ? null : truckFor(carrierId, id),
    transitProgress: progress,
    seed: { target, startAt },
  }
}

export const OPEN_ORDERS: Order[] = OPEN.map((s, i) => fromSeed(s, 1200 + i))

/** Which carrier a pending order's request went to (the order itself has no
 *  carrier until acceptance). */
export const PENDING_REQUEST_CARRIER: Record<string, string> = Object.fromEntries(
  OPEN.filter((s) => s[5] === 'pending_carrier').map((s) => [s[0], s[9] as string]),
)

/** A hundred and twenty delivered orders over ninety days. Deterministic. */
function generateHistory(): Order[] {
  const rnd = mulberry32(42)
  const out: Order[] = []
  for (let i = 0; i < 120; i += 1) {
    const dayOffset = -1 - Math.floor((i * 89) / 120)
    const shipTo = SHIP_TOS[Math.floor(rnd() * SHIP_TOS.length)]
    const terminalId = terminalFor(shipTo.id)
    const serving = carriersServing(terminalId)
    const carrier = serving[Math.floor(rnd() * serving.length)]
    const product = PRODUCTS[Math.floor(rnd() * PRODUCTS.length)]
    const tonnes = 30 + 2 * Math.floor(rnd() * 5)
    const hh = 5 + Math.floor(rnd() * 8)
    const mm = 5 * Math.floor(rnd() * 12)
    const startAt = ts(dayOffset, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
    const priority: Priority = rnd() < 0.12 ? 'urgent' : rnd() < 0.3 ? 'priority' : 'standard'
    const id = `SO-${String(600 + i).padStart(4, '0')}`
    const base: Order = {
      id,
      erpRef: erpRef(1000 + i),
      customerId: shipTo.customerId,
      shipToId: shipTo.id,
      terminalId,
      product,
      tonnes,
      window: { start: startAt, end: startAt },
      priority,
      cvrId: cvrFor(shipTo.id),
      carrierId: carrier.id,
      truckId: truckFor(carrier.id, id),
      transitProgress: 1,
      seed: { target: 'delivery_completed', startAt },
    }
    /* The window is authored around the delivery the chain produces, so the
     * carrier's on-time rate lands where its reliability says it should. */
    const delivered = Date.parse(eventChain(base).at(-1)!.at)
    const onTime = rnd() < (RELIABILITY[carrier.id] ?? 0.9)
    const slackMin = onTime ? 30 + Math.floor(rnd() * 120) : -(30 + Math.floor(rnd() * 90))
    const end = delivered + slackMin * 60_000
    base.window = { start: new Date(end - 4 * 3_600_000).toISOString(), end: new Date(end).toISOString() }
    out.push(base)
  }
  return out
}

export const HISTORY_ORDERS: Order[] = generateHistory()

export const ORDERS: Order[] = [...HISTORY_ORDERS, ...OPEN_ORDERS]
export const ORDER_BY_ID: Record<string, Order> = Object.fromEntries(ORDERS.map((o) => [o.id, o]))

/**
 * Carrier requests behind the orders: one accepted request per scheduled
 * order, one open request per pending order, and a sprinkling of earlier
 * rejections so the scorecard has something to count.
 */
function generateRequests(): CarrierRequest[] {
  const out: CarrierRequest[] = []
  const rnd = mulberry32(7)
  for (const o of ORDERS) {
    const chain = eventChain(o)
    const created = chain[0]
    const pendingCarrier = PENDING_REQUEST_CARRIER[o.id] ?? o.carrierId
    if (!pendingCarrier) continue
    const sentAt = chain.find((e) => e.status === 'pending_carrier')?.at ?? created.at
    const accepted = chain.find((e) => e.status === 'order_scheduled')
    const rank: 1 | 2 | 3 = rnd() < 0.72 ? 1 : rnd() < 0.7 ? 2 : 3
    /* An earlier rejection on ~11% of history, weighted to the slow carrier. */
    if (o.seed.target === 'delivery_completed' && o.id !== HERO_T3 && rnd() < 0.11) {
      const serving = carriersServing(o.terminalId).filter((c) => c.id !== o.carrierId)
      const rejecter = serving.find((c) => c.id === 'CAR-D') && rnd() < 0.6 ? 'CAR-D' : serving[Math.floor(rnd() * serving.length)]?.id
      if (rejecter) {
        const rejectedAt = new Date(Date.parse(sentAt) - 25 * 60_000).toISOString()
        out.push({
          id: `RQ-${o.id}-0`, orderId: o.id, carrierId: rejecter, rank: 1, state: 'rejected',
          sentAt: new Date(Date.parse(sentAt) - 70 * 60_000).toISOString(), respondedAt: rejectedAt,
          reason: rnd() < 0.5 ? 'No capacity in the window' : 'Driver hours exhausted', reminders: [], expedited: false, by: 'Service desk',
        })
      }
    }
    out.push({
      id: `RQ-${o.id}-1`,
      orderId: o.id,
      carrierId: pendingCarrier,
      rank,
      state: accepted ? 'accepted' : 'sent',
      sentAt,
      respondedAt: accepted?.at ?? null,
      reminders: [],
      expedited: o.priority === 'urgent' && !accepted,
      truckId: accepted ? o.truckId ?? undefined : undefined,
      by: 'Service desk',
    })
  }
  return out
}

export const SEED_REQUESTS: CarrierRequest[] = generateRequests()

const DEVIATION_NOTES: [Deviation['kind'], number | null, string][] = [
  ['short_quantity', -1.4, 'Scale ticket shows 36.6 t against 38 t ordered.'],
  ['wrong_product', null, 'Ticket says GUL, silo was expecting GU. Held for confirmation.'],
  ['handover_issue', null, 'No site contact at the gate for forty minutes.'],
  ['excess_quantity', 0.8, 'Delivered 0.8 t over; customer accepted the overage.'],
  ['short_quantity', -0.9, 'Weighed light at the customer scale; carrier disputes.'],
  ['handover_issue', null, 'Silo hatch locked; driver waited for the site foreman.'],
]

/** Six deviations on recent history, so the exceptions queue is not empty. */
export const SEED_DEVIATIONS: Deviation[] = HISTORY_ORDERS.slice(-14)
  .filter((_, i) => i % 2 === 0)
  .slice(0, 6)
  .map((o, i) => {
    const delivered = eventChain(o).at(-1)!.at
    const [kind, qtyDelta, note] = DEVIATION_NOTES[i]
    return {
      id: `DEV-${o.id}`,
      orderId: o.id,
      kind,
      qtyDelta,
      note,
      filedBy: 'Customer',
      filedAt: new Date(Date.parse(delivered) + 12 * 60_000).toISOString(),
      state: i < 2 ? 'open' : i < 4 ? 'acknowledged' : 'resolved',
    }
  })

/** Every delivered order carries a signed bill of lading. */
export const SEED_PODS: PodDocument[] = ORDERS.filter((o) => o.seed.target === 'delivery_completed').map((o) => {
  const delivered = eventChain(o).at(-1)!.at
  const uploaded = CARRIERS.find((c) => c.id === o.carrierId)?.hasTms ?? false
  return {
    id: `EPOD-${o.id}`,
    orderId: o.id,
    bolNumber: `BOL-${o.erpRef.slice(-5)}`,
    source: uploaded ? 'upload' : 'signature',
    signedBy: 'Site receiver',
    signedAt: delivered,
    signaturePng: null,
    file: uploaded ? { name: `BOL-${o.erpRef.slice(-5)}-signed.pdf`, sizeKb: 180 + (hash(o.id) % 90) } : null,
    annotations: [],
    archivedAt: new Date(Date.parse(delivered) + 40 * 60_000).toISOString(),
  }
})
