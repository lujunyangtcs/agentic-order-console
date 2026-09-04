import type { NotificationRule, SecurityConfig, Ticket, User } from '@/types/domain'
import { ts } from './calendar'

/** The service desk and the people around it. Initials only — the brief's
 *  stakeholders by their initials, never a full name, real or invented. */
export const USERS: User[] = [
  { id: 'U-0412', name: 'RW', email: 'rw@example.com', role: 'CVC User', region: 'ECAN', active: true, mfaEnrolled: true, ticketId: null },
  { id: 'U-0418', name: 'EC', email: 'ec@example.com', role: 'CVC User', region: 'ECAN', active: true, mfaEnrolled: true, ticketId: null },
  { id: 'U-0421', name: 'JFH', email: 'jfh@example.com', role: 'CVC User', region: 'ECAN', active: true, mfaEnrolled: true, ticketId: null },
  { id: 'U-0433', name: 'CB', email: 'cb@example.com', role: 'CVC User', region: 'WCAN', active: true, mfaEnrolled: true, ticketId: null },
  { id: 'U-0102', name: 'RC', email: 'rc@example.com', role: 'Administrator', region: 'ALL', active: true, mfaEnrolled: true, ticketId: null },
  { id: 'U-0510', name: 'OH', email: 'oh@example.com', role: 'Other Stakeholder', stakeholderKind: 'sales', region: 'ECAN', active: true, mfaEnrolled: true, ticketId: null },
  { id: 'U-0514', name: 'SR', email: 'sr@example.com', role: 'Other Stakeholder', stakeholderKind: 'sales', region: 'WCAN', active: true, mfaEnrolled: true, ticketId: null },
  { id: 'U-0520', name: 'HL', email: 'hl@example.com', role: 'Other Stakeholder', stakeholderKind: 'planner', region: 'ALL', active: true, mfaEnrolled: true, ticketId: null },
  { id: 'U-0531', name: 'GA', email: 'ga@example.com', role: 'Other Stakeholder', stakeholderKind: 'dispatcher', region: 'ECAN', active: true, mfaEnrolled: true, ticketId: null },
  { id: 'U-0540', name: 'BK', email: 'bk@example.com', role: 'Other Stakeholder', stakeholderKind: 'shipping_point', region: 'ECAN', active: true, mfaEnrolled: false, ticketId: 'TCK-2' },
  { id: 'U-0544', name: 'MC', email: 'mc@example.com', role: 'Other Stakeholder', stakeholderKind: 'shipping_point', region: 'WCAN', active: true, mfaEnrolled: true, ticketId: null },
  { id: 'U-0602', name: 'Summit Haulage dispatch', email: 'dispatch@summit-haulage.example', role: 'Carrier', region: 'ECAN', active: true, mfaEnrolled: true, ticketId: 'TCK-1' },
]

export const USER_BY_ID: Record<string, User> = Object.fromEntries(USERS.map((u) => [u.id, u]))
export const CVRS: User[] = USERS.filter((u) => u.role === 'CVC User')

export const TICKETS: Ticket[] = [
  { id: 'TCK-1', system: 'ServiceNow', key: 'RITM0048213', state: 'closed', subject: 'Carrier portal access for Summit Haulage dispatch', userId: 'U-0602', createdAt: ts(-21, '10:12') },
  { id: 'TCK-2', system: 'ServiceNow', key: 'RITM0048877', state: 'approved', subject: 'Shipping-point user for Bath terminal', userId: 'U-0540', createdAt: ts(-6, '15:40') },
  { id: 'TCK-3', system: 'Jira', key: 'ITSD-1192', state: 'open', subject: 'Register the order console in the application catalogue', userId: 'U-0102', createdAt: ts(-2, '09:05') },
]

export const SECURITY_DEFAULT: SecurityConfig = {
  ssoProvider: 'entra',
  mfaRequired: true,
  sessionMinutes: 480,
  defaultLanguage: 'en',
}

/** Who is told what, when. Editable in the console; these are the defaults. */
export const RULES_DEFAULT: NotificationRule[] = [
  { id: 'RULE-1', name: 'Customer: order scheduled', trigger: 'order_scheduled', conditions: {}, audience: 'Customer', channels: ['email', 'portal'], enabled: true },
  { id: 'RULE-2', name: 'Customer: truck in transit', trigger: 'in_transit', conditions: {}, audience: 'Customer', channels: ['email', 'portal'], enabled: true },
  { id: 'RULE-3', name: 'Customer: truck on site', trigger: 'on_site', conditions: {}, audience: 'Customer', channels: ['portal', 'sms'], enabled: true },
  { id: 'RULE-4', name: 'Customer: delivery completed', trigger: 'delivery_completed', conditions: {}, audience: 'Customer', channels: ['email', 'portal'], enabled: true },
  { id: 'RULE-5', name: 'Service desk: request rejected', trigger: 'request_rejected', conditions: {}, audience: 'CVC User', channels: ['portal', 'email'], enabled: true },
  { id: 'RULE-6', name: 'Service desk: urgent order loaded', trigger: 'load_completed', conditions: { priorityAtLeast: 'urgent' }, audience: 'CVC User', channels: ['portal'], enabled: true },
  { id: 'RULE-7', name: 'Service desk: deviation filed', trigger: 'deviation_filed', conditions: {}, audience: 'CVC User', channels: ['portal', 'email'], enabled: true },
  { id: 'RULE-8', name: 'Shipping point: truck heading in', trigger: 'transit_to_terminal', conditions: {}, audience: 'Other Stakeholder', channels: ['portal'], enabled: true },
]
