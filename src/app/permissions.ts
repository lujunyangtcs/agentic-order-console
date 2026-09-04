import type { Role } from '@/types/domain'

/**
 * Who may do what.
 *
 * One table, read by every gate. A control the acting role may not use is
 * rendered inert and names the role that may — it is never hidden, because a
 * control that vanishes teaches people the action does not exist.
 */
export type Capability =
  /** Everything the demo shows without a gate. */
  | 'records.read'
  /** Assign, reassign or expedite a carrier request. */
  | 'order.assign'
  /** Accept or reject a request in the carrier inbox. */
  | 'request.respond'
  /** Move a truck through the eleven statuses. */
  | 'status.update'
  /** Record loading complete at the terminal. */
  | 'yard.load'
  /** Sign for a delivery. */
  | 'pod.sign'
  /** Upload a signed bill of lading. */
  | 'pod.upload'
  /** Annotate a proof of delivery. */
  | 'pod.annotate'
  /** File a delivery deviation. */
  | 'deviation.file'
  /** Reports, scorecards and the team view. */
  | 'reports.read'
  /** Users, rules, security, integrations. */
  | 'admin.manage'

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  Administrator: [
    'records.read', 'order.assign', 'request.respond', 'status.update', 'yard.load',
    'pod.sign', 'pod.upload', 'pod.annotate', 'deviation.file', 'reports.read', 'admin.manage',
  ],
  'CVC User': ['records.read', 'order.assign', 'deviation.file', 'pod.annotate', 'reports.read'],
  Carrier: ['records.read', 'request.respond', 'status.update', 'pod.upload'],
  'Other Stakeholder': ['records.read', 'order.assign', 'yard.load', 'pod.annotate', 'reports.read'],
  Customer: ['records.read', 'pod.sign', 'deviation.file'],
}

export const ALL_ROLES: readonly Role[] = [
  'CVC User', 'Carrier', 'Customer', 'Other Stakeholder', 'Administrator',
] as const

/** Short slugs for i18n keys and data attributes. */
export const ROLE_SLUG: Record<Role, string> = {
  Administrator: 'admin',
  'CVC User': 'cvc',
  Carrier: 'carrier',
  'Other Stakeholder': 'stakeholder',
  Customer: 'customer',
}

/** The role a denied capability should be requested from. Derived, not
 *  written twice. Administrator is the fallback holder, never the first. */
export function roleFor(capability: Capability): Role {
  const holder = ALL_ROLES.find(
    (r) => r !== 'Administrator' && ROLE_CAPABILITIES[r].includes(capability),
  )
  return holder ?? 'Administrator'
}

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability)
}
