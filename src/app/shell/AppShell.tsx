import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { LiveFeed } from './LiveFeed'
import { BackBar } from './BackBar'
import { DevPanel } from '../dev/DevPanel'
/* Mounted here, not in providers.tsx: the tour navigates, so it has to be
 * inside the router. */
import { TourProvider } from '../tour/TourProvider'
import { TourOverlay } from '../tour/TourOverlay'

export function AppShell() {
  const { session } = useAuth()
  const { pathname } = useLocation()
  if (!session) return <Navigate to="/login" replace />

  return (
    <TourProvider>
    <div className="bg-background flex h-full overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <LiveFeed />
        {/* `relative` is load-bearing, not cosmetic. Tailwind's .sr-only is
            position:absolute, and an absolute element resolves against its
            nearest POSITIONED ancestor — with none, that is the document, so
            overflow-auto here never clipped them. Every screen-reader label
            below the fold was extending the page and leaving a band of empty
            background under the app. */}
        <main className="relative min-h-0 flex-1 overflow-auto">
          {/* Keyed on the path: React tears the subtree down and rebuilds it
              on every navigation, which restarts the entrance. Without the key
              the animation would play once, on first load, and never again. */}
          {/* Under the activity rail, above the record, inside the scroll
              area so it moves with the page rather than pinning a second bar
              to the chrome. Renders itself away on every page that is one
              click from the nav. */}
          <BackBar />
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
      <DevPanel />
      <TourOverlay />
      {/* TourInvite stays off until steps.ts carries the walkthrough beats.
          An invitation to a walk that does not exist is worse than no
          invitation, and the copy has to describe this product, not a generic one. */}
    </div>
    </TourProvider>
  )
}
