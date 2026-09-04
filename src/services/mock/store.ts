import type {
  CarrierRequest, Deviation, Notification, NotificationRule, Order, PodDocument, Priority,
  SecurityConfig, StatusEvent, Ticket, User,
} from '@/types/domain'
import type { AuditEntry, ReportSpec } from '../contracts'

/**
 * The mutable demo store.
 *
 * Everything the demo changes — a request sent, a status tapped, a signature
 * captured, a rule saved — lands here and survives a reload, so a presenter
 * who refreshes mid-walk keeps the state they just built.
 *
 * ## The storage key carries the seed version, deliberately
 *
 * Keying the storage on the version makes a stale seed *unreachable* rather
 * than *guarded against*. Bump `SEED_VERSION` and the old entry is simply not
 * looked up. The build gate fails when the fixture hash moves and this
 * constant did not, so the bump is not something anyone has to remember.
 *
 * ## Other documents hear about changes
 *
 * The phone preview is the same app in an iframe. `storage` events do not
 * fire in the document that wrote, and the iframe needs to hear about writes
 * from the parent (and vice versa), so every mutation is announced on a
 * BroadcastChannel and every document reloads its state and invalidates its
 * queries when it hears one.
 */

/** Bump on every change to the shape or content of the seeded fixture. */
export const SEED_VERSION = 3

const KEY = `aoc.store.v${SEED_VERSION}`
const CHANNEL = 'aoc-store'

export interface Assignment {
  carrierId: string
  truckId: string | null
  at: string
  by: string
}

export interface OrderRequestDraft {
  id: string
  customerId: string
  shipToId: string
  product: string
  tonnes: number
  windowStart: string
  windowEnd: string
  note: string
  at: string
}

export interface MockState {
  v: number
  events: StatusEvent[]
  requests: Record<string, CarrierRequest>
  assignments: Record<string, Assignment>
  priorities: Record<string, Priority>
  pods: Record<string, PodDocument>
  deviations: Deviation[]
  notifications: Notification[]
  reads: string[]
  rules: NotificationRule[] | null
  users: User[] | null
  tickets: Ticket[]
  security: SecurityConfig | null
  locks: Record<string, string>
  reports: ReportSpec[]
  /** Orders the customer portal raised that the desk has not sent to the ERP yet. */
  orderRequests: OrderRequestDraft[]
  /** Orders created live during the walk (from a portal request). */
  liveOrders: Order[]
  /** What was decided, by whom, appended by every mutation. */
  audit: AuditEntry[]
  /** Free-form flags set by demo controls. */
  flags: Record<string, boolean>
}

export function emptyState(): MockState {
  return {
    v: SEED_VERSION,
    events: [],
    requests: {},
    assignments: {},
    priorities: {},
    pods: {},
    deviations: [],
    notifications: [],
    reads: [],
    rules: null,
    users: null,
    tickets: [],
    security: null,
    locks: {},
    reports: [],
    orderRequests: [],
    liveOrders: [],
    audit: [],
    flags: {},
  }
}

let state: MockState | null = null
let ready: Promise<MockState> | null = null
const listeners = new Set<() => void>()

function read(): MockState | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MockState
    return parsed.v === SEED_VERSION ? { ...emptyState(), ...parsed } : null
  } catch {
    return null
  }
}

function persist(next: MockState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* Storage full or blocked. The demo still works; it will not survive a reload. */
  }
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null
/* Under Node (the build gates and the probe) an open channel keeps the
 * process alive forever; unref lets the script exit once its work is done. */
;(channel as unknown as { unref?: () => void } | null)?.unref?.()
channel?.addEventListener('message', () => {
  const fresh = read()
  if (fresh) {
    state = fresh
    ready = Promise.resolve(fresh)
    listeners.forEach((fn) => fn())
  }
})

/** Await this before any read, so callers never race start-up ordering. */
export function whenReady(): Promise<MockState> {
  if (!ready) {
    ready = Promise.resolve(read() ?? emptyState()).then((s) => {
      state = s
      persist(s)
      return s
    })
  }
  return ready
}

export function getState(): MockState {
  if (!state) throw new Error('store read before whenReady()')
  return state
}

export async function mutate(fn: (draft: MockState) => void): Promise<MockState> {
  const s = await whenReady()
  fn(s)
  persist(s)
  channel?.postMessage({ v: SEED_VERSION, at: Date.now() })
  return s
}

/** Subscribe to writes made by other documents (the phone preview). */
export function onExternalChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function reset() {
  for (const k of Object.keys(sessionStorage)) {
    if (k.startsWith('aoc.')) sessionStorage.removeItem(k)
  }
  channel?.postMessage({ v: SEED_VERSION, at: Date.now(), reset: true })
}
