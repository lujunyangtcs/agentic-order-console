import type { SalesOrder } from '@/types/domain'
import { d } from './calendar'
import { CONFIGURATIONS, HERO_CONFIGURATION } from './configurations'

/**
 * Configured customer orders.
 *
 * The distribution across configurations is not decoration. §8.5 fixes it:
 * three live orders on 460 V / 60 Hz, two on 380 V / 50 Hz, one on 575 V /
 * 60 Hz. That is the six that give component `ABC-1001` its forward exposure,
 * and it is the number the Assembly Exposure rail reports when station 3 is
 * selected.
 *
 * The remaining orders spread across the other configurations so the order book
 * is not six records with a heading. §8.1 asks for 24–30 — enough that six
 * orders on one optional accessory reads as a concentration rather than as the
 * entire business.
 */

const CUSTOMERS = [
  'Customer A',
  'Customer B',
  'Customer C',
  'Customer D',
  'Customer E',
  'Customer F',
  'Customer G',
  'Customer H',
  'Customer I',
] as const

function hash(s: string): number {
  let h = 2166136261
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** The order the demo opens on. Every figure is fixed by §8.2. */
export const HERO_ORDER = 'SO-ABC-10482'

const hero: SalesOrder = {
  id: HERO_ORDER,
  customer: 'Customer A',
  configurationId: HERO_CONFIGURATION,
  quantity: 4,
  site: 'plant-a',
  receivedAt: d(-1),
  requiredShipDate: d(23),
}

/**
 * Live orders per configuration, §8.5. The hero order is one of the three on
 * 460 V / 60 Hz, so this table counts it.
 */
const LIVE_BY_CONFIG: Record<string, number> = {
  'ABC-6107': 3,
  'ABC-6104': 2,
  'ABC-6108': 1,
}

function liveOrders(): SalesOrder[] {
  const out: SalesOrder[] = [hero]
  let n = 0
  for (const [configId, count] of Object.entries(LIVE_BY_CONFIG)) {
    const already = configId === HERO_CONFIGURATION ? 1 : 0
    for (let i = already; i < count; i++) {
      const seed = `live:${configId}:${i}`
      out.push({
        id: `SO-DEMO-${10_483 + n}`,
        customer: CUSTOMERS[hash(`${seed}:c`) % CUSTOMERS.length],
        configurationId: configId,
        /* One machine each. A splitting saw is a capital purchase; a plant
         * takes delivery of one or two, not a pallet. */
        quantity: 1,
        site: 'plant-a',
        receivedAt: d(-(3 + (hash(`${seed}:r`) % 18))),
        requiredShipDate: d(18 + (hash(`${seed}:s`) % 40)),
      })
      n++
    }
  }
  return out
}

/**
 * The shipped order book.
 *
 * These are **historical** — already shipped — and that is what makes §8.5's
 * exposure table true. If they were open, every configuration would carry live
 * orders and the matrix would report twelve of twelve instead of three, which
 * is the opposite of the point: what makes `ABC-1001` interesting is that it is
 * consumed by eleven configurations but only three of them are drawing on it
 * right now.
 *
 * They still earn their place. Demand history, supplier on-time performance and
 * the 90-day trend charts all need a book behind them, and an order list with
 * six records in it does not look like a manufacturer's.
 */
function shippedOrders(): SalesOrder[] {
  const orderable = CONFIGURATIONS.filter((c) => c.orderable && c.finishedPart)
  return Array.from({ length: 21 }, (_, i) => {
    const seed = `bg:${i}`
    const config = orderable[hash(`${seed}:k`) % orderable.length]
    const shipped = -(4 + (hash(`${seed}:d`) % 80))
    return {
      id: `SO-DEMO-${10_500 + i}`,
      customer: CUSTOMERS[hash(`${seed}:c`) % CUSTOMERS.length],
      configurationId: config.finishedPart as string,
      quantity: 1 + (hash(`${seed}:q`) % 4),
      site: hash(`${seed}:s`) % 5 === 0 ? 'plant-c' : 'plant-a',
      receivedAt: d(shipped - (18 + (hash(`${seed}:r`) % 30))),
      requiredShipDate: d(shipped),
    }
  })
}

export const SALES_ORDERS: SalesOrder[] = [...liveOrders(), ...shippedOrders()]

/** Orders still to ship. What "live" means everywhere in the product. */
export function openOrders(): SalesOrder[] {
  const today = d(0)
  return SALES_ORDERS.filter((o) => o.requiredShipDate >= today)
}
