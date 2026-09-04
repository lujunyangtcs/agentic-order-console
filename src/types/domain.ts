/**
 * Domain vocabulary for the order console.
 *
 * Two rules govern everything here.
 *
 * 1. **Vocabularies are closed.** The eleven order statuses, the five roles,
 *    the four stakeholder kinds and the priority levels are unions, not
 *    strings. A screen that invents a twelfth status has diverged from the
 *    client's requirements document, and the build gate objects.
 *
 * 2. **Events are the truth.** An order does not carry a status field that
 *    somebody updates; it carries a chain of `StatusEvent`s and its status is
 *    the last one. Every roll-up — status, estimated arrival, hours spent in a
 *    stage, on-time rate, scorecard — is derived from that chain in
 *    `src/fixtures/derive.ts`. Nothing is stored twice.
 */

/** The five roles the requirements name. The strings are shown verbatim in
 *  permission refusals and the role switcher, so they stay human. */
export type Role =
  | 'Administrator'
  | 'CVC User'
  | 'Carrier'
  | 'Other Stakeholder'
  | 'Customer'

/** The "Other Stakeholder" role is one login with four working views. */
export type StakeholderKind = 'sales' | 'planner' | 'dispatcher' | 'shipping_point'

export const STAKEHOLDER_KINDS: readonly StakeholderKind[] = [
  'sales', 'planner', 'dispatcher', 'shipping_point',
] as const

/** The eleven statuses an order passes through, in order. */
export const ORDER_STATUSES = [
  'order_created',
  'pending_carrier',
  'order_scheduled',
  'transit_to_terminal',
  'starting_load',
  'load_completed',
  'in_transit',
  'on_site',
  'unloading',
  'unload_completed',
  'delivery_completed',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export function statusIndex(s: OrderStatus): number {
  return ORDER_STATUSES.indexOf(s)
}
export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = statusIndex(s)
  return i >= 0 && i < ORDER_STATUSES.length - 1 ? ORDER_STATUSES[i + 1] : null
}

export type Priority = 'standard' | 'priority' | 'urgent'
export const PRIORITIES: readonly Priority[] = ['standard', 'priority', 'urgent'] as const

/** Cement products, by the trade codes the sales desk uses. Labelled in plain
 *  words through i18n (`product.GU` → "General use cement"). */
export type Product = 'GU' | 'HE' | 'GUL' | 'MS'

export type Region = 'WCAN' | 'ECAN'

/** [latitude, longitude] — the Leaflet convention. */
export type LatLng = [number, number]

export interface Order {
  id: string
  /** The number the system of record returned when the order was created. */
  erpRef: string
  customerId: string
  shipToId: string
  terminalId: string
  product: Product
  tonnes: number
  window: { start: string; end: string }
  priority: Priority
  cvrId: string
  carrierId: string | null
  truckId: string | null
  /** Authored 0–1: how far along the lane an in-transit truck sits. */
  transitProgress: number
  /** Authored: the status the seed chain runs to, and when it started. */
  seed: { target: OrderStatus; startAt: string }
}

export type EventSource = 'erp' | 'console' | 'carrier' | 'scale' | 'customer' | 'system'

export interface StatusEvent {
  id: string
  orderId: string
  status: OrderStatus
  at: string
  /** Who or what recorded it — a user's name, a carrier's name, or a system. */
  actor: string
  source: EventSource
  note?: string
}

export type RequestState = 'sent' | 'accepted' | 'rejected' | 'withdrawn'

export interface CarrierRequest {
  id: string
  orderId: string
  carrierId: string
  /** Where the carrier sat in the suggestion list when it was chosen. */
  rank: 1 | 2 | 3 | 0
  state: RequestState
  sentAt: string
  respondedAt: string | null
  reason?: string
  reminders: string[]
  expedited: boolean
  truckId?: string
  by: string
}

export interface Carrier {
  id: string
  name: string
  yard: LatLng
  province: string
  regions: Region[]
  /** Terminal ids this carrier loads from. */
  terminals: string[]
  trucks: number
  hasTms: boolean
  /** Contract rate per tonne keyed on `${terminalId}>${shipToId}`. */
  rates: Record<string, number>
}

export interface Truck {
  id: string
  carrierId: string
  plate: string
  capacityT: number
  driver: string
}

export interface Terminal {
  id: string
  name: string
  city: string
  province: string
  region: Region
  latLng: LatLng
}

export interface ShipTo {
  id: string
  customerId: string
  name: string
  city: string
  province: string
  region: Region
  latLng: LatLng
  unloadMinutes: number
}

export interface Customer {
  id: string
  name: string
  language: 'en' | 'fr'
  contact: string
}

export type Channel = 'email' | 'portal' | 'sms'

export interface Notification {
  id: string
  ruleId: string | null
  orderId: string
  audience: Role
  /** Narrows the audience to one customer or carrier when set. */
  scope: string | null
  channels: Channel[]
  status: OrderStatus
  at: string
  /** i18n key; the text is rendered in the reader's language. */
  textKey: string
  params: Record<string, string>
  read: boolean
}

export interface NotificationRule {
  id: string
  name: string
  trigger: OrderStatus
  conditions: { priorityAtLeast?: Priority; lateMinutesOver?: number }
  audience: Role
  channels: Channel[]
  enabled: boolean
}

export type DeviationKind = 'wrong_product' | 'short_quantity' | 'excess_quantity' | 'handover_issue'

export interface Deviation {
  id: string
  orderId: string
  kind: DeviationKind
  qtyDelta: number | null
  note: string
  filedBy: string
  filedAt: string
  state: 'open' | 'acknowledged' | 'resolved'
}

export interface PodDocument {
  id: string
  orderId: string
  bolNumber: string
  source: 'signature' | 'upload'
  signedBy: string
  signedAt: string
  signaturePng: string | null
  file: { name: string; sizeKb: number } | null
  annotations: { by: string; at: string; text: string }[]
  archivedAt: string | null
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  stakeholderKind?: StakeholderKind
  region: Region | 'ALL'
  active: boolean
  mfaEnrolled: boolean
  ticketId: string | null
}

export interface Ticket {
  id: string
  system: 'ServiceNow' | 'Jira'
  key: string
  state: 'open' | 'approved' | 'closed'
  subject: string
  userId: string
  createdAt: string
}

export interface SecurityConfig {
  ssoProvider: 'none' | 'entra' | 'okta'
  mfaRequired: boolean
  sessionMinutes: number
  defaultLanguage: 'en' | 'fr'
}

/** How urgent a finding is. Every one carries a glyph as well as a colour. */
export type Severity = 'critical' | 'high' | 'medium' | 'info'

/** Source freshness, distinct from connection state. */
export type Freshness = 'fresh' | 'delayed' | 'partial' | 'mapping_issue'
