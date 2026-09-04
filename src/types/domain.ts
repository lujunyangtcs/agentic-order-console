/**
 * Domain vocabulary.
 *
 * Scaffold: only the types the shell needs to render are here. The full
 * model — parts, configurations, revision-versioned BOM, inventory positions,
 * suppliers, orders, requisitions, part relationships — lands in P3 alongside
 * the fixture engine.
 *
 * Two rules govern everything added here, both from the the design notes:
 *
 * 1. **Vocabularies are closed and normative.** §7.1 criticality, §7.3 status
 *    and §7.4 relationships each have an exact value set. A screen that invents
 *    a sixth status has diverged from the spec, so these are unions, not strings.
 *
 * 2. **Readiness has two axes and they never sum** (§11.4). Coverage state is
 *    exclusive and totals the analyzed lines; qualifiers overlay it and may
 *    co-occur. They are separate fields for that reason — collapsing them into
 *    one union is how you end up reporting 252 lines out of 250.
 */

/** §7.1 — an item's relatively stable business importance. */
export type Criticality =
  | 'production_critical'
  | 'operational_essential'
  | 'standard'
  | 'consumable'

/** §7.3 — current inventory status. Mutually exclusive; every record has one. */
export type InventoryStatus =
  | 'healthy'
  | 'excess'
  | 'watch'
  | 'action_required'
  | 'blocked'

/** §11.4 axis 1 — exclusive. Sums to the analyzed component lines. */
export type CoverageState = 'covered' | 'below_safety_after_build' | 'short'

/** §11.4 axis 2 — non-exclusive overlay. Never summed with coverage. */
export type Qualifier = 'part_resolution_review' | 'blocked'

/** §7.4 — how a candidate part relates to the one actually required. */
export type PartRelationship =
  | 'exact'
  | 'approved_substitute'
  | 'superseded'
  | 'similar_only'
  | 'potential_duplicate'

/**
 * §7.2 — recommendation confidence, shown as a band and never as a bare
 * percentage in a filter. Deliberately distinct from email extraction
 * reliability and from the portfolio-level data completeness index; the the design notes
 * forbids the three sharing a label.
 */
export type ConfidenceBand = 'high' | 'medium' | 'low'

/** §5.1 — the permission string the UI names in a permission-denied state. */
export type Role =
  | 'Planner'
  | 'Engineering Approver'
  | 'Procurement Approver'
  | 'ERP Administrator'
  | 'Viewer'

/** §6.3 — source freshness. Distinct from connection state (§16.3). */
export type Freshness = 'fresh' | 'delayed' | 'partial' | 'mapping_issue'

/**
 * How urgent a finding is. Separate from §7.3 status, which describes a stock
 * position; this describes a thing that needs attention. §10.6 requires every
 * one of these to carry an icon or a label as well as a colour.
 */
export type Severity = 'critical' | 'high' | 'medium' | 'info'

/** The planning grain is SKU × site × warehouse (§3.2 principle 7). */
export interface StockLocation {
  site: string
  warehouse: string
}

/* ── Parts and product structure ─────────────────────────────────────────── */

/**
 * A part.
 *
 * ABC part numbers are seven digits with no letters and no separators —
 * verified across 229 published numbers. `40…` is finished configured
 * equipment, `10…` is elements, consumables and service parts. Demo-only
 * identities use a `DEMO-` prefix so nothing invented can be mistaken for a
 * real catalogue number.
 */
export interface Part {
  partNumber: string
  description: string
  criticality: Criticality
  unitCost: number
  uom: string
  /** Which supplier normally supplies it. Null means no primary vendor — a
   *  blocking exception at requisition time (§13.2). */
  primarySupplierId: string | null
  moq: number
  orderMultiple: number
  /** True when the part differs by voltage group, which is what makes the
   *  look-alike confusion in §7.4 expensive. */
  voltageDependent: boolean
}

/** One orderable configuration of a product (§8.5). */
export interface Configuration {
  /** The finished seven-digit part number, or null for a published-but-
   *  unorderable combination — a real case on the ABC-600 Series spec sheet. */
  finishedPart: string | null
  productFamily: string
  label: string
  voltage: number
  phase: number
  frequency: number
  highSpeed: boolean
  orderable: boolean
}

/**
 * One line of a product structure, valid over a date range.
 *
 * The `validFrom`/`validTo` pair is what makes "the effective BOM for this
 * order's date" answerable rather than assumed. `FOREVER` is the open end.
 */
export interface BomLine {
  configurationId: string
  partNumber: string
  quantityPer: number
  revision: string
  validFrom: string
  validTo: string
}

/* ── Sites and inventory ─────────────────────────────────────────────────── */

export interface Site {
  id: string
  name: string
  kind: 'plant' | 'service' | 'distribution'
  currency: 'USD' | 'EUR'
  warehouses: string[]
}

/**
 * A stock position at one SKU × site × warehouse.
 *
 * `onHand − allocated = available` is an identity, not two facts. Anything
 * derived from these — coverage days, projected breach date, status — is
 * computed once in `derive.ts` and read everywhere else.
 */
export interface InventoryPosition {
  partNumber: string
  site: string
  warehouse: string
  onHand: number
  allocated: number
  /** §7.2 — every time-phased figure depends on this. */
  averageDailyUsage: number
  currentSafetyStock: number | null
  recommendedSafetyStock: number
  recommendedRangeLow: number
  recommendedRangeHigh: number
  /** §7.2, as a band. Never a bare percentage in a filter. */
  confidence: ConfidenceBand
  confidencePct: number
}

/** §12.3 — how the recommended target was arrived at. Must sum to the target. */
export interface RecommendationDriver {
  partNumber: string
  label: string
  value: number
  /** Two of these are things a conventional planning screen cannot compute at
   *  all, and saying so is most of the pitch. */
  onlyVisibleAcross: 'configurations' | 'supplier-evidence' | null
  evidenceRef: string | null
}

/* ── Suppliers and evidence ──────────────────────────────────────────────── */

export interface Supplier {
  id: string
  name: string
  currency: 'USD' | 'EUR'
  /** What the system of record holds. May be stale — that is the point. */
  leadTimeDaysOnFile: number
  onTimePct: number
}

/**
 * A lead-time claim extracted from a supplier email.
 *
 * `extractionReliability` is NOT recommendation confidence and must never be
 * labelled as such (§7.2). Below 0.75 the fact is `Needs confirmation` and
 * cannot support an approved requisition.
 */
export interface LeadTimeEvidence {
  id: string
  supplierId: string
  partNumber: string
  claimedLeadTimeDays: number
  receivedAt: string
  subject: string
  excerpt: string
  extractionReliability: number
  confirmedBy: string | null
}

/* ── Orders and supply ───────────────────────────────────────────────────── */

export interface SalesOrder {
  id: string
  customer: string
  configurationId: string
  quantity: number
  site: string
  receivedAt: string
  requiredShipDate: string
}

export interface PurchaseOrder {
  id: string
  supplierId: string
  partNumber: string
  quantity: number
  site: string
  warehouse: string
  orderedAt: string
  promisedDate: string
  /** Null while open. Present on the trailing history that supplier on-time
   *  performance and lead-time variance are computed from. */
  actualReceiptDate: string | null
}

/* ── Part resolution ─────────────────────────────────────────────────────── */

/** §7.4 — a candidate offered against a required part, and why. */
export interface PartCandidate {
  requiredPart: string
  candidatePart: string
  relationship: PartRelationship
  reason: string
  /** Only an approved substitute can be allocated, and only after sign-off. */
  requiresApprovalFrom: Role | null
  approvedAt: string | null
  approvedBy: string | null
}

/* ── Requisitions ────────────────────────────────────────────────────────── */

/** Why a line exists. The two run on different clocks — see §11.7. */
export type RequisitionReason = 'protect_order' | 'restore_safety'

export interface RequisitionLine {
  id: string
  requisitionId: string
  partNumber: string
  site: string
  reason: RequisitionReason
  /** What the shortfall actually is, before MOQ rounding. */
  rawNeed: number
  /** After MOQ and order multiple. The gap between the two is a demo beat. */
  quantity: number
  needByDate: string
  leadTimeDays: number
  projectedReceiptDate: string
  unitCost: number
  supplierId: string
  warnings: string[]
}

/**
 * A supplier-scoped requisition.
 *
 * §13.2 requires lines to be grouped by supplier, site and currency, so one
 * requisition spanning three suppliers would contradict the product's own
 * consolidation rule. The set is reviewed as a unit and written back as three
 * records; `setId` is what holds them together.
 */
export interface Requisition {
  id: string
  setId: string
  supplierId: string
  site: string
  currency: 'USD' | 'EUR'
  /** Assigned by the system of record on write-back, not before. */
  externalReference: string | null
}

/* ── Assembly sheet linkage (§11.8) ──────────────────────────────────────── */

/** A component position on the exploded sheet. Not a BOM line — a roll-up. */
export interface AssemblyStation {
  station: number
  partNumber: string
  label: string
  blueprint: string
}
