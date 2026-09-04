import type { InventoryPosition, RecommendationDriver } from '@/types/domain'
import { PARTS, PART_BY_NUMBER, STATIONS, stationPart } from './parts'
import { SITES, HERO_CONFIGURATION } from './configurations'
import { effectiveBom } from './bom'
import { OPEN_PURCHASE_ORDERS } from './suppliers'
import { TODAY } from './calendar'

/**
 * Stock positions, at SKU × site × warehouse.
 *
 * ## The hero position is fixed by the the design notes and every figure ties out
 *
 * §8.3 pins `ABC-1001` at Plant A / MAIN: 19 on hand, 7 allocated, 12
 * available, 0.60 a day. Those four produce everything else — the position
 * after the build, the date it reaches zero, the coverage the recommended
 * target represents — and nothing downstream re-states any of them.
 *
 * Note what `averageDailyUsage` is: residual draw from the *other*
 * configurations, after this order's four units are netted. It is why the order
 * itself is protected while the exposure sits with orders promised later. That
 * distinction is the whole finding in §11.7, and it only exists because the
 * rate is modelled separately from the allocation.
 *
 * ## Plant B holds the transfer
 *
 * Eighteen units against no demand, two days away. §11.6 offers a transfer as
 * an alternative and §12.3 ranks it; without a real position behind it that
 * option is a button that lies.
 */

function hash(s: string): number {
  let h = 2166136261
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** §8.3, verbatim. Changing any of these changes six screens. */
const HERO_POSITION: InventoryPosition = {
  partNumber: 'ABC-1001',
  site: 'plant-a',
  warehouse: 'MAIN',
  onHand: 19,
  allocated: 7,
  averageDailyUsage: 0.6,
  currentSafetyStock: 12,
  recommendedSafetyStock: 28,
  recommendedRangeLow: 25,
  recommendedRangeHigh: 31,
  confidence: 'high',
  confidencePct: 0.91,
}

/** The transfer source. No demand of its own, so moving stock costs nothing. */
const PLANT_D_SOURCE: InventoryPosition = {
  partNumber: 'ABC-1001',
  site: 'plant-b',
  warehouse: 'MAIN',
  onHand: 18,
  allocated: 0,
  averageDailyUsage: 0.02,
  currentSafetyStock: 4,
  recommendedSafetyStock: 4,
  recommendedRangeLow: 3,
  recommendedRangeHigh: 6,
  confidence: 'high',
  confidencePct: 0.88,
}

/**
 * The blocked SKU.
 *
 * Its recommendation is withheld because the only evidence behind its lead time
 * is 104 days old — see `LEAD_TIME_EVIDENCE`. `currentSafetyStock` is null
 * rather than zero: the parameter is genuinely not maintained, which is a
 * different statement from "maintained at nothing" and is exactly the condition
 * §1.1 A-05 warns may be true across the whole item master.
 */
const BLOCKED_SENSOR: InventoryPosition = {
  partNumber: 'ABC-SEN-220',
  site: 'plant-a',
  warehouse: 'MAIN',
  /* Enough to build this order — it is one of the nine that fall below policy
   * afterwards, not one of the five that are short now. Getting that wrong
   * double-counts it across both readiness axes and the coverage split stops
   * summing to the line total. */
  onHand: 9,
  allocated: 2,
  averageDailyUsage: 0.11,
  currentSafetyStock: null,
  recommendedSafetyStock: 6,
  recommendedRangeLow: 5,
  recommendedRangeHigh: 8,
  confidence: 'low',
  confidencePct: 0.44,
}

/**
 * Everything else.
 *
 * Generated so the five §7.3 statuses are all populated — including `Excess`,
 * which exists precisely because `Healthy` would otherwise absorb ten-times
 * overstock while three separate KPIs count it.
 */
function generated(): InventoryPosition[] {
  const out: InventoryPosition[] = []
  const named = new Set(['ABC-1001', 'ABC-SEN-220'])

  for (const part of PARTS) {
    if (named.has(part.partNumber)) continue

    /* Not every part is stocked everywhere. A service site holding the full
     * plant master would be its own kind of implausible. */
    for (const site of SITES) {
      const seed = `pos:${part.partNumber}:${site.id}`
      if (site.id !== 'plant-a' && hash(`${seed}:x`) % 100 > 22) continue

      const usage = ((hash(`${seed}:u`) % 240) + 4) / 100
      const target = Math.max(2, Math.round(usage * (10 + (hash(`${seed}:t`) % 40))))

      /* Bucket the population so all five statuses are reachable. The shares
       * are what §14.1's KPI row reports, so they are chosen rather than
       * accidental: mostly healthy, a visible tail of action and excess. */
      const roll = hash(`${seed}:r`) % 100
      const factor =
        roll < 6 ? 0.35 :   // action required
        roll < 14 ? 0.8 :   // watch
        roll < 24 ? 3.4 :   // excess
        1.6                 // healthy

      const onHand = Math.max(0, Math.round(target * factor))
      const allocated = Math.round(onHand * ((hash(`${seed}:a`) % 30) / 100))
      const pct = 0.55 + (hash(`${seed}:c`) % 44) / 100

      out.push({
        partNumber: part.partNumber,
        site: site.id,
        warehouse: 'MAIN',
        onHand,
        allocated,
        averageDailyUsage: usage,
        /* A tenth of the master genuinely has no maintained parameter — the
         * condition §1.1 A-05 says may be true of all of it. */
        currentSafetyStock: hash(`${seed}:m`) % 10 === 0 ? null : Math.max(1, Math.round(target * 0.7)),
        recommendedSafetyStock: target,
        recommendedRangeLow: Math.max(1, Math.round(target * 0.9)),
        recommendedRangeHigh: Math.round(target * 1.12),
        confidence: pct >= 0.85 ? 'high' : pct >= 0.6 ? 'medium' : 'low',
        confidencePct: Math.round(pct * 100) / 100,
      })
    }
  }
  return out
}

/* ── Designed scarcity ───────────────────────────────────────────────────── */

/**
 * Which components on the hero order are short, and which fall below policy
 * after the build.
 *
 * This is authored rather than tuned, and the reason is honesty about what a
 * demo dataset is. §8.6 fixes the coverage split at 236 covered / 9 below
 * safety / 5 short out of 250, and §11.6 decomposes those nine into three that
 * need a requisition, four already covered by incoming supply, one with a
 * transfer candidate and one blocked. Those are not statistics — they are the
 * story the walk tells. Reaching them by nudging a random distribution until it
 * happens to land would be both fragile and dishonest.
 *
 * So the roles are named and the positions are set to produce them. The
 * *derivation* still does the work: nothing below states a coverage state, it
 * states a stock level, and `explodeOrder` reaches its own conclusion.
 */
type ScarcityRole =
  | 'short'              // available < order demand
  | 'needs-requisition'  // below target after build, nothing incoming
  | 'incoming-covered'   // below target after build, an open PO already covers it
  | 'transfer-candidate' // below target after build, stock exists at another site

const HERO_DEMAND = 4

/**
 * Picked from the hero configuration's own structure so every designated part
 * is genuinely on the order. Taken from the shared population, because a
 * shortage on a part used by all twelve configurations is the more interesting
 * kind — it is the one whose real exposure the planning system is missing.
 */
export const SCARCITY_SUPPLIERS = ['sup-industrial', 'sup-drive', 'sup-precision'] as const

export function scarcityPlan(): { partNumber: string; role: ScarcityRole }[] {
  const heroLines = effectiveBom(HERO_CONFIGURATION, TODAY)
  /* Restricted to three suppliers, because §13.2 groups requisitions by
   * supplier and §8.6 fixes the set at three. Scarcity spread across six
   * vendors would produce six requisitions and a review screen that argues
   * with the number in its own header. */
  const bySupplier = (p: string) => {
    const s = PART_BY_NUMBER.get(p)?.primarySupplierId
    return !!s && (SCARCITY_SUPPLIERS as readonly string[]).includes(s)
  }

  const onHeroBom = new Set(heroLines.map((l) => l.partNumber))

  /* Station parts come first, and that is the whole point.
   *
   * Scarcity assigned to anonymous filler produces a readiness summary that is
   * arithmetically correct and visually empty: the exploded sheet draws
   * seventeen component positions, and if none of them is the thing that is
   * short, the drawing shows a healthy machine while the panel beside it
   * reports five shortages. A shortage on a position a planner can point at is
   * both better for the walk-through and a truer picture of what goes wrong on
   * an assembly line — parts that stop a build are parts somebody installs.
   *
   * Positions already covered by an open PO are excluded here, or the same part
   * would be short and incoming-covered at once. */
  const incoming = new Set(OPEN_PURCHASE_ORDERS.map((p) => p.partNumber))
  const stationParts = STATIONS
    .map((st) => stationPart(st, 'standard'))
    .filter((p) => onHeroBom.has(p) && bySupplier(p) && !incoming.has(p))
    /* The hero element and the blocked sensor already have authored positions and
     * roles of their own; overwriting them here would fight §8.3. */
    .filter((p) => p !== 'ABC-1001' && p !== 'ABC-SEN-220')
    /* The motor position carries the part-resolution case. A part that is both
     * short and under substitute review is a legitimate two-axis line, but it
     * is not the one to lead with on the sheet. */
    .filter((p) => !p.startsWith('ABC-MTR-'))

  const filler = heroLines
    .map((l) => l.partNumber)
    .filter((p) => /^DEMO-[A-Z]{3}-\d{4}$/.test(p))
    .filter(bySupplier)

  const eligible = [...stationParts, ...filler]

  /* Two designated, not three. The hero element is the third line that needs a
   * requisition — it falls below its own policy after the build on figures §8.3
   * fixes, so designating a third here would make ten SKUs fall below policy
   * where §11.6 accounts for nine. The story has to close on the same number
   * the panel reports. */
  const roles: ScarcityRole[] = [
    ...Array<ScarcityRole>(5).fill('short'),
    ...Array<ScarcityRole>(2).fill('needs-requisition'),
    ...Array<ScarcityRole>(4).fill('incoming-covered'),
    'transfer-candidate',
  ]
  return roles.map((role, i) => ({ partNumber: eligible[i], role }))
}

/** Parts whose gap is already closed by supply on the water. */
export function incomingCoveredParts(): string[] {
  return scarcityPlan().filter((p) => p.role === 'incoming-covered').map((p) => p.partNumber)
}

/** Parts with usable stock at another site — §11.6's transfer candidate. */
export function transferCandidateParts(): string[] {
  return scarcityPlan().filter((p) => p.role === 'transfer-candidate').map((p) => p.partNumber)
}

function applyScarcity(positions: InventoryPosition[]): InventoryPosition[] {
  const plan = new Map(scarcityPlan().map((p) => [p.partNumber, p.role]))
  return positions.map((p) => {
    if (p.site !== 'plant-a') return p
    const role = plan.get(p.partNumber)
    if (!role) return p

    const target = 6
    /* Set the stock level; let the derivation decide what that means.
     *   short              available 1–3, so after a demand of 4 it goes negative
     *   below-safety roles  available 4–9, so the build leaves 0–5 against a 6 target
     * The three below-safety roles differ downstream, not here: what separates
     * them is whether an open PO covers the gap, whether another site holds
     * stock, and whether the evidence is trustworthy. */
    const available = role === 'short' ? 2 : 7
    return {
      ...p,
      onHand: available + p.allocated,
      currentSafetyStock: target,
      recommendedSafetyStock: target + 2,
      recommendedRangeLow: target,
      recommendedRangeHigh: target + 4,
      averageDailyUsage: 0.24,
    }
  })
}

/**
 * Positions that are comfortably covered.
 *
 * The generated population above is deliberately loose, which produced 44 lines
 * below policy on one order — five times what §8.6 calls for, and a readiness
 * summary that reads as chaos rather than as five real problems. A plant whose
 * every fifth component is under target does not have an inventory-intelligence
 * problem, it has a purchasing department that has stopped.
 */
function liftToCovered(positions: InventoryPosition[]): InventoryPosition[] {
  return positions.map((p) => {
    if (p.site !== 'plant-a') return p
    const target = p.currentSafetyStock ?? p.recommendedSafetyStock
    const floor = target + HERO_DEMAND * 2
    if (p.onHand - p.allocated >= floor) return p
    return { ...p, onHand: floor + p.allocated }
  })
}

const NAMED_POSITIONS = new Set(['ABC-1001', 'ABC-SEN-220'])

export const INVENTORY: InventoryPosition[] = [
  HERO_POSITION,
  PLANT_D_SOURCE,
  BLOCKED_SENSOR,
  ...applyScarcity(liftToCovered(generated().filter((p) => !NAMED_POSITIONS.has(p.partNumber)))),
]

export function positionAt(partNumber: string, site: string, warehouse = 'MAIN') {
  return INVENTORY.find(
    (p) => p.partNumber === partNumber && p.site === site && p.warehouse === warehouse,
  )
}

/**
 * How the hero recommendation reaches 28.
 *
 * §12.3 renders this as a waterfall, and two of the six terms carry a marker:
 * they are quantities a conventional planning process cannot compute at all.
 * Shared-variant exposure needs a view across configurations that no single BOM
 * gives; lead-time variability needs the supplier's own words. Together they
 * are 9.3 of the 16.0 gap between the 12 on file and the 28 recommended — which
 * is the pitch, stated as arithmetic rather than as a claim.
 */
export const HERO_DRIVERS: RecommendationDriver[] = [
  { partNumber: 'ABC-1001', label: 'Base demand during confirmed lead time', value: 20.4, onlyVisibleAcross: null,                evidenceRef: 'ev-ABC-1001' },
  { partNumber: 'ABC-1001', label: 'Demand variability allowance',           value: 3.1,  onlyVisibleAcross: null,                evidenceRef: null },
  { partNumber: 'ABC-1001', label: 'Production-critical policy uplift',      value: 2.8,  onlyVisibleAcross: null,                evidenceRef: null },
  { partNumber: 'ABC-1001', label: 'Shared-variant exposure',                value: 4.2,  onlyVisibleAcross: 'configurations',    evidenceRef: 'exposure:ABC-1001' },
  { partNumber: 'ABC-1001', label: 'Lead-time variability',                  value: 5.1,  onlyVisibleAcross: 'supplier-evidence', evidenceRef: 'ev-ABC-1001' },
  { partNumber: 'ABC-1001', label: 'Confirmed usable incoming supply',       value: -7.6, onlyVisibleAcross: null,                evidenceRef: 'PO-21463' },
]
