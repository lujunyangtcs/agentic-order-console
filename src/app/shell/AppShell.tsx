import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth'
import { isEmbed } from '../embed'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { LiveFeed } from './LiveFeed'
import { BackBar } from './BackBar'
import { MobileShell } from './MobileShell'
import { DevPanel } from '../dev/DevPanel'
import { TourProvider } from '../tour/TourProvider'
import { TourOverlay } from '../tour/TourOverlay'
import { PhoneProvider } from '../phone'
import { PhoneDock } from '@/components/preview/PhoneDock'

/**
 * The application frame.
 *
 * Desktop (≥ 1024px): rail, top bar, activity ticker, and a scrolling main
 * region — the page itself never scrolls. Below that the rail becomes a
 * drawer behind the menu button and the document scrolls normally, because a
 * locked viewport on a phone is a page that cannot be read to the end.
 *
 * `?embed=1` swaps the whole frame for the phone chrome; the routes inside
 * are unchanged.
 */
export function AppShell() {
  const { session } = useAuth()
  const { pathname } = useLocation()
  if (!session) return <Navigate to="/login" replace />
  if (isEmbed) return <MobileShell />

  return (
    <TourProvider>
      <PhoneProvider>
        <div className="bg-background flex min-h-full lg:h-full lg:overflow-hidden">
          <Sidebar className="hidden lg:flex" />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <LiveFeed />
            <main className="relative min-h-0 flex-1 lg:overflow-auto">
              <BackBar />
              <div key={pathname} className="page-enter">
                <Outlet />
              </div>
            </main>
          </div>
          <PhoneDock />
          <DevPanel />
          <TourOverlay />
        </div>
      </PhoneProvider>
    </TourProvider>
  )
}
