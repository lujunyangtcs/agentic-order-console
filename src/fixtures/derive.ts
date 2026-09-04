import type {
  InventoryStatus, CoverageState, Qualifier, RequisitionLine, Requisition,
} from '@/types/domain'
import { d, daysFromToday, TODAY } from './calendar'
import { positionAt, incomingCoveredParts, transferCandidateParts } from './inventory'
import { PART_BY_NUMBER } from './parts'
import { effectiveBom } from './bom'
import { CONFIGURATIONS } from './configurations'
import { SALES_ORDERS, HERO_ORDER, openOrders } from './orders'
import { SUPPLIER_BY_ID, effectiveLeadTime, OPEN_PURCHASE_ORDERS, LEAD_TIME_EVIDENCE, EXTRACTION_RELIABILITY_FLOOR } from './suppliers'

/**
 * Everything computed.
 *
 * This file is the master-data principle in one place. Nothing below is typed
 * out: every figure the product shows is derived here from the base records,
 * once, and read everywhere else. If a component needs a number that this file
 * does not expose, the fix is to add it here — not to compute it locally from
 * two things that are exposed, because that is how two screens end up
 * disagreeing about the same fact.
 */

/* ── Position arithmetic ─────────────────────────────────────────────────── */

export function available(partNumber: string, site: string, warehouse = 'MAIN'): number {
  const p = positionAt(partNumber, site, warehouse)
  return p ? p.onHand - p.allocated : 0
}

/**
 * When a position reaches zero at its current draw.
 *
 * Null when there is no residual draw — a part with no consumption never runs
 * out, and inventing a date for it would be worse than showing none.
 */
export function projectedZeroDate(partNumber: string, site: string, warehouse = 'MAIN'): string | null {
  const p = positionAt(partNumber, site, warehouse)
  if (!p || p.averageDailyUsage <= 0) return null
  return d(Math.floor((p.onHand - p.allocated) / p.averageDailyUsage))
}

/**
 * When a position reaches zero *after* a committed build has consumed its share.
 *
 * This is the projection §11.7 reports, and it is a different number from the
 * one above. `projectedZeroDate` answers "when does today's stock run out";
 * this answers "when does what is left after this order runs out", which is the
 * question a planner looking at an order impact page is actually asking.
 *
 * Conflating the two is how the first draft of the the design notes ended up claiming a
 * stockout twenty-one days before the replenishment that was supposed to
 * prevent it.
 */
export function projectedZeroAfterOrder(
  partNumber: string, site: string, demand: number, warehouse = 'MAIN',
): string | null {
  const p = positionAt(partNumber, site, warehouse)
  if (!p || p.averageDailyUsage <= 0) return null
  const after = p.onHand - p.allocated - demand
  if (after <= 0) return d(0)
  return d(Math.floor(after / p.averageDailyUsage))
}

/** §7.2 — what the recommended target represents in days of cover. */
export function coverageDays(partNumber: string, site: string, warehouse = 'MAIN'): number | null {
  const p = positionAt(partNumber, site, warehouse)
  if (!p || p.averageDailyUsage <= 0) return null
  return Math.round(p.recommendedSafetyStock / p.averageDailyUsage)
}

/**
 * §7.3 — status. Five mutually exclusive values, and the boundaries matter.
 *
 * `Excess` exists because without it `Healthy` silently absorbs ten-times
 * overstock, and then clicking the `Excess Exposure` KPI filters to a screenful
 * of rows labelled Healthy. `Action Required` is scoped to seven days so it
 * does not simply duplicate `Watch`, which is what made the two KPIs count the
 * same population in the first draft.
 */
export function statusOf(partNumber: string, site: string, warehouse = 'MAIN'): InventoryStatus {
  const p = positionAt(partNumber, site, warehouse)
  if (!p) return 'blocked'

  const blocked = LEAD_TIME_EVIDENCE.some(
    (e) => e.partNumber === partNumber &&
      (e.extractionReliability < EXTRACTION_RELIABILITY_FLOOR || !e.confirmedBy) &&
      daysFromToday(e.receivedAt) < -60,
  )
  if (blocked) return 'blocked'

  const pos = p.onHand - p.allocated
  if (pos > p.recommendedRangeHigh && p.averageDailyUsage > 0 &&
      pos / p.averageDailyUsage > 120) return 'excess'

  const target = p.currentSafetyStock ?? p.recommendedSafetyStock
  if (pos < target) return 'action_required'

  const zero = projectedZeroDate(partNumber, site, warehouse)
  if (!zero) return 'healthy'
  const days = daysFromToday(zero)
  if (days <= 7) return 'action_required'
  if (days <= 30) return 'watch'
  return 'healthy'
}

/* ── Order impact (§11.4) ────────────────────────────────────────────────── */

export interface ComponentLine {
  partNumber: string
  required: number
  available: number
  openSupply: number
  positionAfterBuild: number
  activeTarget: number | null
  /** Axis 1 — exclusive, sums to the analysed lines. */
  coverage: CoverageState
  /** Axis 2 — non-exclusive overlay. Never summed with axis 1. */
  qualifiers: Qualifier[]
  needDate: string
}

/**
 * Explode an order into component lines.
 *
 * The two readiness axes are separate fields rather than one union, and that is
 * a correctness decision, not a stylistic one. Rejecting an incompatible
 * substitute leaves a line that is both `short` and under `part_resolution_review`;
 * a single union forces a choice between them and the counts stop summing to
 * the line total.
 */
export function explodeOrder(orderId: string): ComponentLine[] {
  const order = SALES_ORDERS.find((o) => o.id === orderId)
  if (!order) return []

  const lines = effectiveBom(order.configurationId, TODAY)
  const needDate = d(daysFromToday(order.requiredShipDate) - 10)

  return lines.map((l) => {
    const required = l.quantityPer * order.quantity
    const avail = available(l.partNumber, order.site)
    const openSupply = OPEN_PURCHASE_ORDERS
      .filter((p) => p.partNumber === l.partNumber && p.site === order.site)
      .reduce((n, p) => n + p.quantity, 0)
    const after = avail - required
    const pos = positionAt(l.partNumber, order.site)
    const activeTarget = pos ? pos.currentSafetyStock ?? pos.recommendedSafetyStock : null

    const coverage: CoverageState =
      after < 0 ? 'short'
      : activeTarget !== null && after < activeTarget ? 'below_safety_after_build'
      : 'covered'

    const qualifiers: Qualifier[] = []
    if (statusOf(l.partNumber, order.site) === 'blocked') qualifiers.push('blocked')
    if (l.partNumber === 'ABC-MTR-460-60-R2') qualifiers.push('part_resolution_review')

    return {
      partNumber: l.partNumber, required, available: avail, openSupply,
      positionAfterBuild: after, activeTarget, coverage, qualifiers, needDate,
    }
  })
}

export interface ReadinessSummary {
  analysedLines: number
  covered: number
  belowSafetyAfterBuild: number
  short: number
  partResolutionReview: number
  blocked: number
}

/** The two axes, counted separately and never added together. */
export function readinessOf(orderId: string): ReadinessSummary {
  const lines = explodeOrder(orderId)
  return {
    analysedLines: lines.length,
    covered: lines.filter((l) => l.coverage === 'covered').length,
    belowSafetyAfterBuild: lines.filter((l) => l.coverage === 'below_safety_after_build').length,
    short: lines.filter((l) => l.coverage === 'short').length,
    partResolutionReview: lines.filter((l) => l.qualifiers.includes('part_resolution_review')).length,
    blocked: lines.filter((l) => l.qualifiers.includes('blocked')).length,
  }
}

/* ── Requisition set (§13) ───────────────────────────────────────────────── */

function roundToOrderRules(need: number, moq: number, multiple: number): number {
  const atLeast = Math.max(need, moq)
  return Math.ceil(atLeast / multiple) * multiple
}

/**
 * Build the requisition set for an order.
 *
 * Grouped by supplier, site and currency, because §13.2 requires it and a
 * single requisition spanning three suppliers would contradict the product's
 * own consolidation rule on the screen that states it.
 *
 * Lines that are `blocked` are excluded, per §13.2 — a recommendation nobody
 * can trust should not become a purchase.
 */
export function buildRequisitionSet(orderId: string): {
  setId: string
  requisitions: Requisition[]
  lines: RequisitionLine[]
} {
  const order = SALES_ORDERS.find((o) => o.id === orderId)!
  const setId = 'REQ-DEMO-0007'
  const lines: RequisitionLine[] = []

  /* Three exclusions, and each is a rule the product states elsewhere:
   *   blocked           §13.2 — a recommendation nobody can trust is not a purchase
   *   incoming-covered  §13.2 — net open POs before recommending more
   *   transfer          §11.6 — a transfer candidate is an alternative, not a buy
   * Without the second and third, the requisition re-buys stock that is already
   * on the water and stock that is already in the company. */
  const covered = new Set(incomingCoveredParts())
  const transferable = new Set(transferCandidateParts())

  const candidates = explodeOrder(orderId).filter(
    (l) =>
      !l.qualifiers.includes('blocked') &&
      l.coverage !== 'covered' &&
      !covered.has(l.partNumber) &&
      !transferable.has(l.partNumber),
  )

  for (const c of candidates) {
    const part = PART_BY_NUMBER.get(c.partNumber)
    if (!part?.primarySupplierId) continue

    const reason = c.coverage === 'short' ? 'protect_order' : 'restore_safety'
    const target = c.activeTarget ?? 0
    const rawNeed = c.coverage === 'short'
      ? Math.abs(c.positionAfterBuild)
      : Math.max(0, (positionAt(c.partNumber, order.site)?.recommendedSafetyStock ?? target) - c.positionAfterBuild)
    if (rawNeed <= 0) continue

    const leadTime = effectiveLeadTime(c.partNumber, part.primarySupplierId)
    lines.push({
      id: `${setId}-L${lines.length + 1}`,
      requisitionId: '',
      partNumber: c.partNumber,
      site: order.site,
      reason,
      rawNeed,
      quantity: roundToOrderRules(rawNeed, part.moq, part.orderMultiple),
      needByDate: c.needDate,
      leadTimeDays: leadTime,
      projectedReceiptDate: d(leadTime),
      unitCost: part.unitCost,
      supplierId: part.primarySupplierId,
      warnings: [],
    })
  }

  /* Group into supplier-scoped requisitions. The set id is what holds them
   * together through review; the ERP reference is assigned on write-back and
   * deliberately absent until then. */
  const bySupplier = new Map<string, RequisitionLine[]>()
  for (const l of lines) {
    const key = `${l.supplierId}:${l.site}`
    if (!bySupplier.has(key)) bySupplier.set(key, [])
    bySupplier.get(key)!.push(l)
  }

  const requisitions: Requisition[] = [...bySupplier.entries()].map(([key, ls], i) => {
    const [supplierId, site] = key.split(':')
    const id = `${setId}-${i + 1}`
    ls.forEach((l) => { l.requisitionId = id })
    return {
      id, setId, supplierId, site,
      currency: SUPPLIER_BY_ID.get(supplierId)?.currency ?? 'USD',
      externalReference: null,
    }
  })

  return { setId, requisitions, lines }
}

/** Extended cost, computed rather than stated. */
export function requisitionValue(lines: RequisitionLine[]): number {
  return lines.reduce((n, l) => n + l.quantity * l.unitCost, 0)
}

/**
 * How many customer orders a set of lines protects.
 *
 * Counted from the orders that actually draw the parts, which is the only way
 * a supplier-scoped subset can be guaranteed to report a number less than or
 * equal to the whole. §8.6 calls a group that protects more orders than the
 * requisition containing it "the single most visible arithmetic error the demo
 * can make", and the way to make it impossible is to never author either
 * figure.
 */
export function ordersProtectedBy(lines: RequisitionLine[]): string[] {
  const parts = new Set(lines.map((l) => l.partNumber))
  const protectedOrders = new Set<string>()
  for (const o of openOrders()) {
    const bom = effectiveBom(o.configurationId, TODAY)
    if (bom.some((l) => parts.has(l.partNumber))) protectedOrders.add(o.id)
  }
  return [...protectedOrders]
}

/**
 * Distinct configured builds these lines keep buildable.
 *
 * "Builds protected" was the one figure in the product that was *typed* rather
 * than derived: hardcoded to 2 at the requisition set, and computed at the
 * group as a count of distinct sites — which is a different quantity wearing
 * the same label, and always 1 for a single-site set. Three definitions of one
 * concept, disagreeing with each other, on a screen whose whole argument is
 * that every number comes from one place.
 *
 * An order protected by these lines is an order that can still be built; the
 * builds are the distinct configurations behind those orders. Deriving it from
 * `ordersProtectedBy` also makes the subset rule hold for free — a group's
 * orders are a subset of the whole's, so its configurations are too.
 */
export function buildsProtectedBy(lines: RequisitionLine[]): number {
  const orders = new Set(ordersProtectedBy(lines))
  return new Set(
    openOrders().filter((o) => orders.has(o.id)).map((o) => o.configurationId),
  ).size
}

/* ── Exposure (§11.8, FR-037) ────────────────────────────────────────────── */

export interface ComponentExposure {
  partNumber: string
  configurations: { configurationId: string; label: string; liveOrders: number; quantityPer: number }[]
  configurationCount: number
  configurationsWithOrders: number
  /** Live customer orders standing on those configurations. §20 names this one. */
  liveOrders: number
  forwardDemand: number
}

/**
 * The answer no single product structure gives.
 *
 * A component's real forward demand is the sum across every configuration with
 * live orders. §11.8 puts this at the centre of the Assembly Exposure view
 * because it is the number the planning system is not holding.
 */
export function exposureOf(partNumber: string): ComponentExposure {
  const open = openOrders()
  const rows = CONFIGURATIONS
    .filter((c) => c.finishedPart)
    .map((c) => {
      const id = c.finishedPart as string
      const line = effectiveBom(id, TODAY).find((l) => l.partNumber === partNumber)
      const liveOrders = open.filter((o) => o.configurationId === id)
      return {
        configurationId: id,
        label: c.label,
        liveOrders: liveOrders.length,
        quantityPer: line?.quantityPer ?? 0,
        demand: line ? liveOrders.reduce((n, o) => n + o.quantity * line.quantityPer, 0) : 0,
      }
    })
    .filter((r) => r.quantityPer > 0)

  return {
    partNumber,
    configurations: rows.map(({ demand: _demand, ...r }) => r),
    configurationCount: rows.length,
    configurationsWithOrders: rows.filter((r) => r.liveOrders > 0).length,
    liveOrders: rows.reduce((n, r) => n + r.liveOrders, 0),
    forwardDemand: rows.reduce((n, r) => n + r.demand, 0),
  }
}

export { HERO_ORDER }
