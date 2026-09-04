import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '@/types/domain'

/** Fake session. There is no real auth and there should not be: §19.4
 *  forbids the demo from displaying credentials at all. The shape is
 *  deliberately close to what a real session would carry so swapping it is
 *  mechanical. */
export interface Session {
  userId: string
  name: string
  email: string
  tenantId: string
  tenantName: string
  /** §5 — the exact permission string the UI names when access is refused. */
  role: Role
}

/* The demo runs as a Planner: §5 makes that the driving user, and the only
 * other role that acts during the walk is the Engineering Approver, who signs
 * off a substitute in flow 1 and hands control straight back.
 *
 * The identity has to agree with the fixture. A header naming one planner while
 * every requisition names another is the kind of small contradiction that costs
 * more credibility than it should. */
const DEMO_SESSION: Session = {
  userId: 'U-2208',
  name: 'Alex Morgan',
  email: 'alex.morgan@abc.example',
  tenantId: 't_agentic',
  tenantName: 'ABC Manufacturing',
  role: 'Planner',
}

/* Bumped when the demo identity changes. Without this a tab opened before the
 * change keeps showing the old tenant name in the header while every document
 * says the new one. */
const SESSION_VERSION = 3
const KEY = `agentic.session.v${SESSION_VERSION}`

interface AuthValue {
  session: Session | null
  signIn: () => void
  signOut: () => void
  /**
   * Act as another role.
   *
   * Not a demo gimmick: §20 step 5 has the presenter approve a substitute **as
   * Engineering Approver and return to Planner**, so the walk cannot be
   * performed without it. It is also the only way to show FR-030 — a permission
   * model nobody can cross is indistinguishable from no permission model.
   *
   * The identity does not change with the role. One person wearing a different
   * hat is the honest reading of a demo tenant, and swapping the name as well
   * would suggest a second user account that does not exist.
   */
  setRole: (role: Role) => void
}

const AuthContext = createContext<AuthValue | null>(null)

/* There is no login screen. §20 opens the demo on the Command Center, and
 * a sign-in page between the presenter and the first slide is thirty seconds of
 * a twelve-minute budget spent on a screen that proves nothing. Absent storage
 * means "start as the demo user", not "signed out". */
function read(): Session {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : DEMO_SESSION
  } catch {
    return DEMO_SESSION
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(read)

  const signIn = useCallback(() => {
    sessionStorage.setItem(KEY, JSON.stringify(DEMO_SESSION))
    setSession(DEMO_SESSION)
  }, [])

  const signOut = useCallback(() => {
    sessionStorage.removeItem(KEY)
    setSession(null)
  }, [])

  const setRole = useCallback((role: Role) => {
    setSession((prev) => {
      const next = { ...(prev ?? DEMO_SESSION), role }
      sessionStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ session, signIn, signOut, setRole }),
    [session, signIn, signOut, setRole],
  )
  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthValue {
  const v = use(AuthContext)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}

export { DEMO_SESSION }
