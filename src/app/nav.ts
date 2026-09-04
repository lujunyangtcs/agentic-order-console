import {
  ClipboardList, Send, AlertTriangle, MapPin, BarChart3, Trophy, TrendingUp, Users,
  History, Inbox, Truck, Package, Bell, LayoutGrid, Warehouse, Route, Shield, ShieldCheck,
  Plug, Network, ScrollText, ListChecks,
  type LucideIcon,
} from 'lucide-react'
import type { Role, StakeholderKind } from '@/types/domain'
import type { I18nKey } from '@/i18n'

export interface NavItem {
  to: string
  labelKey: I18nKey
  icon: LucideIcon
  /** Which summary figure feeds the badge, if any. */
  badge?: 'newRequests' | 'pendingCarrier' | 'needsAttention' | 'inboxWaiting' | 'unread'
}

export interface NavGroup {
  titleKey: I18nKey
  items: NavItem[]
}

/** Where each role lands after sign-in and after a bad URL. */
export const HOME_BY_ROLE: Record<Role, string> = {
  Administrator: '/admin/users',
  'CVC User': '/worklist',
  Carrier: '/carrier/inbox',
  'Other Stakeholder': '/stakeholder',
  Customer: '/portal',
}

const STAKEHOLDER_HOME: Record<StakeholderKind, string> = {
  sales: '/stakeholder',
  planner: '/reports/benchmark',
  dispatcher: '/dispatch',
  shipping_point: '/yard',
}

export function homeFor(role: Role, kind: StakeholderKind): string {
  return role === 'Other Stakeholder' ? STAKEHOLDER_HOME[kind] : HOME_BY_ROLE[role]
}

/**
 * The rail, per role. Every label is at most three words in both languages;
 * the i18n gate enforces it. Groups answer "what am I here to do" first and
 * "what does the system know" last.
 */
export function navFor(role: Role): NavGroup[] {
  switch (role) {
    case 'CVC User':
      return [
        { titleKey: 'nav.group.work', items: [
          { to: '/worklist', labelKey: 'nav.worklist', icon: ClipboardList, badge: 'newRequests' },
          { to: '/requests', labelKey: 'nav.requests', icon: Send, badge: 'pendingCarrier' },
          { to: '/exceptions', labelKey: 'nav.exceptions', icon: AlertTriangle, badge: 'needsAttention' },
          { to: '/track', labelKey: 'nav.track', icon: MapPin },
        ] },
        { titleKey: 'nav.group.insight', items: [
          { to: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
          { to: '/reports/scorecard', labelKey: 'nav.scorecard', icon: Trophy },
          { to: '/reports/benchmark', labelKey: 'nav.benchmark', icon: TrendingUp },
          { to: '/reports/team', labelKey: 'nav.team', icon: Users },
          { to: '/history', labelKey: 'nav.history', icon: History },
        ] },
        { titleKey: 'nav.group.system', items: [
          { to: '/events', labelKey: 'nav.events', icon: ScrollText },
          { to: '/audit', labelKey: 'nav.audit', icon: ListChecks },
        ] },
      ]
    case 'Carrier':
      return [
        { titleKey: 'nav.group.carrier', items: [
          { to: '/carrier/inbox', labelKey: 'nav.inbox', icon: Inbox, badge: 'inboxWaiting' },
          { to: '/carrier/loads', labelKey: 'nav.loads', icon: Truck },
          { to: '/track', labelKey: 'nav.track', icon: MapPin },
          { to: '/reports/scorecard', labelKey: 'nav.scorecard', icon: Trophy },
          { to: '/history', labelKey: 'nav.history', icon: History },
        ] },
      ]
    case 'Customer':
      return [
        { titleKey: 'nav.group.customer', items: [
          { to: '/portal', labelKey: 'nav.portal', icon: Package },
          { to: '/track', labelKey: 'nav.track', icon: MapPin },
          { to: '/notifications', labelKey: 'nav.notifications', icon: Bell, badge: 'unread' },
          { to: '/history', labelKey: 'nav.history', icon: History },
        ] },
      ]
    case 'Other Stakeholder':
      return [
        { titleKey: 'nav.group.views', items: [
          { to: '/stakeholder', labelKey: 'nav.stakeholder', icon: LayoutGrid },
          { to: '/yard', labelKey: 'nav.yard', icon: Warehouse },
          { to: '/dispatch', labelKey: 'nav.dispatch', icon: Route },
          { to: '/track', labelKey: 'nav.track', icon: MapPin },
        ] },
        { titleKey: 'nav.group.insight', items: [
          { to: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
          { to: '/reports/benchmark', labelKey: 'nav.benchmark', icon: TrendingUp },
          { to: '/events', labelKey: 'nav.events', icon: ScrollText },
        ] },
      ]
    case 'Administrator':
      return [
        { titleKey: 'nav.group.admin', items: [
          { to: '/admin/users', labelKey: 'nav.users', icon: Users },
          { to: '/admin/notification-rules', labelKey: 'nav.rules', icon: Bell },
          { to: '/admin/security', labelKey: 'nav.security', icon: ShieldCheck },
          { to: '/admin/integrations', labelKey: 'nav.integrations', icon: Plug },
          { to: '/admin/architecture', labelKey: 'nav.architecture', icon: Network },
        ] },
        { titleKey: 'nav.group.insight', items: [
          { to: '/worklist', labelKey: 'nav.worklist', icon: ClipboardList },
          { to: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
          { to: '/reports/scorecard', labelKey: 'nav.scorecard', icon: Trophy },
          { to: '/reports/team', labelKey: 'nav.team', icon: Users },
        ] },
        { titleKey: 'nav.group.system', items: [
          { to: '/events', labelKey: 'nav.events', icon: ScrollText },
          { to: '/audit', labelKey: 'nav.audit', icon: Shield },
        ] },
      ]
  }
}

/** The four tabs the phone shell shows: the first four items of the role. */
export function mobileTabsFor(role: Role): NavItem[] {
  return navFor(role).flatMap((g) => g.items).slice(0, 4)
}
