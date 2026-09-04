import type { Role } from '@/types/domain'

/**
 * Who may do what. §5.1, transcribed rather than interpreted.
 *
 * ## Why this is a table and not a set of `role === 'Planner'` checks
 *
 * §5.1 is normative: the role strings it lists are the exact strings the UI
 * must name when it refuses an action, and the same strings the audit record
 * carries. Scattering the comparisons through components guarantees that one
 * of them eventually says "Planner or admin" and the model quietly stops
 * matching the document. One table, five capabilities, and every gate in the
 * product reads from it.
 *
 * ## The rule that matters more than the table
 *
 * §18 says a permission-denied state must "not silently hide a decision gate",
 * and FR-030 says it must name the role required. Those two together rule out
 * the reflex every codebase reaches for first — `{can && <Button/>}`. A control
 * that vanishes teaches the user that the action does not exist; a control that
 * is present, refused and explained teaches them who to go and ask.
 *
 * There is exactly one case where absence is right, and it is not a permission
 * case at all: something that is *ineligible* by its nature — a part that is
 * merely similar-sounding can never be allocated by anyone, so there is no
 * approver to name and no gate to show. Ineligible and unauthorised look the
 * same on screen if you are careless, and they are not the same fact.
 */

export type Capability =
  /** §5.1 — edit recommendation fields and create a draft PR. */
  | 'requisition.create'
  /** §5.1 — approve or reject a requisition. Never the same person who raised it. */
  | 'requisition.approve'
  /** §5.1 — approve a substitute part. The sign-off in flow 1. */
  | 'substitution.approve'
  /** §5.1 — manage connector mode and review write-back logs. */
  | 'connector.manage'
  /** Everything the demo shows without a gate: analytics, records, drill-through. */
  | 'records.read'

/** §5.1, verbatim. A capability absent from a role's list is refused. */
export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  Viewer: ['records.read'],
  Planner: ['records.read', 'requisition.create'],
  'Procurement Approver': ['records.read', 'requisition.approve'],
  'Engineering Approver': ['records.read', 'substitution.approve'],
  'ERP Administrator': ['records.read', 'connector.manage'],
}

/**
 * The role a denied capability should be requested from.
 *
 * Derived from the table rather than written twice, so a capability that moves
 * between roles cannot leave a stale "ask your administrator" behind. Where
 * more than one role holds it the first is named — the table is ordered by who
 * a planner would actually go to.
 */
export function roleFor(capability: Capability): Role {
  const holder = (Object.keys(ROLE_CAPABILITIES) as Role[]).find(
    (r) => r !== 'Viewer' && ROLE_CAPABILITIES[r].includes(capability),
  )
  /* Unreachable while every capability appears in the table above, which the
   * build gate asserts. Kept because a silent `undefined` rendered into
   * "requires undefined" is a worse failure than a loud one. */
  if (!holder) throw new Error(`No role holds ${capability}`)
  return holder
}

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability)
}

/** §5 — what each role is for, shown when switching and when refusing. */
export const ROLE_PURPOSE: Record<Role, string> = {
  Planner: 'Maintain material availability and create requisitions',
  'Engineering Approver': 'Confirm configuration, revision and substitutes',
  'Procurement Approver': 'Control spend, shortages and approval governance',
  'ERP Administrator': 'Protect system-of-record integrity and integration security',
  Viewer: 'Understand production impact and inventory health',
}

export const ALL_ROLES = Object.keys(ROLE_CAPABILITIES) as Role[]
