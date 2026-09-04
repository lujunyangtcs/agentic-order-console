/**
 * The guided walk.
 *
 * Scaffold: the overlay machinery is kept because the walkthrough is a scripted
 * 10–12 minute click path and this is its natural carrier, but the previous
 * steps are gone. This is filled with the walkthrough beats — Command Center, order
 * impact, Assembly Exposure, part resolution, requisition, write-back, then
 * flow 2 and the analytics breadth.
 *
 * `TourInvite` is disabled in `AppShell` until then, so an empty script is
 * never offered to a viewer.
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
