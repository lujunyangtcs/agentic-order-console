import type {
  Api, ActivityItem, CommandCenterSummary, Observation, AnalysisSentence, ActionQueueRow, ReasonCount, StationExposure,
  OrderRow, OrderImpact, CandidateRow, PostBuildPanel, RequisitionProposal,
  RequisitionSet, RequisitionGroup, ValidationCheck, WriteBackResult, WriteBackFailure, ApprovalEmail, AuditEntry,
  InventoryRow, SkuDetail, ProjectionPoint, ProjectionEvent, Alternative, Connector,
} from '../contracts'
import { respond } from './latency'
/* Imported for its side effect as much as its API: loading the store is what
 * publishes __SEED_VERSION__ for the standing verification probe. */
import { whenReady, mutate, getState } from './store'
import { INVENTORY } from '@/fixtures/inventory'
import { openOrders, HERO_ORDER } from '@/fixtures/orders'
import { LEAD_TIME_EVIDENCE } from '@/fixtures/suppliers'
import { PART_BY_NUMBER } from '@/fixtures/parts'
import { TODAY, ts, formatDate } from '@/fixtures/calendar'
import { plural } from '@/lib/format'
import {
  statusOf, readinessOf, buildRequisitionSet, requisitionValue, exposureOf,
  explodeOrder, projectedZeroAfterOrder, ordersProtectedBy, buildsProtectedBy,
} from '@/fixtures/derive'
import { SUPPLIER_BY_ID } from '@/fixtures/suppliers'
import { buildAssemblySheet } from '@/fixtures/assembly/buildSheet'
import { CONFIGURATIONS } from '@/fixtures/configurations'
import { effectiveBom, BOM_LINES } from '@/fixtures/bom'
const BOM_LINE_COUNT = BOM_LINES.length
import { STATIONS, PARTS } from '@/fixtures/parts'
import { SALES_ORDERS, openOrders as allOpenOrders } from '@/fixtures/orders'
import { candidatesFor, allocatable } from '@/fixtures/relationships'
import { incomingCoveredParts, transferCandidateParts, positionAt } from '@/fixtures/inventory'
import { daysBetween } from '@/fixtures/calendar'
import { OPEN_PURCHASE_ORDERS, EXTRACTION_RELIABILITY_FLOOR } from '@/fixtures/suppliers'
import { available as availableAt } from '@/fixtures/derive'
import { CONNECTOR_PROFILE } from '@/app/product'
import { PART_CANDIDATES } from '@/fixtures/relationships'
import { HERO_DRIVERS } from '@/fixtures/inventory'
import { coverageDays, projectedZeroDate } from '@/fixtures/derive'
import { d, daysFromToday } from '@/fixtures/calendar'
import { SITES } from '@/fixtures/configurations'
import {
  analyticsOptions, inventoryHealth, safetyStock, procurement, variantExposure,
} from './analytics'

/**
 * The contract, answered from the fixture.
 *
 * Nothing here is typed out. Every figure the Command Center shows is computed
 * from the same records the order pages, the requisition review and the
 * analytics reports read — which is what makes the nav badge, the KPI tile and
 * the page it links to incapable of disagreeing.
 *
 * That is not a nicety. The the design notes this build follows was rewritten because its
 * first draft contradicted itself in eight places, and every one of those came
 * from a number authored twice.
 */

function summary(): CommandCenterSummary {
  const plantA = INVENTORY.filter((p) => p.site === 'plant-a')
  const status = plantA.map((p) => statusOf(p.partNumber, p.site, p.warehouse))

  const skusRequiringAction = status.filter((s) => s === 'action_required').length
  const blockedByData = status.filter((s) => s === 'blocked').length

  const excessExposure = plantA
    .filter((_, i) => status[i] === 'excess')
    .reduce((n, p) => {
      const cost = PART_BY_NUMBER.get(p.partNumber)?.unitCost ?? 0
      return n + Math.max(0, p.onHand - p.allocated - p.recommendedRangeHigh) * cost
    }, 0)

  const set = buildRequisitionSet(HERO_ORDER)
  const readiness = readinessOf(HERO_ORDER)

  return {
    skusRequiringAction,
    ordersAtRisk: readiness.short > 0 ? openOrders().length : 0,
    draftRequisitionValue: Math.round(requisitionValue(set.lines)),
    approvalsWaiting: set.requisitions.length,
    excessExposure: Math.round(excessExposure),
    blockedByData,
    headline: `${skusRequiringAction} parts need a decision today.`,
    firstAction: firstAction(),
    observations: observations(),
    writtenAnalysis: writtenAnalysis(),
    dataAsOf: ts(0, '07:40'),
  }
}

/**
 * What to open first, by name.
 *
 * The hero order is the answer whenever it has short lines, because a shortage
 * against a promised ship date outranks a policy drift. Naming the record and
 * the verb is what separates a decision hero from a summary.
 */
function firstAction(): CommandCenterSummary['firstAction'] {
  const r = readinessOf(HERO_ORDER)
  if (r.short === 0) return null
  const order = openOrders().find((o) => o.id === HERO_ORDER)
  return {
    label: 'Open the first one',
    href: `/orders/${HERO_ORDER.toLowerCase()}/impact`,
    sentence:
      `Start with ${HERO_ORDER} — ${r.short} components are short against a ship date of ` +
      `${formatDate(order?.requiredShipDate ?? TODAY)}. Resolve the substitute, then raise the requisition.`,
  }
}

/**
 * Observations, counted from this account's own data.
 *
 * Every one is a computation with a threshold, not a sentence someone wrote.
 * If the fixture changes and an observation stops being true, it stops being
 * shown — which is the only way a panel like this stays honest.
 *
 * They are cards rather than sentences because four dense sentences in a
 * bulleted list get read by nobody: the number that matters is buried
 * mid-clause and every item looks like every other one. Split into a figure,
 * its unit and its evidence, the same content is scannable.
 */
function observations(): Observation[] {
  const out: Observation[] = []
  const hero = exposureOf('ABC-1001')

  /* The exposure figure, which is the product's whole argument. */
  out.push({
    key: 'exposure',
    eyebrow: 'Shared exposure',
    title: 'One element stands behind the product line',
    figure: `${hero.configurationCount} of 12`,
    unit: 'configurations consume it',
    meta: `${hero.configurationsWithOrders} hold ${hero.liveOrders} live orders · ${hero.forwardDemand} units forward`,
    tone: 'watch',
    href: '/analytics/variant-exposure',
  })

  const evidence = LEAD_TIME_EVIDENCE.find((e) => e.confirmedBy)
  if (evidence) {
    const onFile = SUPPLIER_BY_ID.get(evidence.supplierId)?.leadTimeDaysOnFile
    if (onFile && evidence.claimedLeadTimeDays !== onFile) {
      const delta = Math.round(((evidence.claimedLeadTimeDays - onFile) / onFile) * 100)
      out.push({
        key: 'lead-time',
        eyebrow: 'Supplier evidence',
        title: 'The lead time on file is out of date',
        figure: `${onFile} → ${evidence.claimedLeadTimeDays}`,
        unit: 'days, confirmed in writing',
        meta: `${SUPPLIER_BY_ID.get(evidence.supplierId)?.name} · +${delta}% · ${formatDate(evidence.receivedAt)}`,
        tone: 'act',
        href: `/inventory/plant-a/main/${evidence.partNumber.toLowerCase()}`,
      })
    }
  }

  const zero = projectedZeroAfterOrder('ABC-1001', 'plant-a', 4)
  const set = buildRequisitionSet(HERO_ORDER)
  const elementLine = set.lines.find((l) => l.partNumber === 'ABC-1001')
  if (zero && elementLine) {
    const gap = daysBetween(zero, elementLine.projectedReceiptDate)
    out.push({
      key: 'coverage',
      eyebrow: 'Coverage gap',
      title: 'Stock reaches zero before the replenishment lands',
      figure: `${gap} days`,
      unit: 'uncovered after this build',
      meta: `zero ${formatDate(zero)} · arrives ${formatDate(elementLine.projectedReceiptDate)}`,
      tone: 'act',
      href: '/inventory/plant-a/main/ABC-1001',
    })
  }

  const stale = LEAD_TIME_EVIDENCE.find((e) => !e.confirmedBy)
  if (stale) {
    out.push({
      key: 'withheld',
      eyebrow: 'Withheld',
      title: 'Evidence too old to recommend against',
      figure: '1',
      unit: 'recommendation withheld',
      meta: `${stale.partNumber} · only evidence dated ${formatDate(stale.receivedAt)}, unconfirmed`,
      tone: 'held',
      href: '/integrations',
    })
  }

  return out
}

/**
 * The written read.
 *
 * The panel used to say "not switched on" and describe what it would cover if
 * it were. That was the right call while there was nothing behind it — a
 * placeholder reading like a real analysis is the one thing that would make a
 * reviewer distrust the counted figures above it.
 *
 * This is switched on, and it is not generated. Every sentence is composed
 * from the same derived figures the cards use, and carries the record it was
 * counted from, so the promise the placeholder made — "every sentence will
 * link to the items it came from" — is the literal implementation rather than
 * a description of one.
 *
 * That constraint is what makes it worth shipping. A model writing prose over
 * this data would produce something smoother and unverifiable; this produces
 * something plainer that a planner can click into and check. It also degrades
 * honestly: a sentence whose condition stops holding stops being written,
 * rather than being written with a stale number in it.
 */
function writtenAnalysis(): AnalysisSentence[] {
  const out: AnalysisSentence[] = []
  const order = openOrders().find((o) => o.id === HERO_ORDER)
  const r = readinessOf(HERO_ORDER)
  const set = buildRequisitionSet(HERO_ORDER)
  const hero = exposureOf('ABC-1001')

  if (order && r.short > 0) {
    out.push({
      key: 'lede',
      text:
        `The account has one order that cannot be built as it stands: ${HERO_ORDER} is ` +
        `${r.short} components short against a ship date of ${formatDate(order.requiredShipDate)}.`,
      linkText: HERO_ORDER,
      href: `/orders/${HERO_ORDER.toLowerCase()}/impact`,
    })
  }

  if (r.belowSafetyAfterBuild > 0) {
    out.push({
      key: 'after-build',
      text:
        `Building it is not the end of the exposure — ${r.belowSafetyAfterBuild} further components ` +
        `fall below policy once the order ships, which is why the draft covers more lines than the shortage does.`,
      linkText: `${r.belowSafetyAfterBuild} further components`,
      href: `/orders/${HERO_ORDER.toLowerCase()}/impact`,
    })
  }

  const evidence = LEAD_TIME_EVIDENCE.find((e) => e.confirmedBy)
  if (evidence) {
    const onFile = SUPPLIER_BY_ID.get(evidence.supplierId)?.leadTimeDaysOnFile
    if (onFile && evidence.claimedLeadTimeDays !== onFile) {
      out.push({
        key: 'supplier',
        text:
          `The reason the recommendation moved is a supplier, not a forecast: ` +
          `${SUPPLIER_BY_ID.get(evidence.supplierId)?.name} confirmed ${evidence.claimedLeadTimeDays} days ` +
          `against the ${onFile} on file, in writing, on ${formatDate(evidence.receivedAt)}.`,
        linkText: 'confirmed',
        href: `/inventory/plant-a/main/${evidence.partNumber.toLowerCase()}`,
      })
    }
  }

  out.push({
    key: 'exposure',
    text:
      `The component at the centre of it is shared: ABC-1001 is consumed by ` +
      `${hero.configurationCount} of 12 configurations, and ${hero.configurationsWithOrders} of those ` +
      `hold ${hero.liveOrders} live orders. A shortage here is not one order's problem.`,
    linkText: `${hero.configurationCount} of 12 configurations`,
    href: '/analytics/variant-exposure',
  })

  const stale = LEAD_TIME_EVIDENCE.find((e) => !e.confirmedBy)
  if (stale) {
    out.push({
      key: 'withheld',
      text:
        `One recommendation is deliberately absent. The only lead-time evidence for ${stale.partNumber} ` +
        `is dated ${formatDate(stale.receivedAt)} and was never confirmed, so nothing is proposed against it.`,
      linkText: 'deliberately absent',
      href: '/integrations',
    })
  }

  out.push({
    key: 'action',
    text:
      `What that adds up to is ${set.lines.length} lines across ${set.requisitions.length} suppliers, ` +
      `worth $${Math.round(requisitionValue(set.lines)).toLocaleString()}, waiting on a person.`,
    linkText: `${set.lines.length} lines across ${set.requisitions.length} suppliers`,
    href: '/replenishment',
  })

  return out
}

/**
 * The priority action queue.
 *
 * Built from the same explosion the order impact page renders, so a row here
 * and the page it opens cannot disagree about what is wrong.
 */
function actionQueue(): ActionQueueRow[] {
  const set = buildRequisitionSet(HERO_ORDER)
  const lines = explodeOrder(HERO_ORDER)
  const order = openOrders().find((o) => o.id === HERO_ORDER)
  const rows: ActionQueueRow[] = []

  const short = lines.filter((l) => l.coverage === 'short')
  if (short.length) {
    rows.push({
      id: 'q-short',
      priority: 'P1',
      trigger: 'Configured order received',
      subject: HERO_ORDER,
      subjectHref: `/orders/${HERO_ORDER.toLowerCase()}/impact`,
      site: 'Plant A',
      issue: `${short.length} components short for the build`,
      needDate: short[0].needDate,
      impact: `${ordersProtectedBy(set.lines).length} orders protected`,
      owner: 'Alex Morgan',
      recommendedAction: 'Review material impact',
      recommendedHref: `/orders/${HERO_ORDER.toLowerCase()}/impact`,
    })
  }

  const resolution = lines.filter((l) => l.qualifiers.includes('part_resolution_review'))
  if (resolution.length) {
    rows.push({
      id: 'q-resolution',
      priority: 'P1',
      trigger: 'Part resolution required',
      subject: resolution[0].partNumber,
      subjectHref: `/orders/${HERO_ORDER.toLowerCase()}/impact`,
      site: 'Plant A',
      issue: 'Substitute proposed — engineering sign-off outstanding',
      needDate: resolution[0].needDate,
      impact: 'Blocks the requisition',
      owner: 'Engineering Approver',
      recommendedAction: 'Compare candidates',
      recommendedHref: `/orders/${HERO_ORDER.toLowerCase()}/impact`,
    })
  }

  const evidence = LEAD_TIME_EVIDENCE.find((e) => e.confirmedBy)
  if (evidence) {
    rows.push({
      id: 'q-leadtime',
      priority: 'P2',
      trigger: 'Supplier lead time changed',
      subject: evidence.partNumber,
      subjectHref: `/inventory/plant-a/main/${evidence.partNumber.toLowerCase()}`,
      site: 'Plant A',
      issue: `Confirmed at ${evidence.claimedLeadTimeDays} days against ` +
             `${SUPPLIER_BY_ID.get(evidence.supplierId)?.leadTimeDaysOnFile} on file`,
      needDate: order?.requiredShipDate ?? null,
      impact: 'Safety target raised 12 → 28',
      owner: 'Alex Morgan',
      recommendedAction: 'Review recommendation',
      recommendedHref: `/inventory/plant-a/main/${evidence.partNumber.toLowerCase()}`,
    })
  }

  if (set.lines.length) {
    rows.push({
      id: 'q-requisition',
      priority: 'P2',
      trigger: 'Replenishment proposed',
      subject: set.setId,
      subjectHref: `/requisitions/${set.setId.toLowerCase()}`,
      site: 'Plant A',
      issue: `${set.lines.length} lines across ${set.requisitions.length} suppliers`,
      needDate: set.lines.map((l) => l.needByDate).sort()[0],
      impact: `$${Math.round(requisitionValue(set.lines)).toLocaleString()}`,
      owner: 'Procurement Approver',
      recommendedAction: 'Review requisition',
      recommendedHref: `/requisitions/${set.setId.toLowerCase()}`,
    })
  }

  const stale = LEAD_TIME_EVIDENCE.find((e) => !e.confirmedBy)
  if (stale) {
    rows.push({
      id: 'q-blocked',
      priority: 'P3',
      trigger: 'Evidence out of policy',
      subject: stale.partNumber,
      subjectHref: `/inventory/plant-a/main/${stale.partNumber.toLowerCase()}`,
      site: 'Plant A',
      issue: `Lead-time evidence dated ${formatDate(stale.receivedAt)}, never confirmed`,
      needDate: null,
      impact: 'Recommendation withheld',
      owner: 'Alex Morgan',
      recommendedAction: 'Confirm with supplier',
      recommendedHref: `/inventory/plant-a/main/${stale.partNumber.toLowerCase()}`,
    })
  }

  return rows
}

/** The queue decomposed by reason — the bridge from the hero count to the work. */
function reasons(): ReasonCount[] {
  const r = readinessOf(HERO_ORDER)
  const plantA = INVENTORY.filter((p) => p.site === 'plant-a')
  const status = plantA.map((p) => statusOf(p.partNumber, p.site, p.warehouse))
  return [
    { key: 'short',      label: 'Short for a committed build', count: r.short,                 href: `/orders/${HERO_ORDER.toLowerCase()}/impact` },
    { key: 'below',      label: 'Below policy after the build', count: r.belowSafetyAfterBuild, href: `/orders/${HERO_ORDER.toLowerCase()}/impact` },
    { key: 'action',     label: 'Breaching policy now',         count: status.filter((s) => s === 'action_required').length, href: '/inventory' },
    { key: 'watch',      label: 'Approaching policy',           count: status.filter((s) => s === 'watch').length,           href: '/inventory' },
    { key: 'blocked',    label: 'Blocked by evidence age',      count: status.filter((s) => s === 'blocked').length,         href: '/inventory' },
  ].filter((x) => x.count > 0)
}

function activity(): ActivityItem[] {
  const set = buildRequisitionSet(HERO_ORDER)
  const exposure = exposureOf('ABC-1001')
  const stale = LEAD_TIME_EVIDENCE.find((e) => !e.confirmedBy)
  const confirmed = LEAD_TIME_EVIDENCE.find((e) => e.confirmedBy)

  return [
    {
      id: 'a1', at: ts(-1, '16:20'), tone: 'attention',
      text: `New configured order ${HERO_ORDER} — ABC-600 Series, 460 V, qty 4`,
      to: '/orders',
    },
    {
      id: 'a2', at: confirmed?.receivedAt ?? ts(-5, '14:12'), tone: 'attention',
      text: `Supplier lead time changed — ABC-1001 now quoted at ${confirmed?.claimedLeadTimeDays ?? 34} days`,
      to: '/inventory/plant-a/main/ABC-1001',
    },
    {
      id: 'a3', at: ts(0, '06:05'), tone: 'neutral',
      text: `ABC-1001 is consumed by ${exposure.configurationCount} of 12 configurations · ${exposure.forwardDemand} units of forward demand`,
      to: '/assemblies/ABC-6107',
    },
    {
      id: 'a4', at: ts(0, '05:40'), tone: 'good',
      text: `Draft requisition set prepared — ${set.lines.length} lines across ${set.requisitions.length} suppliers`,
      to: '/replenishment',
    },
    {
      id: 'a5', at: ts(0, '04:12'), tone: 'attention',
      text: `Recommendation withheld — ${stale?.partNumber ?? 'ABC-SEN-220'} evidence dated ${formatDate(stale?.receivedAt ?? TODAY)}`,
      to: '/inventory',
    },
  ]
}

/**
 * The exposure rail's data.
 *
 * This is the answer the product exists to give, so it is assembled here from
 * the same records every other screen reads rather than shaped for the panel
 * that shows it. Every configuration appears — including the ones that do not
 * consume the part, and including the one nobody can order — because §12.3
 * forbids truncating the matrix. A four-row version of a twelve-row fact
 * understates the exposure by two thirds, and understating it is the specific
 * failure this screen exists to prevent.
 */
function stationExposure(configurationId: string, partId: string): StationExposure | null {
  const { facts } = buildAssemblySheet(configurationId)
  const f = facts[partId]
  if (!f) return null

  const station = STATIONS.find((s) => stationPartId(s, configurationId) === partId)
  const part = PART_BY_NUMBER.get(partId)
  const open = openOrders()

  const all = CONFIGURATIONS.map((c) => {
    const id = c.finishedPart
    const line = id ? effectiveBom(id, TODAY).find((l) => l.partNumber === partId) : undefined
    const orders = id ? open.filter((o) => o.configurationId === id) : []
    return {
      configurationId: id ?? `${c.label} (not orderable)`,
      label: c.label,
      finishedPart: id,
      orderable: c.orderable,
      liveOrders: orders.length,
      quantityPer: line?.quantityPer ?? 0,
      demand: line ? orders.reduce((n, o) => n + o.quantity * line.quantityPer, 0) : 0,
    }
  })

  return {
    station: station?.station ?? 0,
    partId,
    label: part?.description ?? f.label,
    criticality: (part?.criticality ?? 'standard').replace(/_/g, ' '),
    status: statusOf(partId, 'plant-a').replace(/_/g, ' '),
    location: 'Plant A / MAIN',
    configurationCount: f.configurationCount,
    configurationsWithOrders: f.configurationsWithOrders,
    liveOrders: f.liveOrders,
    forwardDemand: f.forwardDemand,
    required: f.required,
    available: f.available,
    positionAfterBuild: f.positionAfterBuild,
    activeTarget: f.activeTarget,
    projectedZero: projectedZeroAfterOrder(partId, 'plant-a', f.required),
    rows: all.filter((r) => r.quantityPer > 0),
    notUsedBy: all.filter((r) => r.quantityPer === 0),
  }
}

/** Resolve which part a station holds for a configuration's voltage group. */
function stationPartId(s: (typeof STATIONS)[number], configurationId: string): string {
  /* Case-insensitive because the identifier arrives through the address bar.
   * Configuration ids used to be pure digits, so this comparison was safe by
   * accident; once they carried letters, `/assemblies/abc-6107` stopped
   * matching `ABC-6107` and the sheet rendered with an empty title. */
  const c = CONFIGURATIONS.find(
    (x) => x.finishedPart?.toLowerCase() === configurationId.toLowerCase(),
  )
  const v = c?.voltage ?? 460
  const group = v <= 120 ? 'low' : v <= 460 ? 'standard' : 'high'
  if (s.fixedPart && (!s.voltageDependent || group === 'standard')) return s.fixedPart
  const key = s.key.toUpperCase().replace(/-/g, '')
  return s.voltageDependent ? `DEMO-${key}-${group.toUpperCase()}` : `DEMO-${key}-STD`
}

/* ── Orders ──────────────────────────────────────────────────────────────── */

function configLabel(id: string): string {
  return CONFIGURATIONS.find((c) => c.finishedPart?.toLowerCase() === id.toLowerCase())?.label ?? id
}

function orderRow(orderId: string): OrderRow {
  const o = SALES_ORDERS.find((x) => x.id === orderId)!
  const r = readinessOf(orderId)
  return {
    id: o.id,
    customer: o.customer,
    configurationId: o.configurationId,
    configurationLabel: configLabel(o.configurationId),
    quantity: o.quantity,
    site: o.site,
    requiredShipDate: o.requiredShipDate,
    /* Covered over analysed. Lines that fall below policy after the build are
     * deliberately outside the numerator: a part that covers this build but
     * breaches its target afterwards is a problem deferred, not readiness. */
    readinessPct: r.analysedLines ? r.covered / r.analysedLines : 0,
    short: r.short,
    belowSafetyAfterBuild: r.belowSafetyAfterBuild,
    blocked: r.blocked,
    analysed: true,
  }
}

/**
 * The analysis trail.
 *
 * Structured steps with evidence and a timestamp, not a chat transcript. §3.2
 * principle 6 is explicit that intelligence appears as findings and
 * calculations; a paragraph of prose asks the reader to trust it, and a step
 * with a count asks them to check it.
 */
function trail(orderId: string): OrderImpact['trail'] {
  const r = readinessOf(orderId)
  const o = SALES_ORDERS.find((x) => x.id === orderId)!
  const set = buildRequisitionSet(orderId)
  return [
    { label: 'Validated configured sales order', state: 'done',
      detail: `${configLabel(o.configurationId)} · quantity ${o.quantity} · ${o.site}`, at: ts(-1, '16:22') },
    { label: 'Selected effective product structure', state: 'done',
      detail: `Revision C, effective on ${formatDate(TODAY)}`, at: ts(-1, '16:22') },
    { label: 'Expanded component requirements', state: 'done',
      detail: `${r.analysedLines} component lines`, at: ts(-1, '16:23') },
    { label: 'Netted inventory, allocations and open supply', state: 'done',
      detail: `${OPEN_PURCHASE_ORDERS.length} open purchase orders considered`, at: ts(-1, '16:23') },
    { label: 'Checked position after the build', state: 'done',
      detail: `${r.belowSafetyAfterBuild} components fall below policy once this order ships`, at: ts(-1, '16:24') },
    { label: 'Part resolution', state: r.partResolutionReview ? 'attention' : 'done',
      detail: r.partResolutionReview
        ? `${r.partResolutionReview} component position has candidates to compare`
        : 'No ambiguous identities', at: ts(-1, '16:24') },
    { label: 'Prepared replenishment recommendation', state: 'done',
      detail: `${set.lines.length} lines across ${set.requisitions.length} suppliers`, at: ts(-1, '16:25') },
  ]
}

function orderImpact(orderId: string): OrderImpact | null {
  if (!SALES_ORDERS.some((o) => o.id === orderId)) return null
  const r = readinessOf(orderId)
  const set = buildRequisitionSet(orderId)
  const lines = explodeOrder(orderId).map((l) => {
    const part = PART_BY_NUMBER.get(l.partNumber)
    const cands = candidatesFor(l.partNumber)
    return {
      partNumber: l.partNumber,
      description: part?.description ?? l.partNumber,
      required: l.required,
      available: l.available,
      openSupply: l.openSupply,
      positionAfterBuild: l.positionAfterBuild,
      activeTarget: l.activeTarget,
      coverage: l.coverage,
      qualifiers: l.qualifiers,
      needDate: l.needDate,
      relationship: cands.length > 1 ? `${cands.length} candidates` : 'Exact',
    }
  })
  return {
    order: orderRow(orderId),
    trail: trail(orderId),
    coverage: { covered: r.covered, belowSafetyAfterBuild: r.belowSafetyAfterBuild, short: r.short },
    qualifiers: { partResolutionReview: r.partResolutionReview, blocked: r.blocked },
    analysedLines: r.analysedLines,
    lines,
    purchaseValueProposed: Math.round(requisitionValue(set.lines)),
  }
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  exact: 'Exact',
  approved_substitute: 'Approved substitute',
  superseded: 'Superseded',
  potential_duplicate: 'Potential duplicate',
  similar_only: 'Similar description',
}

function candidateRows(requiredPart: string): CandidateRow[] {
  const state = getState().decisions
  const allocatedTo = (state[`allocation:${requiredPart}`] as { candidatePart: string } | undefined)?.candidatePart

  return candidatesFor(requiredPart).map((raw) => {
    /* Decisions made during the walk are laid over the authored record rather
     * than written into it, so `sessionStorage.clear()` resets the demo without
     * a rebuild. A sign-off makes the candidate allocatable through the same
     * `allocatable()` rule the fixture uses — the rule is not special-cased for
     * decisions taken live, or the two could diverge. */
    const signed = state[`substitute:${raw.candidatePart}`] as
      { approvedAt: string; approvedBy: string } | undefined
    const c = signed ? { ...raw, approvedAt: signed.approvedAt, approvedBy: signed.approvedBy } : raw

    const part = PART_BY_NUMBER.get(c.candidatePart)
    const m = /(\d+)-(\d+)/.exec(c.candidatePart)
    return {
      partNumber: c.candidatePart,
      description: part?.description ?? c.candidatePart,
      relationship: c.relationship,
      relationshipLabel: RELATIONSHIP_LABEL[c.relationship] ?? c.relationship,
      reason: c.reason,
      allocatable: allocatable(c),
      allocated: allocatedTo === c.candidatePart,
      requiresApprovalFrom: c.requiresApprovalFrom,
      approvedAt: c.approvedAt,
      approvedBy: c.approvedBy,
      available: availableAt(c.candidatePart, 'plant-a'),
      voltage: m ? `${m[1]} V / ${m[2]} Hz` : '460 V / 60 Hz',
    }
  })
}

/**
 * The post-build panel.
 *
 * Nine SKUs, decomposed by how each one is resolved — and the transfer row is
 * marked unactionable on purpose. §23 puts transfer execution on the roadmap,
 * so a panel that resolves a breach with a mechanism the product does not have
 * is a promise it cannot keep. The row appears, says what it is, and does not
 * offer a button.
 */
function postBuild(orderId: string): PostBuildPanel {
  const incoming = new Set(incomingCoveredParts())
  const transfer = new Set(transferCandidateParts())
  const below = explodeOrder(orderId).filter((l) => l.coverage === 'below_safety_after_build')

  const rows = below.map((l) => {
    const part = PART_BY_NUMBER.get(l.partNumber)
    const target = l.activeTarget ?? 0
    if (l.qualifiers.includes('blocked')) {
      return { partNumber: l.partNumber, description: part?.description ?? l.partNumber,
        positionAfterBuild: l.positionAfterBuild, activeTarget: target,
        resolution: 'blocked' as const,
        detail: 'Recommendation withheld — lead-time evidence out of policy',
        actionable: false }
    }
    if (incoming.has(l.partNumber)) {
      const po = OPEN_PURCHASE_ORDERS.find((p) => p.partNumber === l.partNumber)
      return { partNumber: l.partNumber, description: part?.description ?? l.partNumber,
        positionAfterBuild: l.positionAfterBuild, activeTarget: target,
        resolution: 'incoming' as const,
        detail: po ? `${po.quantity} arriving ${formatDate(po.promisedDate)} on ${po.id}` : 'Covered by open supply',
        actionable: true }
    }
    if (transfer.has(l.partNumber)) {
      const src = positionAt(l.partNumber, 'plant-b')
      return { partNumber: l.partNumber, description: part?.description ?? l.partNumber,
        positionAfterBuild: l.positionAfterBuild, activeTarget: target,
        resolution: 'transfer' as const,
        detail: `${src ? src.onHand - src.allocated : 0} available at Plant B · transfer execution is roadmap`,
        actionable: false }
    }
    return { partNumber: l.partNumber, description: part?.description ?? l.partNumber,
      positionAfterBuild: l.positionAfterBuild, activeTarget: target,
      resolution: 'requisition' as const,
      detail: 'Included in the draft requisition', actionable: true }
  })

  return { belowPolicy: rows.length, rows }
}

/**
 * The handoff, and the finding it carries.
 *
 * The two groups of lines run on different clocks and the panel says so. Lines
 * protecting the order come from short-lead-time suppliers and land before the
 * ship date; the safety-restoration lines include one whose supplier has just
 * confirmed a longer lead time, and it arrives after this order ships.
 *
 * That is not a defect in the recommendation, it *is* the finding — and a
 * proposal that reported it as uniformly green would be hiding the one thing
 * worth escalating.
 */
function proposal(orderId: string): RequisitionProposal {
  const set = buildRequisitionSet(orderId)
  const order = SALES_ORDERS.find((o) => o.id === orderId)!
  const needBys = set.lines.map((l) => l.needByDate).sort()

  const late = set.lines
    .filter((l) => l.projectedReceiptDate > order.requiredShipDate)
    .sort((a, b) => b.projectedReceiptDate.localeCompare(a.projectedReceiptDate))[0]

  /* The projection is against what *this order* consumes, not against the
   * requisition quantity.
   *
   * Those are different numbers and confusing them produces nonsense: the
   * requisition quantity is the gap to the safety target, so netting it out of
   * the current position gives a negative and the projection collapses to
   * today. The question the panel asks is "when does what is left after this
   * build run out", and what is left after this build is available minus the
   * build's own demand. */
  const line = late ? explodeOrder(orderId).find((l) => l.partNumber === late.partNumber) : undefined
  const zero = late && line
    ? projectedZeroAfterOrder(late.partNumber, order.site, line.required)
    : null

  return {
    setId: set.setId,
    lines: set.lines.length,
    suppliers: set.requisitions.length,
    value: Math.round(requisitionValue(set.lines)),
    protectOrder: set.lines.filter((l) => l.reason === 'protect_order').length,
    restoreSafety: set.lines.filter((l) => l.reason === 'restore_safety').length,
    customerOrdersProtected: ordersProtectedBy(set.lines).length,
    earliestNeedBy: needBys[0] ?? order.requiredShipDate,
    coverageGap: late && zero ? {
      partNumber: late.partNumber,
      projectedZero: zero,
      replenishmentArrives: late.projectedReceiptDate,
      uncoveredDays: daysBetween(zero, late.projectedReceiptDate),
      shipDate: order.requiredShipDate,
      alternatives: 3,
    } : null,
  }
}

/* ── Replenishment ───────────────────────────────────────────────────────── */

const SET_ORDER = HERO_ORDER

/**
 * Requisitions the reviewer sees, grouped by supplier.
 *
 * §13.2 requires grouping by supplier, site and currency, so the set is three
 * records rather than one spanning three vendors — a single requisition across
 * three suppliers would contradict the consolidation rule on the same screen
 * that states it.
 *
 * Every count in a group header is derived from that group's own lines. The
 * subset rule in §8.6 — no group protects more orders than the set containing
 * it — is not enforced here so much as made unavailable: there is nowhere to
 * author a group figure independently of the whole.
 */
function requisitionSet(setId: string): RequisitionSet | null {
  const built = buildRequisitionSet(SET_ORDER)
  if (setId.toUpperCase() !== built.setId) return null

  const written = getState().decisions[`writeback:${built.setId}`] as
    | { references: Record<string, string> }
    | undefined

  const groups: RequisitionGroup[] = built.requisitions.map((req) => {
    const lines = built.lines.filter((l) => l.requisitionId === req.id)
    const rows = lines.map((l) => {
      const part = PART_BY_NUMBER.get(l.partNumber)
      const pos = positionAt(l.partNumber, l.site)
      return {
        id: l.id,
        requisitionId: l.requisitionId,
        partNumber: l.partNumber,
        description: part?.description ?? l.partNumber,
        reason: l.reason,
        available: pos ? pos.onHand - pos.allocated : 0,
        recommendedSafety: pos?.recommendedSafetyStock ?? 0,
        projectedShortfall: l.rawNeed,
        existingSupply: OPEN_PURCHASE_ORDERS
          .filter((p) => p.partNumber === l.partNumber)
          .reduce((n, p) => n + p.quantity, 0),
        rawNeed: l.rawNeed,
        quantity: l.quantity,
        moq: part?.moq ?? 1,
        orderMultiple: part?.orderMultiple ?? 1,
        needByDate: l.needByDate,
        leadTimeDays: l.leadTimeDays,
        projectedReceiptDate: l.projectedReceiptDate,
        unitCost: l.unitCost,
        extendedCost: Math.round(l.quantity * l.unitCost),
        confidence: pos?.confidence ?? 'medium',
        warnings: l.quantity > l.rawNeed
          ? [`MOQ ${part?.moq} exceeds a need of ${l.rawNeed}`]
          : [],
      }
    })
    const leadTimes = rows.map((r) => r.leadTimeDays)
    return {
      id: req.id,
      supplierId: req.supplierId,
      supplierName: SUPPLIER_BY_ID.get(req.supplierId)?.name ?? req.supplierId,
      site: req.site,
      currency: req.currency,
      lines: rows,
      spend: rows.reduce((n, r) => n + r.extendedCost, 0),
      leadTimeRange: [Math.min(...leadTimes), Math.max(...leadTimes)] as [number, number],
      earliestNeedBy: rows.map((r) => r.needByDate).sort()[0],
      customerOrdersProtected: ordersProtectedBy(lines).length,
      buildsProtected: buildsProtectedBy(lines),
      externalReference: written?.references[req.id] ?? null,
    }
  })

  const order = SALES_ORDERS.find((o) => o.id === SET_ORDER)!
  const late = built.lines.filter((l) => l.projectedReceiptDate > order.requiredShipDate)
  const substitute = PART_CANDIDATES.find((c) => c.requiresApprovalFrom && c.approvedAt)
  const blocked = explodeOrder(SET_ORDER).filter((l) => l.qualifiers.includes('blocked'))
  const rounded = built.lines.filter((l) => l.quantity > l.rawNeed)

  /**
   * The checklist, with warnings and blocks kept apart.
   *
   * §13.3 says blocking failures disable the primary CTA, and FR-018 makes an
   * unresolved approval one of them. The substitute is therefore signed off
   * before this screen, and appears here as a completed check with its
   * timestamp — not as an outstanding item beside an enabled button.
   *
   * The timing entry is a genuine warning: it records the finding rather than
   * hiding it, and it does not block, because a requisition that lands after
   * the order it accompanies is still the right requisition.
   */
  const checks: ValidationCheck[] = [
    { label: 'Supplier assigned for every line', state: 'pass',
      detail: `${built.lines.length} lines across ${groups.length} suppliers` },
    { label: 'MOQ and order multiple satisfied', state: 'pass',
      detail: rounded.length
        ? `${plural(rounded.length, 'line')} rounded up — ${rounded[0].partNumber} needs ${rounded[0].rawNeed}, MOQ ${PART_BY_NUMBER.get(rounded[0].partNumber)?.moq}`
        : 'No rounding required' },
    { label: 'Open supply netted', state: 'pass',
      detail: `${OPEN_PURCHASE_ORDERS.length} open purchase orders considered` },
    { label: 'Unit-of-measure mappings valid', state: 'pass', detail: 'All lines in EA' },
    { label: 'Part-resolution decisions complete', state: 'pass',
      detail: substitute
        ? `${substitute.candidatePart} signed off ${formatDate(substitute.approvedAt!)} by ${substitute.approvedBy}`
        : 'No candidates outstanding' },
    { label: 'Evidence freshness within policy', state: 'pass',
      detail: blocked.length
        ? `${blocked.length} recommendation withheld and excluded from this set`
        : 'All evidence current' },
    late.length
      ? { label: 'Need-by achievable at confirmed lead times', state: 'warn',
          detail: `${plural(late.length, 'line')} arrives ${formatDate(late[0].projectedReceiptDate)}, after this order ships. Reviewed and accepted.` }
      : { label: 'Need-by achievable at confirmed lead times', state: 'pass',
          detail: 'Every line lands before its need-by date' },
  ]

  return {
    setId: built.setId,
    site: order.site,
    status: written ? 'written' : 'ready',
    groups,
    totalLines: built.lines.length,
    totalSpend: Math.round(requisitionValue(built.lines)),
    customerOrdersProtected: ordersProtectedBy(built.lines).length,
    buildsProtected: buildsProtectedBy(built.lines),
    checks,
    canWriteBack: !checks.some((c) => c.state === 'block'),
  }
}

/**
 * Write-back.
 *
 * The external references are assigned here and nowhere earlier. Showing an
 * ERP's own reference before the ERP has been called is the detail that tells
 * an integration-minded viewer the whole thing is theatre — and they are in the
 * room specifically to notice it. The numbers come from an independent sequence
 * and share no digits with the internal draft id or the sales order.
 */
function writeBack(setId: string, simulate?: WriteBackFailure): WriteBackResult {
  const built = buildRequisitionSet(SET_ORDER)
  if (setId.toUpperCase() !== built.setId) throw new Error(`[mock] unknown requisition set ${setId}`)
  const key = `writeback:${built.setId}`
  const existing = getState().decisions[key] as { references: Record<string, string> } | undefined

  /* §13.6's two transport failures, reachable on demand.
   *
   * These are the only two rows of that table that are not data conditions —
   * the other five (missing vendor, UOM mismatch, stale evidence, low-confidence
   * extraction, validation rejection) are already pre-flight checks derived from
   * the fixture, and on this set they pass because the set is clean by
   * construction, which is what §13.3 requires of an enabled primary control.
   *
   * A timeout and a mail outage have no fixture representation, so they are
   * requested explicitly rather than rolled at random. Randomness in a live
   * walk-through is a hazard: the presenter cannot choose to show the recovery,
   * and cannot choose not to.
   *
   * The ERP timeout returns no references, because none were issued. The email
   * failure returns all of them, because the requisitions exist — that
   * distinction is the entire content of FR-021 and the reason the two are
   * separate failures rather than one. */
  if (simulate === 'erp-timeout') {
    return {
      stage: 'creating',
      references: [],
      correlationId: `TRC-${built.setId.slice(-4)}-5502`,
      emailSent: false,
    }
  }

  /* A sequence with nothing in common with ours.
   *
   * The first attempt used PR-104829, which contains "10482" — the whole of the
   * sales order's number. Two independent ERP sequences do not collide on five
   * consecutive digits, and a reviewer who spots it has been handed a reason to
   * doubt every other integration claim on the screen. This range shares no
   * digit run with either SO-ABC-10482 or REQ-DEMO-0007. */
  const references = existing?.references ?? Object.fromEntries(
    built.requisitions.map((r, i) => [r.id, `PR-${386_417 + i}`]),
  )

  if (!existing) {
    mutate((st) => {
      st.decisions[key] = { references, at: ts(0, '09:14') }
    })
  }

  return {
    stage: 'email_sent',
    references: built.requisitions.map((r) => {
      const lines = built.lines.filter((l) => l.requisitionId === r.id)
      return {
        requisitionId: r.id,
        externalReference: references[r.id],
        lines: lines.length,
        spend: Math.round(requisitionValue(lines)),
      }
    }),
    /* PR success and email success are independent (FR-021). An email failure
     * never rolls back a requisition that the ERP has already accepted. */
    emailSent: simulate !== 'email-failure',
    ...(simulate === 'email-failure'
      ? { stage: 'created' as const, correlationId: `TRC-${built.setId.slice(-4)}-7731` }
      : null),
  }
}

/**
 * Allocating a candidate, and signing one off.
 *
 * Both write to the decision store rather than to the fixture, so the walk can
 * be reset without rebuilding: `sessionStorage.clear()` puts every candidate
 * back to where the dataset left it. Both also emit an audit entry, because a
 * part-resolution decision that leaves no trace is exactly what §16.4 exists to
 * prevent — and because the audit page is on the click path two beats later.
 */
function allocate(requiredPart: string, candidatePart: string): CandidateRow[] {
  mutate((st) => {
    st.decisions[`allocation:${requiredPart}`] = { candidatePart, at: ts(0, '09:26') }
  })
  return candidateRows(requiredPart)
}

function approveSubstitute(requiredPart: string, candidatePart: string): CandidateRow[] {
  mutate((st) => {
    st.decisions[`substitute:${candidatePart}`] = {
      approvedAt: d(0), approvedBy: 'Engineering Approver', at: ts(0, '09:24'),
    }
  })
  return candidateRows(requiredPart)
}

function setStatus(setId: string, status: 'saved' | 'rejected'): RequisitionSet {
  mutate((st) => {
    st.decisions[`set-status:${setId.toUpperCase()}`] = { status, at: ts(0, '09:20') }
  })
  const next = requisitionSet(setId)
  if (!next) throw new Error(`[mock] unknown requisition set ${setId}`)
  return next
}

/**
 * Retrying the email, and only the email.
 *
 * FR-021 and §13.6: the requisitions were accepted and stay accepted. The
 * retry returns the same references it returned before — a retry that minted
 * new ones would mean the first attempt had created records nobody can now
 * find.
 */
function retryEmail(setId: string): WriteBackResult {
  return { ...writeBack(setId), emailSent: true, correlationId: undefined }
}

function approvalEmail(setId: string): ApprovalEmail {
  const built = buildRequisitionSet(SET_ORDER)
  if (setId.toUpperCase() !== built.setId) throw new Error(`[mock] unknown requisition set ${setId}`)
  const order = SALES_ORDERS.find((o) => o.id === SET_ORDER)!
  const late = built.lines
    .filter((l) => l.projectedReceiptDate > order.requiredShipDate)
    .sort((a, b) => b.projectedReceiptDate.localeCompare(a.projectedReceiptDate))[0]
  const ev = LEAD_TIME_EVIDENCE.find((e) => e.partNumber === late?.partNumber)
  const line = late ? explodeOrder(SET_ORDER).find((l) => l.partNumber === late.partNumber) : undefined
  const zero = late && line ? projectedZeroAfterOrder(late.partNumber, order.site, line.required) : null

  return {
    to: 'Procurement Approver (demo)',
    subject: `Approval required — ${built.setId} (${built.requisitions.length} requisitions) for ${SET_ORDER}`,
    lines: built.lines.length,
    suppliers: built.requisitions.length,
    spend: Math.round(requisitionValue(built.lines)),
    earliestNeedBy: built.lines.map((l) => l.needByDate).sort()[0],
    customerOrdersProtected: ordersProtectedBy(built.lines).length,
    buildsProtected: buildsProtectedBy(built.lines),
    /* One thing surfaced rather than buried. An approval request that reads as
     * uniformly green teaches the approver to stop reading it. */
    attention: late && ev && zero
      ? `${late.partNumber} — ${ev.supplierId === 'sup-industrial' ? SUPPLIER_BY_ID.get(ev.supplierId)?.name : 'the supplier'} ` +
        `has confirmed ${ev.claimedLeadTimeDays} days against ` +
        `${SUPPLIER_BY_ID.get(ev.supplierId)?.leadTimeDaysOnFile} on file. Replenishment arrives ` +
        `${formatDate(late.projectedReceiptDate)}, after ${SET_ORDER} ships. This order is unaffected; ` +
        `exposure is to orders promised after ${formatDate(zero)}.`
      : null,
    reviewHref: `/requisitions/${built.setId.toLowerCase()}`,
  }
}

/**
 * The audit trail.
 *
 * Derived from what actually happened rather than seeded, so an entry exists
 * because a decision was recorded — which is the only way an audit log means
 * anything.
 */
function auditEntries(): AuditEntry[] {
  const built = buildRequisitionSet(SET_ORDER)
  const out: AuditEntry[] = []
  const substitute = PART_CANDIDATES.find((c) => c.approvedAt)

  /* Decisions taken during the walk, in the same log as the authored ones.
   * An approval the presenter performs on screen and then cannot find in the
   * audit two clicks later is worse than one they never performed. */
  const state = getState().decisions
  for (const [k, v] of Object.entries(state)) {
    if (k.startsWith('substitute:')) {
      const rec = v as { approvedAt: string; approvedBy: string; at: string }
      const part = k.slice('substitute:'.length)
      out.push({
        id: `aud-live-sub-${part}`, at: rec.at, actor: rec.approvedBy,
        entity: part, action: 'Released a superseded revision against a deviation',
        before: 'Not valid for new builds', after: 'Released for this build',
        evidence: 'Signed off in this session', externalReference: null,
      })
    }
    if (k.startsWith('allocation:')) {
      const rec = v as { candidatePart: string; at: string }
      out.push({
        id: `aud-live-alloc-${rec.candidatePart}`, at: rec.at, actor: 'Alex Morgan',
        entity: rec.candidatePart, action: 'Allocated a candidate to the required position',
        before: k.slice('allocation:'.length), after: rec.candidatePart,
        evidence: 'Chosen in the part-resolution drawer', externalReference: null,
      })
    }
    if (k.startsWith('set-status:')) {
      const rec = v as { status: string; at: string }
      out.push({
        id: `aud-live-set-${rec.status}`, at: rec.at, actor: 'Alex Morgan',
        entity: k.slice('set-status:'.length),
        action: rec.status === 'rejected' ? 'Rejected the draft requisition set' : 'Saved the draft requisition set',
        before: 'Ready for review', after: rec.status === 'rejected' ? 'Rejected' : 'Saved as draft',
        evidence: 'No supplier was contacted', externalReference: null,
      })
    }
  }

  if (substitute) {
    out.push({
      id: 'aud-sub', at: ts(-1, '15:40'), actor: substitute.approvedBy ?? 'Engineering Approver',
      entity: substitute.candidatePart, action: 'Approved substitute for allocation',
      before: 'Awaiting engineering sign-off', after: 'Approved',
      evidence: `Compared against ${substitute.requiredPart}`, externalReference: null,
    })
  }

  const ev = LEAD_TIME_EVIDENCE.find((e) => e.confirmedBy)
  if (ev) {
    out.push({
      id: 'aud-lt', at: ev.receivedAt, actor: ev.confirmedBy!,
      entity: ev.partNumber, action: 'Confirmed supplier lead time from evidence',
      before: `${SUPPLIER_BY_ID.get(ev.supplierId)?.leadTimeDaysOnFile} days on file`,
      after: `${ev.claimedLeadTimeDays} days confirmed`,
      evidence: ev.subject, externalReference: null,
    })
  }

  out.push({
    id: 'aud-rec', at: ts(-1, '16:25'), actor: 'Inventory Intelligence',
    entity: built.setId, action: 'Prepared replenishment recommendation',
    before: null, after: `${built.lines.length} lines across ${built.requisitions.length} suppliers`,
    evidence: `Order ${SET_ORDER}`, externalReference: null,
  })

  const written = getState().decisions[`writeback:${built.setId}`] as
    | { references: Record<string, string>; at: string } | undefined
  if (written) {
    for (const req of built.requisitions) {
      out.push({
        id: `aud-wb-${req.id}`, at: written.at, actor: 'Alex Morgan',
        entity: req.id, action: `Created draft requisition in ${CONNECTOR_PROFILE.shortName}`,
        before: 'Draft, internal', after: 'Accepted by the system of record',
        evidence: null, externalReference: written.references[req.id],
      })
    }
    out.push({
      id: 'aud-email', at: written.at, actor: 'Inventory Intelligence',
      entity: built.setId, action: 'Sent approval request',
      before: null, after: 'Procurement Approver (demo)',
      evidence: 'Internal approval email', externalReference: null,
    })
  }

  return out.sort((a, b) => b.at.localeCompare(a.at))
}

/* ── Inventory intelligence ──────────────────────────────────────────────── */

const CRITICALITY_LABEL: Record<string, string> = {
  production_critical: 'Production critical',
  operational_essential: 'Operational essential',
  standard: 'Standard',
  consumable: 'Consumable',
}

function inventoryRows(): InventoryRow[] {
  const siteName = (id: string) => SITES.find((s) => s.id === id)?.name ?? id
  return INVENTORY.map((p) => {
    const part = PART_BY_NUMBER.get(p.partNumber)
    const ex = exposureOf(p.partNumber)
    return {
      partNumber: p.partNumber,
      description: part?.description ?? p.partNumber,
      site: siteName(p.site),
      warehouse: p.warehouse,
      criticality: CRITICALITY_LABEL[part?.criticality ?? 'standard'],
      status: statusOf(p.partNumber, p.site, p.warehouse),
      available: p.onHand - p.allocated,
      currentSafety: p.currentSafetyStock,
      recommendedSafety: p.recommendedSafetyStock,
      /* Null, not zero. "No parameter is maintained" and "the parameter is
       * zero" are different facts, and §1.1 A-05 says the first may be true of
       * the whole item master. Rendering one as the other would hide the
       * condition the discovery call exists to test. */
      delta: p.currentSafetyStock === null ? null : p.recommendedSafetyStock - p.currentSafetyStock,
      projectedBreach: projectedZeroDate(p.partNumber, p.site, p.warehouse),
      variantExposure: ex.configurationsWithOrders,
      openSupply: OPEN_PURCHASE_ORDERS
        .filter((o) => o.partNumber === p.partNumber && o.site === p.site)
        .reduce((n, o) => n + o.quantity, 0),
      confidence: p.confidence,
    }
  })
}

/**
 * The time-phased projection.
 *
 * Sixty days, because the horizon has to exceed the longest confirmed lead time
 * plus a fortnight — otherwise the chart cannot show the receipt of the
 * requisition the demo just created, which is the one thing it is being opened
 * to show.
 *
 * History is actual and forecast is projected, and they are separate fields so
 * the component can draw them differently. §15.6 requires line style as well as
 * colour to carry that distinction; a dashed forecast survives a black-and-white
 * printout, a lighter shade does not.
 */
function projection(partNumber: string, site: string, warehouse: string) {
  const pos = positionAt(partNumber, site, warehouse)
  if (!pos) return { points: [] as ProjectionPoint[], events: [] as ProjectionEvent[] }

  const HISTORY = 30
  const HORIZON = 60
  const points: ProjectionPoint[] = []
  const available = pos.onHand - pos.allocated

  /* Backwards from today at the same draw, so the history line meets the
   * forecast at the position actually on hand rather than near it. */
  for (let i = -HISTORY; i < 0; i++) {
    points.push({ date: d(i), actual: Math.round(available - i * pos.averageDailyUsage), forecast: null })
  }

  const receipts = OPEN_PURCHASE_ORDERS
    .filter((o) => o.partNumber === partNumber && o.site === site)
    .map((o) => ({ date: o.promisedDate, qty: o.quantity }))

  const built = buildRequisitionSet(HERO_ORDER)
  const onReq = built.lines.find((l) => l.partNumber === partNumber)
  if (onReq) receipts.push({ date: onReq.projectedReceiptDate, qty: onReq.quantity })

  let running = available
  for (let i = 0; i <= HORIZON; i++) {
    const date = d(i)
    for (const r of receipts) if (r.date === date) running += r.qty
    running -= pos.averageDailyUsage
    points.push({
      date,
      actual: i === 0 ? available : null,
      forecast: Math.round(Math.max(running, -20) * 10) / 10,
    })
  }

  const events: ProjectionEvent[] = []
  for (const r of receipts) {
    if (daysFromToday(r.date) <= HORIZON) {
      events.push({ date: r.date, kind: 'receipt', label: `+${r.qty} received`, quantity: r.qty })
    }
  }
  const order = SALES_ORDERS.find((o) => o.id === HERO_ORDER)
  const line = explodeOrder(HERO_ORDER).find((l) => l.partNumber === partNumber)
  if (order && line && line.required > 0) {
    events.push({ date: order.requiredShipDate, kind: 'demand', label: `${HERO_ORDER} · ${line.required}`, quantity: line.required })
  }
  const breach = projectedZeroAfterOrder(partNumber, site, line?.required ?? 0, warehouse)
  if (breach && daysFromToday(breach) >= 0 && daysFromToday(breach) <= HORIZON) {
    events.push({ date: breach, kind: 'breach', label: 'Position reaches zero', quantity: null })
  }

  return { points, events }
}

/**
 * The alternatives, ranked and none of them executed.
 *
 * §12.3 requires them ranked with impact, cost, time and approver — and §23
 * puts transfer and expedite execution on the roadmap, so those two say so
 * rather than offering a control that would not work.
 */
function alternatives(partNumber: string, site: string): Alternative[] {
  const built = buildRequisitionSet(HERO_ORDER)
  const line = built.lines.find((l) => l.partNumber === partNumber)
  const src = SITES.map((s) => s.id).filter((id) => id !== site)
    .map((id) => ({ id, pos: positionAt(partNumber, id) }))
    .find((x) => x.pos && x.pos.onHand - x.pos.allocated > 0)

  const out: Alternative[] = []
  if (line) {
    out.push({
      rank: 1, label: `Purchase ${line.quantity} at the recommended quantity`,
      impact: `Restores the target on ${formatDate(line.projectedReceiptDate)}`,
      costDelta: `$${Math.round(line.quantity * line.unitCost).toLocaleString()}`,
      time: `${line.leadTimeDays} days`, requiredApprover: 'Procurement Approver',
      actionable: true, note: null,
    })
  }
  if (src?.pos) {
    const qty = src.pos.onHand - src.pos.allocated
    out.push({
      rank: 2, label: `Transfer ${qty} from ${SITES.find((s) => s.id === src.id)?.name}`,
      impact: 'Closes the uncovered window without new spend',
      costDelta: 'Internal move', time: '2 days', requiredApprover: 'Planner',
      actionable: false, note: 'Transfer execution is roadmap — see the expansion path',
    })
  }
  out.push({
    rank: 3, label: 'Expedite an open purchase order',
    impact: 'Pulls an existing receipt forward',
    costDelta: 'Premium freight, unquoted', time: 'Supplier-dependent',
    requiredApprover: 'Procurement Approver',
    actionable: false, note: 'Expedite workflow is roadmap',
  })
  out.push({
    rank: 4, label: 'Accept temporary coverage risk',
    impact: 'No action; exposure remains on orders promised in the window',
    costDelta: 'None', time: 'Immediate', requiredApprover: 'Planner',
    actionable: true, note: null,
  })
  return out
}

function skuDetail(site: string, warehouse: string, partNumber: string): SkuDetail | null {
  const siteId = SITES.find((s) => s.id === site.toLowerCase() || s.name.toLowerCase() === site.toLowerCase())?.id
  if (!siteId) return null
  const wh = warehouse.toUpperCase()
  const pos = positionAt(partNumber, siteId, wh)
  if (!pos) return null

  const part = PART_BY_NUMBER.get(partNumber)
  const ev = LEAD_TIME_EVIDENCE.find((e) => e.partNumber === partNumber)
  const { points, events } = projection(partNumber, siteId, wh)
  const drivers = HERO_DRIVERS.filter((x) => x.partNumber === partNumber)
    .map(({ partNumber: _p, ...rest }) => rest)

  const built = buildRequisitionSet(HERO_ORDER)
  const line = built.lines.find((l) => l.partNumber === partNumber)
  const written = getState().decisions[`writeback:${built.setId}`]

  return {
    partNumber,
    description: part?.description ?? partNumber,
    site: SITES.find((s) => s.id === siteId)?.name ?? siteId,
    warehouse: wh,
    criticality: CRITICALITY_LABEL[part?.criticality ?? 'standard'],
    status: statusOf(partNumber, siteId, wh),
    onHand: pos.onHand,
    allocated: pos.allocated,
    available: pos.onHand - pos.allocated,
    currentSafety: pos.currentSafetyStock,
    recommendedSafety: pos.recommendedSafetyStock,
    rangeLow: pos.recommendedRangeLow,
    rangeHigh: pos.recommendedRangeHigh,
    coverageDays: coverageDays(partNumber, siteId, wh),
    averageDailyUsage: pos.averageDailyUsage,
    confidence: pos.confidence,
    confidencePct: pos.confidencePct,
    drivers,
    driversTotal: Math.round(drivers.reduce((n, x) => n + x.value, 0) * 10) / 10,
    projection: points,
    events,
    horizonDays: 60,
    exposure: stationExposure('ABC-6107', partNumber),
    evidence: ev ? {
      supplier: SUPPLIER_BY_ID.get(ev.supplierId)?.name ?? ev.supplierId,
      partNumber: ev.partNumber,
      claimedLeadTimeDays: ev.claimedLeadTimeDays,
      leadTimeOnFile: SUPPLIER_BY_ID.get(ev.supplierId)?.leadTimeDaysOnFile ?? 0,
      receivedAt: ev.receivedAt,
      subject: ev.subject,
      excerpt: ev.excerpt,
      extractionReliability: ev.extractionReliability,
      needsConfirmation: ev.extractionReliability < EXTRACTION_RELIABILITY_FLOOR || !ev.confirmedBy,
      confirmedBy: ev.confirmedBy,
    } : null,
    alternatives: alternatives(partNumber, siteId),
    /* Flow 2 opens on a SKU that flow 1 has already put on a requisition. Not
     * showing that would let the page recommend buying something already
     * bought — §13.2 requires open requisitions to be netted, and the screen
     * has to obey the rule the engine does. */
    onRequisition: line && written ? {
      setId: built.setId, quantity: line.quantity, arrives: line.projectedReceiptDate,
    } : null,
  }
}

/* ── Integrations ────────────────────────────────────────────────────────── */

/**
 * Connectors, described honestly.
 *
 * Two of the four are not connected, and they say so. The spec lists them as
 * subject to discovery and puts cycle-count evidence outside the scope
 * entirely, so a card claiming a live feed would contradict the document twice.
 *
 * It is also better salesmanship. A page where everything is green invites
 * nothing; a page with two honest gaps is the natural cue to ask what those
 * systems actually are — which is the question the first client conversation
 * exists to answer.
 *
 * Connection state and freshness are separate fields (§16.3). A connector can
 * be perfectly reachable and still be serving something stale, and collapsing
 * the two hides exactly the case worth surfacing.
 */
function connectors(): Connector[] {
  const totalRecords = INVENTORY.length + PARTS.length + BOM_LINE_COUNT + SALES_ORDERS.length
  return [
    {
      id: 'erp',
      name: CONNECTOR_PROFILE.displayName,
      connected: true,
      freshness: 'fresh',
      permissions: 'Read on items, structures, inventory, orders and vendors. Write limited to draft requisitions.',
      objects: ['Item master', 'Product structure', 'Inventory positions', 'Sales orders', 'Purchase orders', 'Vendors'],
      records: totalRecords,
      lastSync: ts(0, '07:40'),
      writeBack: 'Approved draft requisitions',
      /* The assumption, on the screen rather than only in the document. */
      note: CONNECTOR_PROFILE.confirmed
        ? null
        : 'Example connector — the system of record has not been confirmed. The profile is configuration, not code.',
      evidence: null,
      mappingIssues: 0,
    },
    {
      id: 'mail',
      name: 'Mail platform · procurement mailbox',
      connected: true,
      freshness: 'fresh',
      permissions: 'Read on a single scoped mailbox. Send limited to internal approval requests.',
      objects: ['Supplier acknowledgements', 'Revised lead times', 'MOQ and expedite notes'],
      records: LEAD_TIME_EVIDENCE.length,
      recordsLabel: 'Evidence extracted',
      lastSync: ts(0, '07:12'),
      writeBack: 'Internal approval email',
      note: null,
      /* The one integration claim with hard evidence behind it. */
      evidence: 'Mail platform confirmed from public DNS — MX, SPF and tenant records all resolve to the mail platform.',
      mappingIssues: 0,
    },
    {
      id: 'bom',
      name: 'Engineering structures · CAD or PLM',
      connected: false,
      freshness: null,
      permissions: 'Not established',
      objects: ['Variant structure', 'Revisions and effective dates', 'Approved substitutions'],
      records: null,
      lastSync: null,
      writeBack: null,
      note: 'Not connected. Where the manufacturing structure is actually maintained is an open question — structures here are demo fixtures.',
      evidence: null,
      mappingIssues: 0,
    },
    {
      id: 'counts',
      name: 'Warehouse counts · WMS or scanner feed',
      connected: false,
      freshness: null,
      permissions: 'Not established',
      objects: ['Last physical count', 'Count age', 'Quarantine and quality hold'],
      records: null,
      lastSync: null,
      writeBack: null,
      note: 'Not connected, and deliberately out of scope. Nothing here claims physical inventory without count evidence.',
      evidence: null,
      mappingIssues: 0,
    },
  ]
}

export const mockApi: Api = {
  dashboard: {
    summary: () => whenReady().then(() => respond(summary())),
    actionQueue: () => whenReady().then(() => respond(actionQueue())),
    reasons: () => whenReady().then(() => respond(reasons())),
  },
  activity: {
    recent: (limit = 12) => whenReady().then(() => respond(activity().slice(0, limit))),
  },
  orders: {
    list: () => whenReady().then(() => respond(allOpenOrders().map((o) => orderRow(o.id)))),
    impact: (orderId) => whenReady().then(() => respond(orderImpact(orderId))),
    candidates: (requiredPart) => whenReady().then(() => respond(candidateRows(requiredPart))),
    allocate: (requiredPart, candidatePart) =>
      whenReady().then(() => respond(allocate(requiredPart, candidatePart), 420)),
    approveSubstitute: (requiredPart, candidatePart) =>
      whenReady().then(() => respond(approveSubstitute(requiredPart, candidatePart), 520)),
    postBuild: (orderId) => whenReady().then(() => respond(postBuild(orderId))),
    proposal: (orderId) => whenReady().then(() => respond(proposal(orderId))),
  },
  integrations: {
    connectors: () => whenReady().then(() => respond(connectors())),
  },
  analytics: {
    options: () => whenReady().then(() => respond(analyticsOptions())),
    inventoryHealth: (f) => whenReady().then(() => respond(inventoryHealth(f))),
    safetyStock: (f) => whenReady().then(() => respond(safetyStock(f))),
    procurement: (f) => whenReady().then(() => respond(procurement(f))),
    variantExposure: (f) => whenReady().then(() => respond(variantExposure(f))),
  },
  inventory: {
    list: () => whenReady().then(() => respond(inventoryRows())),
    detail: (site, warehouse, partNumber) =>
      whenReady().then(() => respond(skuDetail(site, warehouse, partNumber))),
  },
  replenishment: {
    set: (setId) => whenReady().then(() => respond(requisitionSet(setId))),
    writeBack: (setId, simulate) => whenReady().then(() => respond(writeBack(setId, simulate), 900)),
    setStatus: (setId, status) => whenReady().then(() => respond(setStatus(setId, status), 420)),
    retryEmail: (setId) => whenReady().then(() => respond(retryEmail(setId), 700)),
    email: (setId) => whenReady().then(() => respond(approvalEmail(setId))),
    audit: () => whenReady().then(() => respond(auditEntries())),
  },
  assembly: {
    sheet: (configurationId) =>
      whenReady().then(() => respond(buildAssemblySheet(configurationId).sheet)),
    exposure: (configurationId, partId) =>
      whenReady().then(() => respond(stationExposure(configurationId, partId))),
    summary: (configurationId) =>
      whenReady().then(() => {
        const { sheet, belowSafetyCount } = buildAssemblySheet(configurationId)
        const by = (s: string) => sheet.stations.filter((st) => st.status === s).length
        return respond({
          stations: sheet.stations.length,
          shortage: by('shortage'),
          substitute: by('substitute'),
          blocked: by('blocked'),
          belowSafetyAfterBuild: belowSafetyCount,
        })
      }),
  },
}
