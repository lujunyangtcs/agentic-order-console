/**
 * The mutable demo store.
 *
 * Everything the demo changes — an approved substitute, an edited requisition
 * line, a write-back — lands here and survives a reload, so a presenter who
 * refreshes mid-walk does not lose the state they just built.
 *
 * ## The storage key carries the seed version, deliberately
 *
 * The usual arrangement is a fixed key plus a version field that the loader
 * checks. That fails in a specific and expensive way: you edit a fixture, the
 * stored seed is still schema-valid, the check passes, and the screen shows
 * yesterday's numbers. The edit appears to have done nothing, and finding out
 * why costs about an hour.
 *
 * Keying the storage on the version makes a stale seed *unreachable* rather
 * than *guarded against*. Bump `SEED_VERSION` and the old entry is simply not
 * looked up. The build gate in `scripts/check-fixture-invariants.mts` fails
 * when the fixture hash moves and this constant did not, so the bump is not
 * something anyone has to remember.
 */

/** Bump on every change to the shape or content of the seeded fixture. */
export const SEED_VERSION = 1

const KEY = `agentic.store.v${SEED_VERSION}`

/**
 * Scaffold. Replaced by the real state — orders, requisitions,
 * approvals, part-resolution decisions, audit entries — read from the
 * generated fixture.
 */
export interface MockState {
  /** Seed schema version, mirrored into the payload for debugging. */
  v: number
  /** Decisions the presenter has made during this walk. */
  decisions: Record<string, unknown>
}

export function emptyState(): MockState {
  return { v: SEED_VERSION, decisions: {} }
}

let state: MockState | null = null
let ready: Promise<MockState> | null = null

function read(): MockState | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MockState
    /* Belt and braces: the key already encodes the version, so this can only
     * fire if someone hand-edited storage. */
    return parsed.v === SEED_VERSION ? parsed : null
  } catch {
    return null
  }
}

function persist(next: MockState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* Storage full or blocked. The demo still works; it just will not survive
     * a reload. Not worth interrupting a presenter over. */
  }
}

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
  if (!state) throw new Error('[mock] store read before whenReady() resolved')
  return state
}

export function peekState(): MockState | null {
  return state
}

export function mutate(fn: (s: MockState) => void): MockState {
  const s = getState()
  fn(s)
  persist(s)
  return s
}

export async function reset(): Promise<MockState> {
  sessionStorage.removeItem(KEY)
  state = null
  ready = null
  return whenReady()
}

/* Exposed so the standing verification protocol can assert that exactly one
 * seed key is held and that it matches the running build. */
declare global {
  interface Window {
    __SEED_VERSION__?: number
  }
}
if (typeof window !== 'undefined') window.__SEED_VERSION__ = SEED_VERSION
