import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Role, StakeholderKind } from '@/types/domain'
import { TENANT } from './product'

/**
 * Fake session. There is no real authentication and there should not be: the
 * demo never displays credentials. The shape is close to what a real session
 * would carry so swapping it is mechanical.
 *
 * One identity, many hats. The role switcher changes `role` (and the
 * sub-identity that goes with it) while the person stays the same, which is
 * the honest reading of a demo tenant.
 */
export interface Session {
  userId: string
  name: string
  email: string
  tenantName: string
  role: Role
  /** Which of the four working views an Other Stakeholder is using. */
  stakeholderKind: StakeholderKind
  /** Which carrier the Carrier role is acting for. */
  carrierId: string
  /** Which customer the Customer role is acting for. */
  customerId: string
  /** Carriers without a transport system use the portal directly. */
  noTms: boolean
}

export const DEMO_IDENTITY = {
  userId: 'U-0412',
  name: 'RW',
  email: 'rw@example.com',
  tenantName: TENANT.name,
} as const

/** Defaults for the sub-identities; fixtures use the same ids. */
export const DEFAULT_CARRIER_ID = 'CAR-A'
export const DEFAULT_CUSTOMER_ID = 'CUST-01'

const SESSION_VERSION = 1
const KEY = `aoc.session.v${SESSION_VERSION}`

interface AuthValue {
  session: Session | null
  signIn: (role: Role) => void
  signOut: () => void
  setRole: (role: Role) => void
  setStakeholderKind: (kind: StakeholderKind) => void
  setCarrier: (carrierId: string, noTms?: boolean) => void
  setCustomer: (customerId: string) => void
}

const AuthContext = createContext<AuthValue | null>(null)

function read(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function persist(s: Session | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s))
    else sessionStorage.removeItem(KEY)
  } catch {
    /* Storage blocked — the session simply will not survive a reload. */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(read)

  const update = useCallback((patch: Partial<Session>) => {
    setSession((prev) => {
      const base: Session = prev ?? {
        ...DEMO_IDENTITY,
        role: 'CVC User',
        stakeholderKind: 'sales',
        carrierId: DEFAULT_CARRIER_ID,
        customerId: DEFAULT_CUSTOMER_ID,
        noTms: false,
      }
      const next = { ...base, ...patch }
      persist(next)
      return next
    })
  }, [])

  const signIn = useCallback((role: Role) => update({ role }), [update])
  const signOut = useCallback(() => {
    persist(null)
    setSession(null)
  }, [])
  const setRole = useCallback((role: Role) => update({ role }), [update])
  const setStakeholderKind = useCallback(
    (stakeholderKind: StakeholderKind) => update({ stakeholderKind, role: 'Other Stakeholder' }),
    [update],
  )
  const setCarrier = useCallback(
    (carrierId: string, noTms = false) => update({ carrierId, noTms, role: 'Carrier' }),
    [update],
  )
  const setCustomer = useCallback((customerId: string) => update({ customerId, role: 'Customer' }), [update])

  const value = useMemo(
    () => ({ session, signIn, signOut, setRole, setStakeholderKind, setCarrier, setCustomer }),
    [session, signIn, signOut, setRole, setStakeholderKind, setCarrier, setCustomer],
  )
  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthValue {
  const v = use(AuthContext)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}
