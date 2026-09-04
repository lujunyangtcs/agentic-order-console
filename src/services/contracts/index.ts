/**
 * The whole API as interfaces.
 *
 * Routes and components read only these. The mock implementation in
 * `../mock` derives every value from fixtures plus the session store; a real
 * backend would implement the same seven surfaces.
 */
import type {
  CarrierRequest, Channel, Deviation, DeviationKind, Freshness, LatLng, Notification,
  NotificationRule, OrderStatus, PodDocument, Priority, Product, Region, Role,
  SecurityConfig, StakeholderKind, StatusEvent, Ticket, User,
} from '@/types/domain'

// ── shared row shapes ───────────────────────────────────────────────────────

export interface WorklistFilter {
  status?: OrderStatus | 'all' | 'needs_attention'
  q?: string
  priority?: Priority
  cvrId?: string
  customerId?: string
  carrierId?: string
  terminalId?: string
  region?: Region
}

export interface WorklistRow {
  id: string
  erpRef: string
  customerId: string
  customerName: string
  shipToName: string
  shipToCity: string
  terminalId: string
  terminalName: string
  carrierId: string | null
  carrierName: string | null
  status: OrderStatus
  priority: Priority
  windowStart: string
  windowEnd: string
  eta: string | null
  tonnes: number
  product: Product
  region: Region
  cvrId: string
  cvrName: string
  lockedBy: string | null
  /** True when a rejected request is waiting for reassignment. */
  rejected: boolean
  expedited: boolean
  /** Raised from the customer portal, not yet sent to the ERP. */
  isRequest: boolean
  statusAt: string
}

export interface WorklistSummary {
  newRequests: number
  pendingCarrier: number
  inTransit: number
  needsAttention: number
  deliveredToday: number
  onTimePct: number
  dataAsOf: string
}

export interface OrderDocument {
  id: string
  kind: 'erp_order' | 'bol' | 'signed_bol' | 'delivery_record' | 'invoice'
  title: string
  issuedAt: string
  source: string
  reference: string
}

export interface Eta {
  at: string
  lowAt: string
  highAt: string
  /** Plain-language basis, e.g. "312 km at 72 km/h plus 40 min unloading". */
  basis: string
  progress: number
}

export interface Lane {
  path: LatLng[]
  km: number
  terminal: { id: string; name: string; latLng: LatLng }
  shipTo: { id: string; name: string; latLng: LatLng }
}

export interface OrderDetail extends WorklistRow {
  shipToId: string
  shipToAddress: string
  truck: { id: string; plate: string; driver: string } | null
  events: StatusEvent[]
  requests: (CarrierRequest & { carrierName: string })[]
  documents: OrderDocument[]
  deviations: Deviation[]
  pod: PodDocument | null
  lane: Lane
  etaDetail: Eta | null
  note: string
  createdAt: string
  /** Where the customer said the truck should go vs. where it was signed for. */
  locationMatch: 'match' | 'mismatch' | 'unknown'
}

export interface OrderLock {
  orderId: string
  by: string
  since: string
}

export interface HistoryFilter {
  q?: string
  customerId?: string
  carrierId?: string
}

export interface HistoryRow {
  id: string
  erpRef: string
  customerName: string
  carrierName: string
  shipToName: string
  deliveredAt: string
  onTime: boolean
  tonnes: number
  documents: OrderDocument[]
}

export interface Recommendation {
  carrierId: string
  carrierName: string
  hasTms: boolean
  score: number
  rank: 1 | 2 | 3
  factors: { key: string; weight: number; value: number; text: string }[]
  rationale: string
  onTimePct: number
  freeTrucks: number
  ratePerTonne: number
}

export interface InboxRow {
  requestId: string
  orderId: string
  erpRef: string
  customerName: string
  terminalName: string
  shipToName: string
  shipToCity: string
  tonnes: number
  product: Product
  windowStart: string
  windowEnd: string
  priority: Priority
  sentAt: string
  expedited: boolean
  reminders: number
  state: CarrierRequest['state']
  trucks: { id: string; plate: string; driver: string }[]
}

export interface RequestRow {
  requestId: string
  orderId: string
  erpRef: string
  carrierId: string
  carrierName: string
  customerName: string
  state: CarrierRequest['state']
  sentAt: string
  respondedAt: string | null
  minutesOpen: number
  overdue: boolean
  expedited: boolean
  reminders: number
  reason?: string
  rank: number
}

export interface RequestsSummary {
  open: number
  overdue: number
  rejected: number
  medianResponseMinutes: number
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  entity: string
  action: string
  before?: string
  after?: string
  evidence?: string
  externalReference?: string
}

export interface ActivityItem {
  id: string
  text: string
  at: string
  tone: 'attention' | 'good' | 'neutral'
  to?: string
}

export interface AdvanceResult {
  orderId: string
  event: StatusEvent | null
  notifications: Notification[]
  documents: OrderDocument[]
  audit: AuditEntry[]
}

export interface TruckPosition {
  orderId: string
  erpRef: string
  carrierName: string
  customerName: string
  status: OrderStatus
  latLng: LatLng
  progress: number
  eta: string | null
  lane: Lane
}

export interface YardRow {
  orderId: string
  erpRef: string
  carrierName: string
  truckPlate: string
  status: OrderStatus
  since: string
  tonnes: number
  product: Product
  bay: number | null
  customerName: string
}

export interface DispatchColumn {
  carrierId: string
  carrierName: string
  hasTms: boolean
  onTimePct: number
  loads: {
    orderId: string
    erpRef: string
    status: OrderStatus
    customerName: string
    windowEnd: string
    stalled: boolean
  }[]
}

export interface ScorecardRow {
  carrierId: string
  carrierName: string
  hasTms: boolean
  loads: number
  onTimePct: number
  acceptanceMinutes: number
  incidentRate: number
  rejections: number
  score: number
  rank: number
}

export interface ScorecardWeights {
  onTime: number
  acceptance: number
  incidents: number
  rejections: number
}

export interface ReportSpec {
  id: string
  name: string
  dimension: 'carrier' | 'terminal' | 'customer' | 'status' | 'product' | 'week'
  measure: 'orders' | 'on_time_pct' | 'cycle_hours' | 'tonnes' | 'deviations'
  chart: 'bar' | 'line' | 'stacked' | 'table'
  createdAt: string
}

export interface ReportPoint {
  label: string
  value: number
  secondary?: number
}

export interface ReportResult {
  spec: ReportSpec
  points: ReportPoint[]
  unit: '' | '%' | 'h' | 't'
  total: number
}

export interface BenchmarkPoint {
  week: string
  onTimePct: number
  benchmark: number
  forecastLow: number | null
  forecastHigh: number | null
  forecast: number | null
}

export interface BenchmarkSeries {
  points: BenchmarkPoint[]
  benchmark: number
  current: number
  trend: number
}

export interface WorkloadCell {
  cvrId: string
  cvrName: string
  bucket: 'requests' | 'assigning' | 'pending' | 'moving' | 'delivering' | 'exceptions'
  count: number
}

export interface LiveAnalytics {
  eventsToday: number
  medianAcceptanceMinutes: number
  onTimePct: number
  byStatus: { status: OrderStatus; count: number }[]
  byHour: { hour: number; count: number }[]
}

export interface NewUser {
  name: string
  email: string
  role: Role
  stakeholderKind?: StakeholderKind
  region: Region | 'ALL'
}

export interface ArchModule {
  id: string
  name: string
  kind: 'hub' | 'system' | 'channel' | 'module'
  state: 'live' | 'planned'
  direction: 'in' | 'out' | 'both'
  detail: string
  exchanges: string[]
}

export interface Connector {
  id: string
  name: string
  connected: boolean
  freshness: Freshness | null
  objects: string[]
  records: number | null
  recordsLabel?: string
  lastSync: string | null
  writeBack: string | null
  mappingIssues: number
  permissions: string
  note?: string
  evidence?: string
  direction: 'in' | 'out' | 'both'
}

export interface Actor {
  name: string
  role: Role
}

export interface DeviationDraft {
  kind: DeviationKind
  qtyDelta: number | null
  note: string
}

export interface CustomerOrderDraft {
  customerId: string
  shipToId: string
  product: Product
  tonnes: number
  windowStart: string
  windowEnd: string
  note: string
}

export interface NotificationView extends Notification {
  text: string
  erpRef: string
}

/** A figure card on a horizontal rail: how big, of what, on what basis. */
export interface Observation {
  key: string
  tone: 'act' | 'watch' | 'held'
  eyebrow: string
  figure: string
  unit?: string
  title: string
  meta: string
  href: string
}

/** One computed sentence under a rail, with the phrase that links out. */
export interface AnalysisSentence {
  key: string
  text: string
  href: string
  linkText: string
}

// ── the seven surfaces ──────────────────────────────────────────────────────

export interface OrdersApi {
  worklist(filter?: WorklistFilter): Promise<WorklistRow[]>
  summary(): Promise<WorklistSummary>
  detail(orderId: string): Promise<OrderDetail | null>
  history(filter?: HistoryFilter): Promise<HistoryRow[]>
  lock(orderId: string): Promise<OrderLock | null>
  setPriority(orderId: string, priority: Priority, actor: Actor): Promise<AdvanceResult>
  /** Customer portal: raise a request the desk will send to the ERP. */
  raiseRequest(draft: CustomerOrderDraft): Promise<WorklistRow>
  /** Desk: hand a request to the ERP; the ERP returns its order number. */
  createInErp(orderId: string, actor: Actor): Promise<AdvanceResult>
  exceptions(): Promise<WorklistRow[]>
}

export interface CarrierApi {
  recommend(orderId: string): Promise<Recommendation[]>
  request(orderId: string, carrierId: string, rank: 1 | 2 | 3 | 0, actor: Actor): Promise<AdvanceResult>
  remind(requestId: string, actor: Actor): Promise<RequestRow>
  expedite(requestId: string, on: boolean, actor: Actor): Promise<RequestRow>
  requests(): Promise<RequestRow[]>
  requestsSummary(): Promise<RequestsSummary>
  inbox(carrierId: string): Promise<InboxRow[]>
  loads(carrierId: string): Promise<WorklistRow[]>
  respond(
    requestId: string,
    decision: 'accept' | 'reject',
    options: { truckId?: string; reason?: string },
    actor: Actor,
  ): Promise<AdvanceResult>
  /** Withdraw the open request, if any, and send a new one. */
  reassign(orderId: string, carrierId: string, actor: Actor): Promise<AdvanceResult>
  scorecard(weights?: Partial<ScorecardWeights>): Promise<ScorecardRow[]>
  carriers(): Promise<{ id: string; name: string; hasTms: boolean }[]>
}

export interface TrackingApi {
  timeline(orderId: string): Promise<StatusEvent[]>
  advance(orderId: string, next: OrderStatus, actor: Actor): Promise<AdvanceResult>
  positions(scope?: { customerId?: string; carrierId?: string }): Promise<TruckPosition[]>
  eta(orderId: string): Promise<Eta | null>
  yard(terminalId?: string): Promise<YardRow[]>
  dispatchBoard(): Promise<DispatchColumn[]>
}

export interface PodApi {
  get(orderId: string): Promise<PodDocument | null>
  sign(orderId: string, signature: { signedBy: string; signaturePng: string }, actor: Actor): Promise<AdvanceResult>
  upload(orderId: string, file: { name: string; sizeKb: number }, actor: Actor): Promise<AdvanceResult>
  annotate(orderId: string, text: string, actor: Actor): Promise<PodDocument>
  fileDeviation(orderId: string, draft: DeviationDraft, actor: Actor): Promise<Deviation>
  deviations(filter?: { orderId?: string }): Promise<(Deviation & { erpRef: string; customerName: string })[]>
}

export interface NotificationsApi {
  list(audience: Role, scope?: string): Promise<NotificationView[]>
  unreadCount(audience: Role, scope?: string): Promise<number>
  markRead(id: string): Promise<void>
  markAllRead(audience: Role, scope?: string): Promise<void>
  rules(): Promise<NotificationRule[]>
  saveRule(rule: NotificationRule): Promise<NotificationRule[]>
  deleteRule(id: string): Promise<NotificationRule[]>
  channels(): Promise<Channel[]>
}

export interface ReportsApi {
  build(spec: Omit<ReportSpec, 'id' | 'createdAt' | 'name'> & { name?: string }): Promise<ReportResult>
  saved(): Promise<ReportSpec[]>
  save(spec: Omit<ReportSpec, 'id' | 'createdAt'>): Promise<ReportSpec[]>
  benchmark(): Promise<BenchmarkSeries>
  workload(): Promise<WorkloadCell[]>
  eventLog(filter?: { orderId?: string; limit?: number }): Promise<(StatusEvent & { erpRef: string; customerName: string })[]>
  audit(): Promise<AuditEntry[]>
  live(): Promise<LiveAnalytics>
}

export interface AdminApi {
  users(): Promise<User[]>
  createUser(user: NewUser, actor: Actor): Promise<{ user: User; ticket: Ticket }>
  setRole(userId: string, role: Role, actor: Actor): Promise<User>
  tickets(): Promise<Ticket[]>
  security(): Promise<SecurityConfig>
  setSecurity(patch: Partial<SecurityConfig>, actor: Actor): Promise<SecurityConfig>
  architecture(): Promise<ArchModule[]>
}

export interface ActivityApi {
  recent(limit: number): Promise<ActivityItem[]>
}

export interface IntegrationsApi {
  connectors(): Promise<Connector[]>
}

export interface Api {
  orders: OrdersApi
  carrier: CarrierApi
  tracking: TrackingApi
  pod: PodApi
  notifications: NotificationsApi
  reports: ReportsApi
  admin: AdminApi
  activity: ActivityApi
  integrations: IntegrationsApi
}
