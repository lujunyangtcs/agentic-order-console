import type { Supplier, LeadTimeEvidence, PurchaseOrder } from '@/types/domain'
import { d, ts } from './calendar'

/**
 * Suppliers, their lead times, and the email evidence that contradicts them.
 *
 * The contradiction is the product. What the system of record holds
 * (`leadTimeDaysOnFile`) and what the supplier has actually said in writing are
 * two different numbers, and nothing in a planning screen reconciles them today
 * — that is the gap §12.3's evidence panel exists to close.
 */

export const SUPPLIERS: Supplier[] = [
  { id: 'sup-industrial', name: 'Supplier A', currency: 'USD', leadTimeDaysOnFile: 21, onTimePct: 0.86 },
  { id: 'sup-drive',      name: 'Supplier B',         currency: 'USD', leadTimeDaysOnFile: 12, onTimePct: 0.94 },
  { id: 'sup-precision',  name: 'Supplier C',     currency: 'USD', leadTimeDaysOnFile: 9,  onTimePct: 0.91 },
  { id: 'sup-fasteners',  name: 'Supplier E',        currency: 'USD', leadTimeDaysOnFile: 7,  onTimePct: 0.97 },
  { id: 'sup-polymer',    name: 'Supplier F',         currency: 'USD', leadTimeDaysOnFile: 14, onTimePct: 0.88 },
  { id: 'sup-eu',         name: 'Supplier D',        currency: 'EUR', leadTimeDaysOnFile: 18, onTimePct: 0.83 },
]

export const SUPPLIER_BY_ID = new Map(SUPPLIERS.map((s) => [s.id, s]))

/**
 * Extracted lead-time claims.
 *
 * `extractionReliability` is a measure of how confidently the number was read
 * out of an email. It is **not** recommendation confidence, and §7.2 forbids
 * the two sharing a label — they appear on adjacent panels of the same page one
 * percentage point apart, and nobody would separate them unaided.
 *
 * The two records below are deliberately opposite. The element evidence is two
 * days old and planner-confirmed, so it can drive a requisition. The sensor
 * evidence is 104 days old, which is what puts that SKU in `Blocked` and gives
 * the freshness rules something real to act on.
 */
export const LEAD_TIME_EVIDENCE: LeadTimeEvidence[] = [
  {
    id: 'ev-ABC-1001',
    supplierId: 'sup-industrial',
    partNumber: 'ABC-1001',
    claimedLeadTimeDays: 34,
    receivedAt: ts(-5, '14:12'),
    subject: 'RE: Element schedule — Q3/Q4 capacity',
    excerpt:
      'Our element stock supplier has moved to a six-week cycle, so from this month we are quoting 34 days on the 112 in extended life element rather than the three weeks you have on file. Existing open orders are unaffected.',
    extractionReliability: 0.92,
    confirmedBy: 'Alex Morgan',
  },
  {
    id: 'ev-sen-220',
    supplierId: 'sup-precision',
    partNumber: 'ABC-SEN-220',
    claimedLeadTimeDays: 26,
    receivedAt: ts(-104, '09:40'),
    subject: 'Sensor availability',
    excerpt:
      'Lead time on the sealed cycle sensor is around four weeks at the moment. We will confirm once the new batch is scheduled.',
    extractionReliability: 0.61,
    confirmedBy: null,
  },
]

/** Below this, a fact is `Needs confirmation` and cannot support a requisition. */
export const EXTRACTION_RELIABILITY_FLOOR = 0.75

/** The lead time actually used for planning: confirmed evidence beats the file. */
export function effectiveLeadTime(partNumber: string, supplierId: string): number {
  const ev = LEAD_TIME_EVIDENCE.find(
    (e) => e.partNumber === partNumber && e.extractionReliability >= EXTRACTION_RELIABILITY_FLOOR && e.confirmedBy,
  )
  if (ev) return ev.claimedLeadTimeDays
  return SUPPLIER_BY_ID.get(supplierId)?.leadTimeDaysOnFile ?? 14
}

/* ── Purchase orders ─────────────────────────────────────────────────────── */

/* FNV-1a again, so the trailing history is stable across builds. */
function hash(s: string): number {
  let h = 2166136261
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/**
 * Received POs across the trailing 90 days.
 *
 * These exist because supplier on-time performance and lead-time variance are
 * analytics KPIs with no data behind them otherwise — a viewer clicking
 * "Supplier on-time performance" would find one supplier and no receipts. Each
 * carries a promised date and an actual date, and the spread between them is
 * what the variance ranking measures.
 */
function receivedHistory(): PurchaseOrder[] {
  const out: PurchaseOrder[] = []
  for (let i = 0; i < 52; i++) {
    const sup = SUPPLIERS[hash(`po:${i}:s`) % SUPPLIERS.length]
    const orderedOffset = -(88 - (hash(`po:${i}:o`) % 84))
    const promisedOffset = orderedOffset + sup.leadTimeDaysOnFile
    /* Slip is drawn against the supplier's own on-time record, so the ranking
     * the analytics page produces agrees with the number on the supplier card. */
    const late = (hash(`po:${i}:l`) % 100) / 100 > sup.onTimePct
    const slip = late ? 1 + (hash(`po:${i}:d`) % 9) : -(hash(`po:${i}:e`) % 2)
    out.push({
      id: `PO-${21_400 + i}`,
      supplierId: sup.id,
      partNumber: '',
      quantity: 5 + (hash(`po:${i}:q`) % 60),
      site: 'plant-a',
      warehouse: 'MAIN',
      orderedAt: d(orderedOffset),
      promisedDate: d(promisedOffset),
      actualReceiptDate: d(promisedOffset + slip),
    })
  }
  return out
}

/** Open POs — these are what "covered by confirmed incoming supply" nets against. */
const OPEN_POS: PurchaseOrder[] = [
  { id: 'PO-21460', supplierId: 'sup-precision', partNumber: 'ABC-WHEELBEARING-STD', quantity: 24, site: 'plant-a', warehouse: 'MAIN', orderedAt: d(-6),  promisedDate: d(4),  actualReceiptDate: null },
  { id: 'PO-21461', supplierId: 'sup-drive',     partNumber: 'DEMO-CONTACTOR-STANDARD', quantity: 12, site: 'plant-a', warehouse: 'MAIN', orderedAt: d(-4),  promisedDate: d(8),  actualReceiptDate: null },
  { id: 'PO-21462', supplierId: 'sup-drive',     partNumber: 'DEMO-HARNESS-STANDARD',  quantity: 8,  site: 'plant-a', warehouse: 'MAIN', orderedAt: d(-9),  promisedDate: d(3),  actualReceiptDate: null },
  { id: 'PO-21463', supplierId: 'sup-industrial', partNumber: 'ABC-1002',               quantity: 40, site: 'plant-a', warehouse: 'MAIN', orderedAt: d(-11), promisedDate: d(10), actualReceiptDate: null },
]

export const PURCHASE_ORDERS: PurchaseOrder[] = [...OPEN_POS, ...receivedHistory()]

export const OPEN_PURCHASE_ORDERS = PURCHASE_ORDERS.filter((p) => p.actualReceiptDate === null)
export const RECEIVED_PURCHASE_ORDERS = PURCHASE_ORDERS.filter((p) => p.actualReceiptDate !== null)
