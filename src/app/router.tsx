import { createBrowserRouter, Navigate } from 'react-router'
import type { ReactNode } from 'react'
import { AppShell } from './shell/AppShell'
import { HomeRedirect } from './shell/HomeRedirect'
import { LoginRoute } from '@/routes/login/LoginRoute'
import { PlaceholderRoute } from '@/routes/shared/PlaceholderRoute'
import { HistoryRoute } from '@/routes/history/HistoryRoute'
import { PortalRoute } from '@/routes/portal/PortalRoute'
import { EpodRoute } from '@/routes/epod/EpodRoute'
import { StakeholderRoute } from '@/routes/stakeholder/StakeholderRoute'
import { YardRoute } from '@/routes/yard/YardRoute'
import { DispatchRoute } from '@/routes/dispatch/DispatchRoute'
import { RouteGate } from '@/components/state/RouteGate'
import { AuditRoute } from '@/routes/audit/AuditRoute'
import { IntegrationsRoute } from '@/routes/admin/IntegrationsRoute'
import { WorklistRoute } from '@/routes/worklist/WorklistRoute'
import { OrderRoute } from '@/routes/orders/OrderRoute'
import { RequestsRoute } from '@/routes/requests/RequestsRoute'
import { InboxRoute } from '@/routes/carrier/InboxRoute'
import { LoadsRoute } from '@/routes/carrier/LoadsRoute'
import { TrackRoute } from '@/routes/track/TrackRoute'
import { NotificationsRoute } from '@/routes/notifications/NotificationsRoute'
import { RulesRoute } from '@/routes/admin/RulesRoute'
import type { Role } from '@/types/domain'
import type { I18nKey } from '@/i18n'

/**
 * The route table.
 *
 * Lowercase kebab throughout, including params — the address bar is visible
 * for the whole demo. One order page for every role: `/orders/:orderId` shows
 * different panels depending on who is looking, which is how the same order
 * can be walked across five hats without five screens.
 *
 * There are no stub routes reachable only by typing a URL. Every path here is
 * linked from a rail, a card or a row.
 */

const ALL: Role[] = ['CVC User', 'Carrier', 'Customer', 'Other Stakeholder', 'Administrator']
const CVC: Role[] = ['CVC User']
const STAFF: Role[] = ['CVC User', 'Other Stakeholder']
const CARRIER: Role[] = ['Carrier']
const CUSTOMER: Role[] = ['Customer']
const STAKEHOLDER: Role[] = ['Other Stakeholder']
const ADMIN: Role[] = ['Administrator']

function gate(owners: Role[], node: ReactNode) {
  return <RouteGate owners={owners}>{node}</RouteGate>
}
function page(owners: Role[], titleKey: I18nKey, descKey?: I18nKey) {
  return gate(owners, <PlaceholderRoute titleKey={titleKey} descKey={descKey} />)
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeRedirect /> },

      // ── service desk ────────────────────────────────────────────────
      { path: 'worklist', element: gate(CVC, <WorklistRoute />) },
      { path: 'orders/:orderId', element: gate(ALL, <OrderRoute />) },
      { path: 'requests', element: gate(STAFF, <RequestsRoute />) },
      { path: 'exceptions', element: page(CVC, 'page.exceptions.title', 'page.exceptions.desc') },
      { path: 'track', element: gate(ALL, <TrackRoute />) },

      // ── reports ─────────────────────────────────────────────────────
      { path: 'reports', element: page(STAFF, 'page.reports.title', 'page.reports.desc') },
      { path: 'reports/scorecard', element: page([...STAFF, 'Carrier'], 'page.scorecard.title', 'page.scorecard.desc') },
      { path: 'reports/benchmark', element: page(STAFF, 'page.benchmark.title', 'page.benchmark.desc') },
      { path: 'reports/team', element: page(CVC, 'page.team.title', 'page.team.desc') },
      { path: 'history', element: gate(ALL, <HistoryRoute />) },

      // ── carrier ─────────────────────────────────────────────────────
      { path: 'carrier', element: <Navigate to="/carrier/inbox" replace /> },
      { path: 'carrier/inbox', element: gate(CARRIER, <InboxRoute />) },
      { path: 'carrier/loads', element: gate(CARRIER, <LoadsRoute />) },

      // ── customer ────────────────────────────────────────────────────
      { path: 'portal', element: gate(CUSTOMER, <PortalRoute />) },
      { path: 'notifications', element: gate(ALL, <NotificationsRoute />) },

      // ── other stakeholders ──────────────────────────────────────────
      { path: 'stakeholder', element: gate(STAKEHOLDER, <StakeholderRoute />) },
      { path: 'yard', element: gate(STAKEHOLDER, <YardRoute />) },
      { path: 'dispatch', element: gate(STAKEHOLDER, <DispatchRoute />) },
      { path: 'epod/:orderId', element: gate(ALL, <EpodRoute />) },

      // ── administration ──────────────────────────────────────────────
      { path: 'admin', element: <Navigate to="/admin/users" replace /> },
      { path: 'admin/users', element: page(ADMIN, 'page.users.title', 'page.users.desc') },
      { path: 'admin/notification-rules', element: gate(ADMIN, <RulesRoute />) },
      { path: 'admin/security', element: page(ADMIN, 'page.security.title', 'page.security.desc') },
      { path: 'admin/integrations', element: gate(ADMIN, <IntegrationsRoute />) },
      { path: 'admin/architecture', element: page(ADMIN, 'page.architecture.title', 'page.architecture.desc') },

      // ── system ──────────────────────────────────────────────────────
      { path: 'events', element: page(STAFF, 'page.events.title', 'page.events.desc') },
      { path: 'audit', element: gate(CVC, <AuditRoute />) },

      { path: '*', element: <HomeRedirect /> },
    ],
  },
])
