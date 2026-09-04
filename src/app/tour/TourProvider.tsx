import {
  createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router'
import { TOUR_STEPS, type TourStep } from './steps'

const KEY = 'abc.tour.v1'

type Status = 'unseen' | 'running' | 'skipped' | 'done'

interface TourValue {
  status: Status
  step: TourStep | null
  index: number
  total: number
  start: () => void
  next: () => void
  back: () => void
  skip: () => void
}

const TourContext = createContext<TourValue | null>(null)

/**
 * Drives the guided tour.
 *
 * Two things it deliberately does NOT do. It never blocks the product — the
 * spotlight leaves the highlighted control clickable, so the person is always
 * doing the real thing rather than watching a simulation. And it never
 * restarts itself: once skipped or finished it stays that way until asked for
 * again from the user menu, because a tour that reappears is an obstacle.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(
    () => (localStorage.getItem(KEY) as Status | null) ?? 'unseen',
  )
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const step = status === 'running' ? (TOUR_STEPS[index] ?? null) : null

  const persist = useCallback((s: Status) => {
    setStatus(s)
    if (s === 'skipped' || s === 'done') localStorage.setItem(KEY, s)
    else localStorage.removeItem(KEY)
  }, [])

  const start = useCallback(() => {
    setIndex(0)
    persist('running')
    navigate(TOUR_STEPS[0].route)
  }, [navigate, persist])

  const next = useCallback(() => {
    setIndex((i) => {
      const at = i + 1
      if (at >= TOUR_STEPS.length) {
        persist('done')
        return i
      }
      return at
    })
  }, [persist])

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const skip = useCallback(() => persist('skipped'), [persist])

  /* A step that lives elsewhere takes you there, so the tour can never point
   * at something that is not on screen. Steps whose route is the queue are an
   * exception: by then the person is inside one reconciliation, and sending
   * them back to the list would undo their own click. */
  useEffect(() => {
    if (!step) return
    const alreadyDeeper = step.route === '/queue' && pathname.startsWith('/reconciliation/')
    if (pathname !== step.route && !alreadyDeeper) {
      const t = setTimeout(() => navigate(step.route), 60)
      return () => clearTimeout(t)
    }
  }, [step, pathname, navigate])

  /* Advancing on what the person actually did. */
  useEffect(() => {
    if (!step) return

    if (step.advance.on === 'route') {
      const want = step.advance.path
      if (pathname === want || pathname.startsWith(`${want}/`)) next()
      return
    }

    if (step.advance.on === 'click' && step.anchor) {
      /* Delegated, not bound to the node we can see right now. React replaces
       * that node whenever the data behind it changes — which is exactly what
       * happens on this step, since the row only becomes a link once its
       * reconciliation exists — and a listener attached to the old node goes
       * with it, leaving the tour waiting for a click it can never hear. */
      const { anchor } = step
      const onClick = (e: Event) => {
        const target = e.target as Element | null
        if (target?.closest(`[data-tour="${anchor}"]`)) next()
      }
      document.addEventListener('click', onClick, true)
      return () => document.removeEventListener('click', onClick, true)
    }

    if (step.advance.on === 'change') {
      const { selector, identity } = step.advance
      /* The baseline has to be taken once the step's own route has rendered.
       * Reading it while the previous page is still mounted sees nothing, and
       * then everything the new page draws looks like it just arrived. */
      if (pathname !== step.route) return

      const signature = () =>
        [...document.querySelectorAll(selector)]
          .map((el) => el.getAttribute(identity) ?? '')
          .join('|')

      let baseline: string | null = null
      const settle = setTimeout(() => { baseline = signature() }, 400)

      const mo = new MutationObserver(() => {
        if (baseline === null) return
        if (signature() !== baseline) next()
      })
      mo.observe(document.body, { childList: true, subtree: true, attributes: true })
      return () => { clearTimeout(settle); mo.disconnect() }
    }
  }, [step, pathname, next])

  /* Escape leaves. A tour you cannot get out of is a modal in disguise. */
  useEffect(() => {
    if (status !== 'running') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, skip, next])

  const value = useMemo(
    () => ({ status, step, index, total: TOUR_STEPS.length, start, next, back, skip }),
    [status, step, index, start, next, back, skip],
  )

  return <TourContext value={value}>{children}</TourContext>
}

export function useTour(): TourValue {
  const v = use(TourContext)
  if (!v) throw new Error('useTour must be used inside <TourProvider>')
  return v
}
