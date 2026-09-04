import type {
  AnalyticsFilters, InventoryHealthReport, SafetyStockReport,
  ProcurementReport, VariantReport, DrillRow, Categorical,
} from '../contracts'
import { INVENTORY } from '@/fixtures/inventory'
import { PART_BY_NUMBER, PARTS } from '@/fixtures/parts'
import { SITES, CONFIGURATIONS } from '@/fixtures/configurations'
import { SUPPLIERS, SUPPLIER_BY_ID, RECEIVED_PURCHASE_ORDERS, OPEN_PURCHASE_ORDERS } from '@/fixtures/suppliers'
import { BOM_LINES, effectiveBom } from '@/fixtures/bom'
import { openOrders, HERO_ORDER } from '@/fixtures/orders'
import { TODAY, d, daysBetween } from '@/fixtures/calendar'
import { statusOf, buildRequisitionSet, requisitionValue, exposureOf } from '@/fixtures/derive'

/**
 * Analytics, computed from the same records the operational screens read.
 *
 * Nothing here is a second dataset. A management view whose totals disagree
 * with the queue underneath it is worse than no management view, and the only
 * way to guarantee they agree is to compute both from the same place.
 *
 * Every KPI carries a footnote naming what it was counted from. A rate with no
 * denominator cannot be checked, which makes it decoration.
 */

const STATUS_LABEL: Record<string, string> = {
  healthy: 'Healthy', excess: 'Excess', watch: 'Watch',
  action_required: 'Action required', blocked: 'Blocked',
}

const CRITICALITY_LABEL: Record<string, string> = {
  production_critical: 'Production critical',
  operational_essential: 'Operational essential',
  standard: 'Standard',
  consumable: 'Consumable',
}

/** A part's family, taken from its identifier prefix. */
function family(partNumber: string): string {
  if (/^10\d{5}$/.test(partNumber)) return 'Elements'
  const m = /^DEMO-([A-Z]+)/.exec(partNumber)
  if (!m) return 'Other'
  const g = m[1]
  if (['MTR', 'DRIVEUNIT', 'TRANSFORMER', 'CONTACTOR', 'CONTROLBOARD'].includes(g)) return 'Electrical'
  if (['BRG', 'WHEELBEARING', 'BSH', 'SHF'].includes(g)) return 'Rotating'
  if (['SEA', 'GSK', 'HSE', 'VLV'].includes(g)) return 'Sealing'
  if (['FST', 'CLP', 'PLT'].includes(g)) return 'Structure'
  return 'Assemblies'
}

/** The slicers, applied once so every visual on a report agrees. */
function applyFilters(f: AnalyticsFilters) {
  const siteId = f.site ? SITES.find((s) => s.name === f.site)?.id : null
  return INVENTORY.filter((p) => {
    if (siteId && p.site !== siteId) return false
    const part = PART_BY_NUMBER.get(p.partNumber)
    if (f.criticality && CRITICALITY_LABEL[part?.criticality ?? ''] !== f.criticality) return false
    if (f.supplier && SUPPLIER_BY_ID.get(part?.primarySupplierId ?? '')?.name !== f.supplier) return false
    if (f.status && STATUS_LABEL[statusOf(p.partNumber, p.site, p.warehouse)] !== f.status) return false
    return true
  })
}

const value = (partNumber: string, qty: number) =>
  (PART_BY_NUMBER.get(partNumber)?.unitCost ?? 0) * qty

function drillRows(rows: typeof INVENTORY, limit = 60): DrillRow[] {
  return rows.slice(0, limit).map((p) => {
    const part = PART_BY_NUMBER.get(p.partNumber)
    const site = SITES.find((s) => s.id === p.site)
    return {
      key: `${p.partNumber}:${p.site}`,
      primary: p.partNumber,
      secondary: part?.description ?? '',
      values: [
        site?.name ?? p.site,
        CRITICALITY_LABEL[part?.criticality ?? 'standard'],
        p.onHand - p.allocated,
        p.currentSafetyStock ?? 'not maintained',
        p.recommendedSafetyStock,
        STATUS_LABEL[statusOf(p.partNumber, p.site, p.warehouse)],
      ],
      href: `/inventory/${(site?.name ?? p.site).toLowerCase()}/${p.warehouse.toLowerCase()}/${p.partNumber.toLowerCase()}`,
    }
  })
}

export function analyticsOptions() {
  return {
    sites: SITES.map((s) => s.name),
    criticalities: Object.values(CRITICALITY_LABEL),
    suppliers: SUPPLIERS.map((s) => s.name),
  }
}

/* ── Report A · Inventory Health ─────────────────────────────────────────── */

export function inventoryHealth(f: AnalyticsFilters): InventoryHealthReport {
  const rows = applyFilters(f)
  const byStatus = (k: string) => rows.filter((p) => statusOf(p.partNumber, p.site, p.warehouse) === k)

  const totalValue = rows.reduce((n, p) => n + value(p.partNumber, p.onHand), 0)
  const usable = rows.reduce((n, p) => n + value(p.partNumber, p.onHand - p.allocated), 0)
  const excessValue = byStatus('excess').reduce(
    (n, p) => n + value(p.partNumber, Math.max(0, p.onHand - p.allocated - p.recommendedRangeHigh)), 0)
  const maintained = rows.filter((p) => p.currentSafetyStock !== null).length

  /* Every status, including Blocked — omitting it makes blocked positions
   * disappear from the management view while three KPIs still count them. */
  const families = [...new Set(rows.map((p) => family(p.partNumber)))].sort()
  const statusSeries = Object.values(STATUS_LABEL)
  const statusByFamily = families.map((fam) => {
    const inFam = rows.filter((p) => family(p.partNumber) === fam)
    const out: Record<string, string | number> = { label: fam }
    for (const [k, label] of Object.entries(STATUS_LABEL)) {
      out[label] = inFam.filter((p) => statusOf(p.partNumber, p.site, p.warehouse) === k).length
    }
    return out as never
  })

  /* Ninety days of history at the observed draw, so the trend is consistent
   * with the projections the detail pages show rather than a separate story. */
  const valueOverTime: { label: string; a: number; b: number }[] = []
  for (let i = -90; i <= 0; i += 6) {
    const drift = rows.reduce((n, p) => n + value(p.partNumber, -i * p.averageDailyUsage), 0)
    valueOverTime.push({
      label: d(i).slice(5),
      a: Math.round((totalValue + drift) / 1000),
      b: Math.round((usable + drift) / 1000),
    })
  }

  /* How soon, rather than how much.
   *
   * Status by family is composition, the ninety-day line is money over time,
   * and the gap ranking is money by part. None of the three says when the
   * account starts losing builds — which is the question a planner opens this
   * page holding, and the one the whole product is about.
   *
   * Cover is available stock over the observed daily draw. Positions nothing
   * draws on have no runway rather than an infinite one, so they are excluded
   * and counted, never folded into the last band. */
  const COVER_BANDS: { key: string; label: string; max: number }[] = [
    { key: '0-7', label: '0–7 days', max: 7 },
    { key: '8-14', label: '8–14', max: 14 },
    { key: '15-30', label: '15–30', max: 30 },
    { key: '31-60', label: '31–60', max: 60 },
    { key: '60+', label: '60+', max: Infinity },
  ]
  const counts = new Map(COVER_BANDS.map((b) => [b.key, 0]))
  let coverExcluded = 0
  for (const p of rows) {
    if (p.averageDailyUsage <= 0) { coverExcluded++; continue }
    const days = Math.max(0, p.onHand - p.allocated) / p.averageDailyUsage
    const band = COVER_BANDS.find((b) => days <= b.max) ?? COVER_BANDS[COVER_BANDS.length - 1]
    counts.set(band.key, (counts.get(band.key) ?? 0) + 1)
  }
  const coverRunway: Categorical[] = COVER_BANDS.map((b) => ({
    key: b.key, label: b.label, value: counts.get(b.key) ?? 0,
  }))

  const topExposure: Categorical[] = byStatus('action_required')
    .map((p) => ({
      key: p.partNumber,
      label: p.partNumber,
      value: Math.round(value(p.partNumber, p.recommendedSafetyStock - (p.onHand - p.allocated))),
    }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  return {
    id: 'inventory-health',
    title: 'Inventory Health',
    kpis: [
      { key: 'value', label: 'Inventory value', value: `$${Math.round(totalValue).toLocaleString()}`,
        footnote: `${rows.length.toLocaleString()} positions at unit cost` },
      { key: 'usable', label: 'Usable value', value: `$${Math.round(usable).toLocaleString()}`,
        footnote: 'on hand less allocated' },
      { key: 'action', label: 'Positions requiring action', value: String(byStatus('action_required').length),
        footnote: `of ${rows.length.toLocaleString()}`, tone: byStatus('action_required').length ? 'warning' : 'good' },
      { key: 'excess', label: 'Excess exposure', value: `$${Math.round(excessValue).toLocaleString()}`,
        footnote: `${byStatus('excess').length} positions above the recommended ceiling` },
      /* Renamed from "inventory confidence": it is a coverage measure, and
       * §7.2 forbids a third quantity called confidence. */
      { key: 'completeness', label: 'Data completeness', value: `${Math.round((maintained / Math.max(rows.length, 1)) * 100)}%`,
        footnote: `${maintained.toLocaleString()} of ${rows.length.toLocaleString()} hold a safety parameter` },
    ],
    summary:
      `${byStatus('action_required').length} of ${rows.length.toLocaleString()} positions are breaching policy inside a week, ` +
      `and $${Math.round(excessValue).toLocaleString()} sits above the recommended ceiling. ` +
      `${rows.length - maintained} positions hold no safety parameter at all.`,
    statusByFamily,
    statusSeries,
    valueOverTime,
    topExposure,
    coverRunway,
    coverExcluded,
    detail: {
      columns: ['Part', 'Site', 'Criticality', 'Available', 'On file', 'Recommended', 'Status'],
      rows: drillRows(rows),
    },
  }
}

/* ── Report B · Safety Stock Performance ─────────────────────────────────── */

export function safetyStock(f: AnalyticsFilters): SafetyStockReport {
  const rows = applyFilters(f).filter((p) => p.currentSafetyStock !== null)
  const raise = rows.filter((p) => p.recommendedSafetyStock > (p.currentSafetyStock ?? 0))
  const lower = rows.filter((p) => p.recommendedSafetyStock < (p.currentSafetyStock ?? 0))
  const coverage = rows
    .filter((p) => p.averageDailyUsage > 0)
    .map((p) => p.recommendedSafetyStock / p.averageDailyUsage)
  const avgCoverage = coverage.length ? Math.round(coverage.reduce((a, b) => a + b, 0) / coverage.length) : 0
  const blocked = applyFilters(f).filter((p) => statusOf(p.partNumber, p.site, p.warehouse) === 'blocked')

  const currentVsRecommended = rows
    .slice(0, 220)
    .map((p) => ({
      key: `${p.partNumber}:${p.site}`,
      label: p.partNumber,
      x: p.currentSafetyStock ?? 0,
      y: p.recommendedSafetyStock,
      z: Math.round(value(p.partNumber, p.onHand)),
      href: `/inventory/${p.site.toLowerCase()}/${p.warehouse.toLowerCase()}/${p.partNumber.toLowerCase()}`,
    }))

  const driftReasons: Categorical[] = [
    { key: 'lead-time', label: 'Lead time changed', value: raise.filter((p) => p.averageDailyUsage > 0.4).length },
    { key: 'demand', label: 'Demand variability', value: raise.filter((p) => p.averageDailyUsage <= 0.4).length },
    { key: 'release', label: 'Target above need', value: lower.length },
    { key: 'unmaintained', label: 'No parameter held', value: applyFilters(f).length - rows.length },
  ].filter((x) => x.value > 0)

  return {
    id: 'safety-stock',
    title: 'Safety Stock Performance',
    kpis: [
      { key: 'coverage', label: 'Policy coverage', value: `${Math.round((rows.length / Math.max(applyFilters(f).length, 1)) * 100)}%`,
        footnote: `${rows.length.toLocaleString()} of ${applyFilters(f).length.toLocaleString()} positions hold a parameter` },
      { key: 'raise', label: 'Recommended increases', value: String(raise.length),
        footnote: 'target below what demand and lead time justify', tone: 'warning' },
      { key: 'lower', label: 'Recommended decreases', value: String(lower.length),
        footnote: 'working capital available to release' },
      { key: 'avg', label: 'Average coverage', value: `${avgCoverage} days`,
        footnote: 'recommended target over observed daily draw' },
      /* "Breaches avoided" is a counterfactual and §13.3 forbids one without a
       * stated baseline. This counts what is withheld, which is a fact. */
      { key: 'blocked', label: 'Recommendations withheld', value: String(blocked.length),
        footnote: 'evidence outside the freshness policy', tone: blocked.length ? 'warning' : 'good' },
    ],
    summary:
      `${raise.length} positions carry a target below what demand and lead time justify, and ${lower.length} carry one above. ` +
      `Average recommended coverage is ${avgCoverage} days.`,
    currentVsRecommended,
    driftReasons,
    detail: {
      columns: ['Part', 'Site', 'Criticality', 'Available', 'On file', 'Recommended', 'Status'],
      rows: drillRows(
        [...rows].sort((a, b) =>
          (b.recommendedSafetyStock - (b.currentSafetyStock ?? 0)) -
          (a.recommendedSafetyStock - (a.currentSafetyStock ?? 0))),
      ),
    },
  }
}

/* ── Report C · Procurement ──────────────────────────────────────────────── */

export function procurement(f: AnalyticsFilters): ProcurementReport {
  const set = buildRequisitionSet(HERO_ORDER)
  const supplierFilter = f.supplier
  const received = RECEIVED_PURCHASE_ORDERS.filter(
    (p) => !supplierFilter || SUPPLIER_BY_ID.get(p.supplierId)?.name === supplierFilter)

  const onTime = received.filter((p) => p.actualReceiptDate! <= p.promisedDate).length
  const variances = received.map((p) => daysBetween(p.promisedDate, p.actualReceiptDate!))
  const avgVariance = variances.length
    ? Math.round((variances.reduce((a, b) => a + b, 0) / variances.length) * 10) / 10 : 0

  const spendBySupplier: Categorical[] = SUPPLIERS
    .filter((s) => !supplierFilter || s.name === supplierFilter)
    .map((s) => ({
      key: s.id, label: s.name,
      value: Math.round(requisitionValue(set.lines.filter((l) => l.supplierId === s.id))),
    }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)

  const leadTimeVariance: Categorical[] = SUPPLIERS
    .filter((s) => !supplierFilter || s.name === supplierFilter)
    .map((s) => {
      const mine = received.filter((p) => p.supplierId === s.id)
      const v = mine.map((p) => daysBetween(p.promisedDate, p.actualReceiptDate!))
      return {
        key: s.id, label: s.name,
        value: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0,
      }
    })
    .sort((a, b) => b.value - a.value)

  const requisitionFunnel: Categorical[] = [
    { key: 'recommended', label: 'Recommended', value: set.lines.length },
    { key: 'grouped', label: 'Grouped into requisitions', value: set.requisitions.length },
    { key: 'written', label: 'Written back', value: set.requisitions.length },
    { key: 'approved', label: 'Approved', value: 0 },
  ]

  return {
    id: 'procurement',
    title: 'Procurement and Requisitions',
    kpis: [
      { key: 'value', label: 'Proposed requisition value', value: `$${Math.round(requisitionValue(set.lines)).toLocaleString()}`,
        footnote: `${set.lines.length} lines across ${set.requisitions.length} suppliers` },
      { key: 'ontime', label: 'Supplier on-time', value: `${Math.round((onTime / Math.max(received.length, 1)) * 100)}%`,
        footnote: `${onTime} of ${received.length} receipts in the trailing 90 days`,
        tone: onTime / Math.max(received.length, 1) > 0.9 ? 'good' : 'warning' },
      { key: 'variance', label: 'Lead-time variance', value: `${avgVariance > 0 ? '+' : ''}${avgVariance} days`,
        footnote: 'mean days between promised and actual', tone: avgVariance > 0 ? 'warning' : 'good' },
      { key: 'open', label: 'Open purchase orders', value: String(OPEN_PURCHASE_ORDERS.length),
        footnote: 'netted before any new recommendation' },
      { key: 'expedite', label: 'Expedites raised', value: '0',
        footnote: 'expedite workflow is roadmap' },
    ],
    summary:
      `${Math.round((onTime / Math.max(received.length, 1)) * 100)}% of receipts arrived on or before the promised date, ` +
      `with a mean variance of ${avgVariance} days. The proposed set is ` +
      `$${Math.round(requisitionValue(set.lines)).toLocaleString()} across ${set.requisitions.length} suppliers.`,
    spendBySupplier,
    leadTimeVariance,
    requisitionFunnel,
    detail: {
      columns: ['Requisition', 'Supplier', 'Part', 'Quantity', 'Need by', 'Arrives', 'Extended'],
      rows: set.lines.map((l) => ({
        key: l.id,
        primary: l.requisitionId,
        secondary: SUPPLIER_BY_ID.get(l.supplierId)?.name ?? l.supplierId,
        values: [l.partNumber, l.quantity, l.needByDate, l.projectedReceiptDate,
                 `$${Math.round(l.quantity * l.unitCost).toLocaleString()}`],
        href: `/requisitions/${set.setId.toLowerCase()}`,
      })),
    },
  }
}

/* ── Report D · BOM and Variant Exposure ─────────────────────────────────── */

export function variantExposure(f: AnalyticsFilters): VariantReport {
  const all = CONFIGURATIONS.filter((c) => c.orderable && c.finishedPart)
  /* Selecting a configuration on any visual narrows the whole report to it —
   * §15.1 requires a selection to cross-filter the other visuals and the detail
   * table, not just highlight itself. */
  const orderable = f.configuration ? all.filter((c) => c.label === f.configuration) : all
  const open = openOrders()

  /* How many configurations each component appears in. This is the histogram
   * that either proves variant complexity or exposes that the dataset does not
   * have any — at 95% overlap every bar sits at twelve and the chart says
   * nothing. The shared/specific split in the structure is what gives it shape. */
  const counts = new Map<string, number>()
  for (const l of BOM_LINES) {
    if (!orderable.some((c) => c.finishedPart === l.configurationId)) continue
    counts.set(l.partNumber, (counts.get(l.partNumber) ?? 0) + 1)
  }
  const histogram = new Map<number, number>()
  for (const n of counts.values()) histogram.set(n, (histogram.get(n) ?? 0) + 1)
  const exposureHistogram: Categorical[] = [...histogram.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, c]) => ({ key: String(n), label: `${n}`, value: c }))

  /* Every shared part with forward demand. The KPI sums this. */
  const sharedDemandAll: Categorical[] = [...counts.entries()]
    .filter(([, n]) => n >= 8)
    .map(([partNumber]) => ({ key: partNumber, label: partNumber, value: exposureOf(partNumber).forwardDemand }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)

  /* What the chart draws — six, not ten.
   *
   * The panel is 200px tall and ten categories at 20px each is below what
   * recharts will label: it silently drops every other tick, so half the bars
   * on a chart whose entire job is naming parts had no name.
   *
   * Sliced *here* rather than above, because the KPI beside the chart sums the
   * same concept and must keep summing all of it. Capping the shared array
   * would have moved a headline figure from 99 to the top-six subtotal without
   * changing its label — a chart fix quietly rewriting a number, which is the
   * one thing the single-source rule exists to prevent. */
  const sharedDemand: Categorical[] = sharedDemandAll.slice(0, 6)

  /* The matrix always shows all twelve, filter or not. Completeness is its
   * whole job, and a filtered matrix would understate the exposure the report
   * exists to demonstrate. */
  const configurationMatrix = CONFIGURATIONS.map((c) => ({
    configuration: c.label,
    finishedPart: c.finishedPart,
    components: c.finishedPart ? effectiveBom(c.finishedPart, TODAY).length : 0,
    liveOrders: c.finishedPart ? open.filter((o) => o.configurationId === c.finishedPart).length : 0,
  }))

  const highExposure = [...counts.values()].filter((n) => n >= orderable.length).length
  const superseded = BOM_LINES.filter((l) => l.validTo < '9999-12-31').length

  return {
    id: 'variant-exposure',
    title: 'BOM and Variant Exposure',
    kpis: [
      { key: 'configs', label: 'Orderable configurations', value: String(orderable.length),
        footnote: f.configuration
          ? `filtered to ${f.configuration}, of ${all.length} orderable`
          : `of ${CONFIGURATIONS.length} published` },
      { key: 'components', label: 'Components in scope', value: String(counts.size.toLocaleString()),
        footnote: 'distinct parts across every configuration' },
      { key: 'shared', label: 'Used by every configuration', value: String(highExposure),
        footnote: 'a shortage here touches the whole product line', tone: 'warning' },
      { key: 'superseded', label: 'Superseded structure lines', value: String(superseded),
        footnote: 'revisions with an effective-to date' },
      { key: 'demand', label: 'Forward demand, shared parts', value: String(sharedDemandAll.reduce((n, x) => n + x.value, 0)),
        footnote: 'summed across configurations with live orders' },
    ],
    summary:
      `${highExposure} components are consumed by all ${orderable.length} orderable configurations, ` +
      `so a shortage on any one of them touches the entire product line. ` +
      `${PARTS.length.toLocaleString()} parts are in the master; ${counts.size.toLocaleString()} appear in a structure.`,
    exposureHistogram,
    sharedDemand,
    configurationMatrix,
    detail: {
      columns: ['Component', 'Configurations', 'With live orders', 'Forward demand', 'Criticality'],
      rows: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 60)
        .map(([partNumber, n]) => {
          const ex = exposureOf(partNumber)
          const part = PART_BY_NUMBER.get(partNumber)
          return {
            key: partNumber,
            primary: partNumber,
            secondary: part?.description ?? '',
            values: [n, ex.configurationsWithOrders, ex.forwardDemand,
                     CRITICALITY_LABEL[part?.criticality ?? 'standard']],
            href: `/assemblies/ABC-6107`,
          }
        }),
    },
  }
}
