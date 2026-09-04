import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from './shell/AppShell'
import { CommandCenterRoute } from '@/routes/command-center/CommandCenterRoute'
import { AssemblyRoute } from '@/routes/assembly/AssemblyRoute'
import { OrderListRoute } from '@/routes/orders/OrderListRoute'
import { OrderImpactRoute } from '@/routes/orders/OrderImpactRoute'
import { ReplenishmentRoute } from '@/routes/replenishment/ReplenishmentRoute'
import { RequisitionSetRoute } from '@/routes/replenishment/RequisitionSetRoute'
import { AuditRoute } from '@/routes/audit/AuditRoute'
import { InventoryListRoute } from '@/routes/inventory/InventoryListRoute'
import { SkuDetailRoute } from '@/routes/inventory/SkuDetailRoute'
import { AnalyticsRoute } from '@/routes/analytics/AnalyticsRoute'
import { IntegrationsRoute } from '@/routes/integrations/IntegrationsRoute'

/**
 * The route table from §9.2.
 *
 * Three conventions, all load-bearing:
 *
 * **Lowercase kebab throughout, including params.** `/inventory/plant-a/main/ABC-1001`,
 * never `/inventory/PLANT-A/…`. The address bar is visible for the whole demo.
 *
 * **The SKU route carries a warehouse segment.** Principle 7 says the same item
 * may hold different targets by site *or warehouse*, so a route without it
 * cannot identify which planning record is open — which breaks deep links and
 * the state-preservation requirement in FR-023.
 *
 * **`/analytics` redirects rather than 404s.** The nav item points at a section,
 * and a section needs a landing page.
 *
 * **There are no stub routes left.** Supplier, purchase-order and BOM-explorer
 * pages were planned as standalone screens and were the designated second cut:
 * nothing in the product ever linked to them, because every fact they would
 * have carried is already reachable in a drawer next to the decision it
 * belongs to. Three routes that could only be reached by typing a URL, and
 * that rendered a placeholder naming a phase number, were worth less than the
 * catch-all redirect that now handles those paths.
 */

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/command-center" replace /> },

      { path: 'command-center', element: <CommandCenterRoute /> },

      { path: 'orders', element: <OrderListRoute /> },
      { path: 'orders/:orderId/impact', element: <OrderImpactRoute /> },

      { path: 'inventory', element: <InventoryListRoute /> },
      { path: 'inventory/:site/:warehouse/:sku', element: <SkuDetailRoute /> },

      { path: 'replenishment', element: <ReplenishmentRoute /> },
      { path: 'requisitions/:requisitionId', element: <RequisitionSetRoute /> },

      { path: 'assemblies/:configurationId', element: <AssemblyRoute /> },


      { path: 'analytics', element: <Navigate to="/analytics/inventory-health" replace /> },
      { path: 'analytics/inventory-health', element: <AnalyticsRoute /> },
      { path: 'analytics/safety-stock', element: <AnalyticsRoute /> },
      { path: 'analytics/procurement', element: <AnalyticsRoute /> },
      { path: 'analytics/variant-exposure', element: <AnalyticsRoute /> },

      { path: 'integrations', element: <IntegrationsRoute /> },
      { path: 'audit', element: <AuditRoute /> },

      { path: '*', element: <Navigate to="/command-center" replace /> },
    ],
  },
])
