import type { Notification, NotificationRule, Order, Priority, RuleTrigger } from '@/types/domain'
import type { MockState } from '@/services/mock/store'
import { RULES_DEFAULT } from './people'
import { CARRIER_BY_ID, CUSTOMER_BY_ID } from './network'
import { eventChain } from './chain'
import { ORDERS } from './orders'
import { TODAY, d } from './calendar'

/**
 * Who is told what, when.
 *
 * Rules are evaluated inside the same mutation that records a status change,
 * so a notification can never exist without the event that caused it. The
 * seed set is the same evaluation run over the fixture's recent events, so the
 * bell is not empty on first load.
 */

const PRIORITY_RANK: Record<Priority, number> = { standard: 0, priority: 1, urgent: 2 }

export function rulesOf(state: MockState): NotificationRule[] {
  return state.rules ?? RULES_DEFAULT
}

export function evaluateRules(
  rules: NotificationRule[],
  trigger: RuleTrigger,
  order: Order,
  carrierId: string | null,
  priority: Priority,
  at: string,
  extra: Record<string, string> = {},
): Notification[] {
  const customer = CUSTOMER_BY_ID[order.customerId]
  const carrier = carrierId ? CARRIER_BY_ID[carrierId] : null
  return rules
    .filter((r) => r.enabled && r.trigger === trigger)
    .filter((r) => !r.conditions.priorityAtLeast || PRIORITY_RANK[priority] >= PRIORITY_RANK[r.conditions.priorityAtLeast])
    .map((r) => ({
      id: `NT-${order.id}-${trigger}-${r.id}-${at.slice(11, 16).replace(':', '')}`,
      ruleId: r.id,
      orderId: order.id,
      audience: r.audience,
      scope: r.audience === 'Customer' ? order.customerId : r.audience === 'Carrier' ? carrierId : null,
      channels: r.channels,
      status: trigger === 'request_rejected' || trigger === 'deviation_filed' || trigger === 'bol_uploaded' ? 'order_created' : trigger,
      at,
      textKey: `notify.${trigger}`,
      params: {
        order: order.erpRef,
        customer: customer.name,
        carrier: carrier?.name ?? '—',
        ...extra,
      },
      read: false,
    }))
}

/** Fixture events from the last two days, run through the default rules. */
function buildSeed(): Notification[] {
  const since = d(-1)
  const out: Notification[] = []
  for (const o of ORDERS) {
    for (const e of eventChain(o)) {
      if (e.at.slice(0, 10) < since) continue
      out.push(...evaluateRules(RULES_DEFAULT, e.status, o, o.carrierId, o.priority, e.at))
    }
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

let seedCache: Notification[] | null = null
export function seedNotifications(): Notification[] {
  if (!seedCache) seedCache = buildSeed()
  return seedCache
}

export function notificationsFor(state: MockState, audience: Notification['audience'], scope?: string): Notification[] {
  const all = [...state.notifications, ...seedNotifications()]
  const reads = new Set(state.reads)
  return all
    .filter((n) => n.audience === audience && (!n.scope || !scope || n.scope === scope))
    .map((n) => ({ ...n, read: n.read || reads.has(n.id) }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

export const NOTIFY_SINCE = TODAY
