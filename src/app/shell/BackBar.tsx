import { useLocation, useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'

/**
 * The way back out of a record.
 *
 * The left nav reaches every list, but nothing reaches back *up* from a single
 * case — and the walk arrives at these pages from three different places. The
 * SKU detail is opened from the inventory list, from a Command Center card and
 * from an analytics drill-through; the assembly sheet is opened from an order.
 * A fixed "up to the list" link would be wrong two times in three.
 *
 * So it goes back the way you came, and only falls back to the parent list when
 * there is nowhere to go back to — a deep link, a refresh, or the first page of
 * the session. React Router keeps an `idx` on the history entry, and `idx > 0`
 * is the honest test for "this session has somewhere to return to". Without
 * that check `navigate(-1)` on a freshly opened URL walks the presenter out of
 * the app mid-demo.
 *
 * Only on records. The list pages and the analytics tabs are all one click away
 * in the nav, and a back control on a page you never drilled into is noise that
 * teaches people to stop reading the ones that matter.
 */

/** Where a record type sits, for the case where history cannot answer. */
const PARENT: { match: RegExp; to: string; label: string }[] = [
  { match: /^\/orders\/[^/]+\/impact$/, to: '/orders', label: 'Order Impact' },
  { match: /^\/inventory\/[^/]+\/[^/]+\/[^/]+$/, to: '/inventory', label: 'Inventory Intelligence' },
  { match: /^\/requisitions\/[^/]+$/, to: '/replenishment', label: 'Replenishment' },
  { match: /^\/assemblies\/[^/]+$/, to: '/orders', label: 'Order Impact' },
]

export function BackBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const parent = PARENT.find((p) => p.match.test(pathname))
  if (!parent) return null

  /* React Router stamps an index onto each history entry. Zero means this is
   * where the session started, so there is no in-app step to return to. */
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  const canGoBack = idx > 0

  return (
    /* No bar. The first version painted a full-width white strip with its own
     * border under the activity rail, which put a second piece of chrome
     * between the rail and the record and read as heavier than the control it
     * carried. One small button on the page ground is the whole of it. */
    <div className="shrink-0 px-6 pt-3">
      <button
        type="button"
        data-back-bar
        onClick={() => (canGoBack ? navigate(-1) : navigate(parent.to))}
        className="text-muted-foreground hover:text-foreground hover:bg-hover-tint focus-visible:ring-ring -ml-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-2xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {/* Named when it is a fallback, bare when it is history — saying
            "Back to Inventory Intelligence" after a drill-through from
            analytics would be a promise about a destination this control is
            not going to. */}
        {canGoBack ? 'Back' : `Back to ${parent.label}`}
      </button>
    </div>
  )
}
