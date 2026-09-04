/**
 * The guided walk.
 *
 * The overlay machinery is kept because the demo is a scripted click path and
 * this is its natural carrier. The steps themselves are not authored yet; the
 * presenter's script lives in `docs/demo-script.md` (T1 order to delivery, T3
 * rejection and reassignment). `TourInvite` stays disabled in `AppShell` until
 * steps exist, so an empty walk is never offered to a viewer.
 */

/**
 * How a step ends.
 *
 * `next` is the only one that draws a button. The others wait on the person
 * doing the real thing — the product itself is the button — which is what keeps
 * a guided walk from turning into a slideshow with a spotlight.
 */
export type TourAdvance =
  | { on: 'route'; path: string }
  | { on: 'click' }
  | { on: 'change'; selector: string; identity: string }
  | { on: 'next' }

export interface TourStep {
  id: string
  route: string
  /** `data-tour` value of the element to spotlight. Omit to dim the whole page. */
  anchor?: string
  title: string
  meaning: string
  action?: string
  advance: TourAdvance
  place?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

export const TOUR_STEPS: TourStep[] = []
