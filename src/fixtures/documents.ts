import type { Order, StatusEvent } from '@/types/domain'
import type { DocumentModel, OrderDetail, OrderDocument } from '@/services/contracts'
import type { MockState } from '@/services/mock/store'
import { CARRIER_BY_ID, CUSTOMER_BY_ID, SHIP_TO_BY_ID, TERMINAL_BY_ID } from './network'
import { onTimeOf } from './derive'
import { PRODUCT, SYSTEMS, TENANT } from '@/app/product'

/**
 * The documents behind an order, as data.
 *
 * Every figure on a bill of lading, a delivery record or an invoice comes
 * from the same order and the same events the screens read — the document
 * is a view of the record, never a second copy of it. Streets, account
 * numbers, prices and weights are deterministic from the ids, so the same
 * order prints the same paper on every machine.
 */

/** Small, stable hash so synthetic details never change between builds. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h >>> 0)
}

const STREETS = ['Industrial Road', 'Harbour Drive', 'Cement Works Road', 'Concession Street', 'Rue de la Cimenterie', 'Boulevard Industriel', 'Quarry Lane', 'Terminal Avenue', 'Portside Way', 'Highway 2 East']
function street(id: string): string {
  const h = hash(id)
  return `${100 + (h % 3900)} ${STREETS[h % STREETS.length]}`
}
function postal(id: string, province: string): string {
  const h = hash(`${id}-pc`)
  const first: Record<string, string> = { ON: 'K', QC: 'J', AB: 'T', BC: 'V' }
  const L = 'ABCEGHJKLMNPRSTVWXYZ'
  return `${first[province] ?? 'K'}${h % 10}${L[h % L.length]} ${(h >>> 3) % 10}${L[(h >>> 5) % L.length]}${(h >>> 7) % 10}`
}

/** List price per tonne, Canadian dollars, by product code. */
export const PRODUCT_PRICES: Record<Order['product'], number> = { GU: 186, HE: 208, GUL: 179, MS: 194 }

/** Sales taxes by province of delivery. */
const TAXES: Record<string, { label: string; rate: number }[]> = {
  ON: [{ label: 'HST 13%', rate: 0.13 }],
  QC: [{ label: 'GST 5%', rate: 0.05 }, { label: 'QST 9.975%', rate: 0.09975 }],
  AB: [{ label: 'GST 5%', rate: 0.05 }],
  BC: [{ label: 'GST 5%', rate: 0.05 }, { label: 'PST 7%', rate: 0.07 }],
}

const PRODUCT_NAMES: Record<Order['product'], string> = {
  GU: 'General use cement, bulk (CSA A3001 Type GU)',
  HE: 'High early-strength cement, bulk (CSA A3001 Type HE)',
  GUL: 'Portland-limestone cement, bulk (CSA A3001 Type GUL)',
  MS: 'Moderate sulphate-resistant cement, bulk (CSA A3001 Type MS)',
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function documentModel(d: OrderDetail, order: Order, doc: OrderDocument, state: MockState): DocumentModel {
  const customer = CUSTOMER_BY_ID[order.customerId]
  const shipTo = SHIP_TO_BY_ID[order.shipToId]
  const terminal = TERMINAL_BY_ID[order.terminalId]
  const carrier = d.carrierId ? CARRIER_BY_ID[d.carrierId] : null
  const ev = d.events
  const at = (s: StatusEvent['status']) => ev.find((e) => e.status === s)?.at ?? null
  const created = at('order_created') ?? d.statusAt
  const loadedAt = at('load_completed')
  const deliveredAt = at('delivery_completed')
  const h = hash(order.id)

  const unitPrice = PRODUCT_PRICES[order.product]
  const amount = round2(order.tonnes * unitPrice)
  const rate = carrier ? (carrier.rates[`${order.terminalId}>${order.shipToId}`] ?? 8.4) : null
  const tare = round2(14.2 + (h % 13) / 10)
  const taxes = (TAXES[shipTo.province] ?? TAXES.ON).map((tx) => ({ label: tx.label, rate: tx.rate, amount: round2(amount * tx.rate) }))
  const total = round2(amount + taxes.reduce((n, tx) => n + tx.amount, 0))
  const windowEndMs = Date.parse(order.window.end)
  const cycleHours = deliveredAt ? round2((Date.parse(deliveredAt) - Date.parse(created)) / 3_600_000) : null

  return {
    kind: doc.kind,
    reference: doc.reference,
    issuedAt: doc.issuedAt,
    source: doc.source,
    seller: {
      name: TENANT.name,
      address: `1 Cement Way, Mississauga, ON  L5N 0A1`,
      taxNo: `GST/HST 8${String(h % 100000000).padStart(8, '0')} RT0001`,
      console: PRODUCT.name,
    },
    order: {
      erpRef: order.erpRef,
      consoleId: order.id,
      createdAt: created,
      requestRef: `${SYSTEMS.orders}-${String(700000 + (h % 90000))}`,
      customerPo: `PO-${String(41000 + (h % 9000))}`,
      owner: d.cvrName,
      priority: order.priority,
      windowStart: order.window.start,
      windowEnd: order.window.end,
      incoterms: 'DAP — delivered at place, unloaded by receiver',
      paymentTerms: 'Net 30 days',
    },
    customer: {
      name: customer.name,
      accountNo: String(1000200 + (hash(customer.id) % 8000)),
      address: `${street(customer.id)}, ${shipTo.city}, ${shipTo.province}  ${postal(customer.id, shipTo.province)}`,
      contact: customer.contact,
      language: customer.language,
    },
    shipTo: {
      id: shipTo.id,
      name: shipTo.name,
      address: `${street(shipTo.id)}, ${shipTo.city}, ${shipTo.province}  ${postal(shipTo.id, shipTo.province)}`,
      unloadMinutes: shipTo.unloadMinutes,
    },
    terminal: {
      id: terminal.id,
      name: terminal.name,
      siteCode: `CA${String(1000 + (hash(terminal.id) % 90)).slice(-2)}`,
      address: `${street(terminal.id)}, ${terminal.city}, ${terminal.province}  ${postal(terminal.id, terminal.province)}`,
    },
    line: {
      code: order.product,
      description: PRODUCT_NAMES[order.product],
      material: `CEM-${order.product}-BULK`,
      tonnes: order.tonnes,
      unitPrice,
      amount,
    },
    carrier: carrier
      ? {
          name: carrier.name,
          scac: carrier.id.replace('CAR-', 'CA') + String(100 + (hash(carrier.id) % 900)),
          truckPlate: d.truck?.plate ?? '—',
          driver: d.truck?.driver ?? '—',
          ratePerTonne: rate!,
          freightAmount: round2(order.tonnes * rate!),
          connected: carrier.hasTms,
        }
      : null,
    scale: loadedAt
      ? {
          ticket: `SC-${order.erpRef.slice(-5)}-${(h % 9) + 1}`,
          tare,
          gross: round2(tare + order.tonnes),
          net: order.tonnes,
          seal: `SL-${String(h % 1000000).padStart(6, '0')}`,
          loadedAt,
          bay: (h % 3) + 1,
          operator: `Scale operator ${String.fromCharCode(65 + (h % 6))}`,
        }
      : null,
    events: ev,
    pod: d.pod
      ? {
          signedBy: d.pod.signedBy,
          signedAt: d.pod.signedAt,
          signaturePng: d.pod.signaturePng,
          fileName: d.pod.file?.name ?? null,
          source: d.pod.source,
          annotations: d.pod.annotations,
          archivedAt: d.pod.archivedAt,
        }
      : null,
    deviations: d.deviations.map((dv) => ({ kind: dv.kind, qtyDelta: dv.qtyDelta, note: dv.note, filedBy: dv.filedBy, filedAt: dv.filedAt, state: dv.state })),
    delivery: deliveredAt
      ? { deliveredAt, onTime: onTimeOf(order, state) ?? Date.parse(deliveredAt) <= windowEndMs, cycleHours, unloadMinutes: shipTo.unloadMinutes }
      : null,
    invoice: deliveredAt
      ? {
          number: `INV-${order.erpRef.slice(-6)}`,
          date: new Date(Date.parse(deliveredAt) + 2 * 3_600_000).toISOString(),
          due: new Date(Date.parse(deliveredAt) + 32 * 86_400_000).toISOString(),
          subtotal: amount,
          taxes,
          total,
          currency: 'CAD',
        }
      : null,
  }
}
