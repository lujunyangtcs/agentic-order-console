/**
 * The typed boundary between screens and data.
 *
 * Components import `api` from `@/services` and never reach past it. Today it
 * resolves to a fixture-backed mock; when a real connector exists it becomes a
 * runtime choice and no component changes. That is the whole point of the file.
 *
 * Scaffold: only the two groups the shell renders are defined. Later revisions add the
 * rest as the fixture engine lands, and §17's FR-001…FR-038 each map to a
 * method here.
 */

/** One line in the activity rail. Every item is a real event with a real time. */
export interface ActivityItem {
  id: string
  at: string
  tone: 'neutral' | 'attention' | 'good'
  text: string
  /** Where the event happened. Items without a destination are not shown. */
  to?: string
}

/**
 * The Command Center's numbers (§14.1).
 *
 * These are read from the fixture, never recomputed in a component. §8.6
 * makes them cross-screen invariants: the nav badge, the KPI tile and the
 * page it links to must show the same figure, and the only way to guarantee
 * that is a single source.
 */
/**
 * One finding, in the fields a card needs rather than as a paragraph.
 *
 * These were four sentences in a bulleted list, and a list of four dense
 * sentences is read by nobody — the figure that matters is buried mid-clause
 * and every item looks like every other item. Split into a headline number,
 * what the number is, and the evidence behind it, the same content becomes
 * scannable in the order a reader actually wants it: how big, of what, on
 * what basis.
 */
export interface Observation {
  key: string
  /** The category, as an eyebrow. Two or three words. */
  eyebrow: string
  /** The claim, short enough to read in one pass. */
  title: string
  /** The headline figure. Kept as a string so `21 → 34` and `11 of 12` work. */
  figure: string
  /** What the figure is. Never omitted — a bare number is not a fact. */
  unit: string
  /** The evidence, in one line. */
  meta: string
  /** Drives the chip. `held` is not a failure; it is a recommendation withheld. */
  tone: 'act' | 'watch' | 'held'
  href: string
}

export interface CommandCenterSummary {
  skusRequiringAction: number
  ordersAtRisk: number
  draftRequisitionValue: number
  approvalsWaiting: number
  excessExposure: number
  blockedByData: number
  /** The one sentence that names what to do next (§14, fast-demo hero rule). */
  headline: string
  /**
   * The specific record to open first, named.
   *
   * fast-demo's rule for the decision hero: it prescribes an action against a
   * real identifier rather than summarising. A hero that says "9 parts need
   * attention" has told the room nothing they could not have guessed.
   */
  firstAction: { label: string; href: string; sentence: string } | null
  /** Derived observations, as cards rather than sentences. Counted, never written. */
  observations: Observation[]
  /** The written read. Composed from the same figures, not generated. */
  writtenAnalysis: AnalysisSentence[]
  /** Data-as-of stamp, required on every data-dependent page (§6.3). */
  dataAsOf: string
}

/** One row of the priority action queue (§14.2). */
export interface ActionQueueRow {
  id: string
  priority: 'P1' | 'P2' | 'P3'
  trigger: string
  subject: string
  subjectHref: string
  site: string
  issue: string
  needDate: string | null
  /** Money where there is money, a count where there is not. */
  impact: string
  owner: string
  recommendedAction: string
  recommendedHref: string
}

/** A labelled slice of the queue, for the reason bars (§14.3, fast-demo §4). */
export interface ReasonCount {
  key: string
  label: string
  count: number
  href: string
}

export interface DashboardApi {
  summary(): Promise<CommandCenterSummary>
  actionQueue(): Promise<ActionQueueRow[]>
  reasons(): Promise<ReasonCount[]>
}

export interface ActivityApi {
  recent(limit?: number): Promise<ActivityItem[]>
}

/** One configuration's row in the exposure matrix (§12.3, §11.8). */
export interface ExposureRow {
  configurationId: string
  label: string
  finishedPart: string | null
  orderable: boolean
  liveOrders: number
  quantityPer: number
  demand: number
}

/** What the exposure rail reads when a station is selected. */
export interface StationExposure {
  station: number
  partId: string
  label: string
  criticality: string
  status: string
  location: string
  configurationCount: number
  configurationsWithOrders: number
  /** Live customer orders standing on those configurations. §20 names this one. */
  liveOrders: number
  forwardDemand: number
  required: number
  available: number
  positionAfterBuild: number
  activeTarget: number | null
  projectedZero: string | null
  rows: ExposureRow[]
  /** Configurations that do NOT consume this part, named. An empty row in a
   *  completeness matrix has to say why it is empty. */
  notUsedBy: ExposureRow[]
}

export interface AssemblyApi {
  sheet(configurationId: string): Promise<unknown>
  exposure(configurationId: string, partId: string): Promise<StationExposure | null>
  /** Headline counts for the sheet header — including the one the sheet's own
   *  four-state vocabulary cannot show. */
  summary(configurationId: string): Promise<{
    stations: number
    shortage: number
    substitute: number
    blocked: number
    belowSafetyAfterBuild: number
  }>
}

/* ── Orders ──────────────────────────────────────────────────────────────── */

export interface OrderRow {
  id: string
  customer: string
  configurationId: string
  configurationLabel: string
  quantity: number
  site: string
  requiredShipDate: string
  /** Covered lines as a share of analysed lines. Below-safety lines are not in
   *  the numerator — a part that covers the build but breaches policy after it
   *  is not "ready", it is a problem deferred. */
  readinessPct: number
  short: number
  belowSafetyAfterBuild: number
  blocked: number
  analysed: boolean
}

/** One step of the structured analysis trail (§11.4). Never a chat transcript. */
export interface TrailStep {
  label: string
  state: 'done' | 'attention'
  detail: string
  at: string
}

export interface MaterialLine {
  partNumber: string
  description: string
  required: number
  available: number
  openSupply: number
  positionAfterBuild: number
  activeTarget: number | null
  coverage: 'covered' | 'below_safety_after_build' | 'short'
  qualifiers: ('part_resolution_review' | 'blocked')[]
  needDate: string
  relationship: string
}

export interface OrderImpact {
  order: OrderRow
  trail: TrailStep[]
  /** Axis 1 — exclusive, sums to `analysedLines`. */
  coverage: { covered: number; belowSafetyAfterBuild: number; short: number }
  /** Axis 2 — overlays. Never added to axis 1. */
  qualifiers: { partResolutionReview: number; blocked: number }
  analysedLines: number
  lines: MaterialLine[]
  purchaseValueProposed: number
}

export interface CandidateRow {
  partNumber: string
  description: string
  relationship: string
  relationshipLabel: string
  reason: string
  allocatable: boolean
  /** Allocated during this walk. Resets with the session. */
  allocated: boolean
  requiresApprovalFrom: string | null
  approvedAt: string | null
  approvedBy: string | null
  available: number
  voltage: string
}

/** One line of the post-build safety panel (§11.6). */
export interface PostBuildRow {
  partNumber: string
  description: string
  positionAfterBuild: number
  activeTarget: number
  resolution: 'requisition' | 'incoming' | 'transfer' | 'blocked'
  detail: string
  /** Transfers are §23 roadmap. The row exists; the action does not. */
  actionable: boolean
}

export interface PostBuildPanel {
  belowPolicy: number
  rows: PostBuildRow[]
}

/** The handoff, and the finding it carries (§11.7). */
export interface RequisitionProposal {
  setId: string
  lines: number
  suppliers: number
  value: number
  protectOrder: number
  restoreSafety: number
  customerOrdersProtected: number
  earliestNeedBy: string
  /** Null when nothing lands after the ship date. */
  coverageGap: {
    partNumber: string
    projectedZero: string
    replenishmentArrives: string
    uncoveredDays: number
    shipDate: string
    alternatives: number
  } | null
}

export interface OrdersApi {
  list(): Promise<OrderRow[]>
  impact(orderId: string): Promise<OrderImpact | null>
  candidates(requiredPart: string): Promise<CandidateRow[]>
  /** Allocate a candidate against the required position. Recorded in the audit. */
  allocate(requiredPart: string, candidatePart: string): Promise<CandidateRow[]>
  /** Sign off a candidate that needs it. Engineering Approver only (§5.1). */
  approveSubstitute(requiredPart: string, candidatePart: string): Promise<CandidateRow[]>
  postBuild(orderId: string): Promise<PostBuildPanel>
  proposal(orderId: string): Promise<RequisitionProposal>
}

/* ── Replenishment ───────────────────────────────────────────────────────── */

export interface RequisitionLineRow {
  id: string
  requisitionId: string
  partNumber: string
  description: string
  reason: 'protect_order' | 'restore_safety'
  available: number
  recommendedSafety: number
  projectedShortfall: number
  existingSupply: number
  /** Before MOQ. The gap between this and `quantity` is a demo beat, not noise. */
  rawNeed: number
  quantity: number
  moq: number
  orderMultiple: number
  needByDate: string
  leadTimeDays: number
  projectedReceiptDate: string
  unitCost: number
  extendedCost: number
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

/** A supplier-scoped group. Counts here are subsets and never exceed the set. */
export interface RequisitionGroup {
  id: string
  supplierId: string
  supplierName: string
  site: string
  currency: 'USD' | 'EUR'
  lines: RequisitionLineRow[]
  spend: number
  leadTimeRange: [number, number]
  earliestNeedBy: string
  customerOrdersProtected: number
  buildsProtected: number
  /** Assigned by the system of record on write-back. Null until then. */
  externalReference: string | null
}

export interface ValidationCheck {
  label: string
  state: 'pass' | 'warn' | 'block'
  detail: string
}

export interface RequisitionSet {
  setId: string
  site: string
  status: 'ready' | 'written'
  groups: RequisitionGroup[]
  totalLines: number
  totalSpend: number
  customerOrdersProtected: number
  buildsProtected: number
  checks: ValidationCheck[]
  /** True only when no check is blocking. Drives the primary CTA. */
  canWriteBack: boolean
}

export type WriteBackStage =
  | 'validating' | 'creating' | 'created' | 'email_prepared' | 'email_sent' | 'failed'

/**
 * §13.6's two transport failures, requested rather than rolled.
 *
 * The presenter reaches them with `?simulate=` on the requisition route. Every
 * other row of §13.6 is a data condition and appears as a pre-flight check
 * derived from the fixture.
 */
export type WriteBackFailure = 'erp-timeout' | 'email-failure'

export interface WriteBackResult {
  stage: WriteBackStage
  references: { requisitionId: string; externalReference: string; lines: number; spend: number }[]
  /** Present when the write-back failed. Email failure never rolls the PR back. */
  correlationId?: string
  emailSent: boolean
}

export interface ApprovalEmail {
  to: string
  subject: string
  lines: number
  suppliers: number
  spend: number
  earliestNeedBy: string
  customerOrdersProtected: number
  buildsProtected: number
  /** The one thing worth escalating, named. */
  attention: string | null
  reviewHref: string
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  entity: string
  action: string
  before: string | null
  after: string | null
  evidence: string | null
  externalReference: string | null
}

export interface ReplenishmentApi {
  set(setId: string): Promise<RequisitionSet | null>
  writeBack(setId: string, simulate?: WriteBackFailure): Promise<WriteBackResult>
  /** Park the set without writing it back, or reject it outright. */
  setStatus(setId: string, status: 'saved' | 'rejected'): Promise<RequisitionSet>
  /** Retry only the approval email. The requisitions are untouched (FR-021). */
  retryEmail(setId: string): Promise<WriteBackResult>
  email(setId: string): Promise<ApprovalEmail>
  audit(): Promise<AuditEntry[]>
}

/* ── Inventory ───────────────────────────────────────────────────────────── */

export interface InventoryRow {
  partNumber: string
  description: string
  site: string
  warehouse: string
  criticality: string
  status: 'healthy' | 'excess' | 'watch' | 'action_required' | 'blocked'
  available: number
  currentSafety: number | null
  recommendedSafety: number
  /** Recommended minus current. Null when no parameter is maintained — which is
   *  a different statement from a delta of zero. */
  delta: number | null
  projectedBreach: string | null
  /** Configurations with live orders drawing this part. Hover shows the matrix. */
  variantExposure: number
  openSupply: number
  confidence: 'high' | 'medium' | 'low'
}

/** One term of the recommendation waterfall. Must reconcile to the target. */
export interface DriverTerm {
  label: string
  value: number
  /** Marks the terms the customer's current process cannot compute at all. */
  onlyVisibleAcross: 'configurations' | 'supplier-evidence' | null
  evidenceRef: string | null
}

/** One day of the time-phased projection. */
export interface ProjectionPoint {
  date: string
  /** Null after today — history and forecast are drawn differently. */
  actual: number | null
  forecast: number | null
}

export interface ProjectionEvent {
  date: string
  kind: 'demand' | 'receipt' | 'breach'
  label: string
  quantity: number | null
}

export interface EmailEvidence {
  supplier: string
  partNumber: string
  claimedLeadTimeDays: number
  leadTimeOnFile: number
  receivedAt: string
  subject: string
  excerpt: string
  /** Extraction reliability — NOT recommendation confidence (§7.2). */
  extractionReliability: number
  needsConfirmation: boolean
  confirmedBy: string | null
}

export interface Alternative {
  rank: number
  label: string
  impact: string
  costDelta: string
  time: string
  requiredApprover: string
  /** False for anything on the roadmap rather than in the product. */
  actionable: boolean
  note: string | null
}

export interface SkuDetail {
  partNumber: string
  description: string
  site: string
  warehouse: string
  criticality: string
  status: InventoryRow['status']
  onHand: number
  allocated: number
  available: number
  currentSafety: number | null
  recommendedSafety: number
  rangeLow: number
  rangeHigh: number
  coverageDays: number | null
  averageDailyUsage: number
  confidence: 'high' | 'medium' | 'low'
  confidencePct: number
  drivers: DriverTerm[]
  driversTotal: number
  projection: ProjectionPoint[]
  events: ProjectionEvent[]
  horizonDays: number
  exposure: StationExposure | null
  evidence: EmailEvidence | null
  alternatives: Alternative[]
  /** Set once this SKU is on a written-back requisition. */
  onRequisition: { setId: string; quantity: number; arrives: string } | null
}

export interface InventoryApi {
  list(): Promise<InventoryRow[]>
  detail(site: string, warehouse: string, partNumber: string): Promise<SkuDetail | null>
}

/* ── Analytics ───────────────────────────────────────────────────────────── */

/** Slicers, held in the URL so Back restores the report (FR-023). */
export interface AnalyticsFilters {
  site: string | null
  criticality: string | null
  supplier: string | null
  /** Set by clicking a visual. Cross-filters the others and the detail table. */
  status: string | null
  configuration: string | null
}

export interface KpiValue {
  key: string
  label: string
  value: string
  /** Names the numerator and denominator. A rate with neither is unfalsifiable. */
  footnote: string
  tone?: 'good' | 'warning' | 'neutral'
}

export interface Categorical { key: string; label: string; value: number; tone?: string }
export interface Stacked { label: string; [series: string]: string | number }
export interface Scatter {
  x: number; y: number; z: number; label: string; key: string
  /** Drill-through target. §20's analytics beat drills from this chart to a SKU. */
  href: string
}
export interface Series { label: string; a: number; b?: number }

export interface DrillRow {
  key: string
  primary: string
  secondary: string
  values: (string | number)[]
  href: string
}

export interface Report {
  id: string
  title: string
  kpis: KpiValue[]
  /** One insight sentence per report, computed. §15.6 wants a readable summary. */
  summary: string
  detail: { columns: string[]; rows: DrillRow[] }
}

export interface InventoryHealthReport extends Report {
  statusByFamily: Stacked[]
  statusSeries: string[]
  valueOverTime: Series[]
  topExposure: Categorical[]
  /** Positions by days of cover remaining. The one question the other three
   *  visuals do not answer: not how much, or worth what, but *how soon*. */
  coverRunway: Categorical[]
  /** Positions excluded because nothing draws on them — stated, not dropped. */
  coverExcluded: number
}

/** One sentence of the written read, with the record it was counted from. */
export interface AnalysisSentence {
  key: string
  text: string
  /** The words in `text` that carry the link. Must appear in it verbatim. */
  linkText: string
  href: string
}

export interface SafetyStockReport extends Report {
  currentVsRecommended: Scatter[]
  driftReasons: Categorical[]
}

export interface ProcurementReport extends Report {
  spendBySupplier: Categorical[]
  leadTimeVariance: Categorical[]
  requisitionFunnel: Categorical[]
}

export interface VariantReport extends Report {
  /** Component × configuration. The wall that proves the point, or does not. */
  exposureHistogram: Categorical[]
  sharedDemand: Categorical[]
  configurationMatrix: { configuration: string; finishedPart: string | null; components: number; liveOrders: number }[]
}

export interface AnalyticsApi {
  options(): Promise<{ sites: string[]; criticalities: string[]; suppliers: string[] }>
  inventoryHealth(f: AnalyticsFilters): Promise<InventoryHealthReport>
  safetyStock(f: AnalyticsFilters): Promise<SafetyStockReport>
  procurement(f: AnalyticsFilters): Promise<ProcurementReport>
  variantExposure(f: AnalyticsFilters): Promise<VariantReport>
}

/* ── Integrations ────────────────────────────────────────────────────────── */

export interface Connector {
  id: string
  name: string
  /** Connection state. Separate from freshness — §16.3 keeps them apart. */
  connected: boolean
  /** §6.3 vocabulary. Only meaningful when connected. */
  freshness: 'fresh' | 'delayed' | 'partial' | 'mapping_issue' | null
  permissions: string
  /** What we would read, whether or not we are reading it yet. */
  objects: string[]
  records: number | null
  /** What `records` counts, when "Records" would mislead. A mailbox reporting
   *  `2` under the same label as an ERP reporting `6,265` reads as a broken
   *  feed rather than as two extracted supplier emails. */
  recordsLabel?: string
  lastSync: string | null
  writeBack: string | null
  /** Why this is not connected, said plainly rather than implied. */
  note: string | null
  /** Evidence for the claim, where there is any. */
  evidence: string | null
  mappingIssues: number
}

export interface IntegrationsApi {
  connectors(): Promise<Connector[]>
}

export interface Api {
  integrations: IntegrationsApi
  dashboard: DashboardApi
  activity: ActivityApi
  assembly: AssemblyApi
  orders: OrdersApi
  replenishment: ReplenishmentApi
  inventory: InventoryApi
  analytics: AnalyticsApi
}
