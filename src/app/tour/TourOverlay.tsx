import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, X } from 'lucide-react'
import { useTour } from './TourProvider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TourStep } from './steps'

interface Box { top: number; left: number; width: number; height: number }

const PAD = 8
const CARD_W = 340

/**
 * The spotlight.
 *
 * A single dimming layer with a hole in it, and the hole moves. Everything
 * about it is one element with a very large box-shadow, which means position
 * and size can be transitioned — the light travels to the next control instead
 * of teleporting, and the eye follows it there. That travel IS the teaching;
 * a tour that cuts between highlights makes you hunt for the new one each time.
 *
 * The hole is not an overlay over the target: pointer events pass through it,
 * so the person clicks the real control and the product really responds.
 */
export function TourOverlay() {
  const { status, step, index, total, next, back, skip } = useTour()
  const [box, setBox] = useState<Box | null>(null)
  const [ready, setReady] = useState(false)

  const anchor = step?.anchor

  /* Follow the target through scrolling, resizing and layout changes. */
  useLayoutEffect(() => {
    if (status !== 'running') return

    /* Clear immediately on every step change. Leaving the previous box up
     * while the next target is still rendering means the light sits on the
     * wrong control and the card describes something else — worse than showing
     * nothing for a beat. */
    setBox(null)
    setReady(false)

    if (!anchor) { setReady(true); return }

    let raf = 0
    /* If the target never arrives — an empty queue, a slow route — stop
     * waiting and present the step centred rather than hanging. */
    const giveUp = setTimeout(() => setReady(true), 2500)

    const measure = () => {
      const el = document.querySelector(`[data-tour="${anchor}"]`)
      if (!el) return
      const r = el.getBoundingClientRect()
      setBox({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      })
      setReady(true)
    }
    measure()
    /* Chase the target hard for the first second — a route change re-lays out
     * the page under us and a lazy poll leaves the light on the old control
     * long enough to be seen doing it — then settle to a cheap watch. */
    const chase = setInterval(measure, 60)
    setTimeout(() => clearInterval(chase), 1200)
    const poll = setInterval(measure, 300)
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure) }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      clearTimeout(giveUp)
      clearInterval(chase)
      clearInterval(poll)
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [anchor, status, index])

  /* Bring the target into view before lighting it up. */
  useEffect(() => {
    if (!anchor || status !== 'running') return
    const el = document.querySelector(`[data-tour="${anchor}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [anchor, status])

  if (status !== 'running' || !step) return null

  /* Step copy is written for this product; there is no vocabulary layer to
   * substitute through any more. Kept as a function so a later revision can reintroduce
   * interpolation for the §20 script without touching every call site. */
  const words = (s: string) => s

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      {/* The dim, with a hole cut in it. transition-all is what makes the
          light travel between controls rather than jump. */}
      <div
        aria-hidden
        className={cn(
          'absolute rounded-lg transition-all duration-500 ease-out motion-reduce:transition-none',
          !box && 'opacity-0',
        )}
        style={{
          top: box?.top ?? window.innerHeight / 2,
          left: box?.left ?? window.innerWidth / 2,
          width: box?.width ?? 0,
          height: box?.height ?? 0,
          boxShadow: '0 0 0 9999px rgb(2 6 23 / 0.62)',
        }}
      />
      {/* Full dim for centred steps, which have no target. */}
      {!box && (
        <div aria-hidden className="absolute inset-0 bg-[rgb(2_6_23/0.62)] transition-opacity duration-300" />
      )}

      {/* A ring that keeps breathing on the target, so it stays findable while
          you read the card. */}
      {box && (
        <div
          aria-hidden
          className="border-rail-accent absolute rounded-lg border-2 transition-all duration-500 ease-out motion-reduce:transition-none motion-reduce:animate-none"
          style={{ ...box, animation: 'tour-pulse 2s ease-in-out infinite' }}
        />
      )}

      <Card step={step} box={box} index={index} total={total} words={words}
        onNext={next} onBack={back} onSkip={skip} visible={ready} />
    </div>
  )
}

function Card({
  step, box, index, total, words, onNext, onBack, onSkip, visible,
}: {
  step: TourStep
  box: Box | null
  index: number
  total: number
  words: (s: string) => string
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  visible: boolean
}) {
  /* Measured, not estimated. A guessed height is how a card ends up sitting
   * on the control it is pointing at. */
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: CARD_W, h: 240 })
  /* Deliberately without a dependency array, and oxlint warns about it.
   *
   * The card has to re-measure on every render because its height changes with
   * the step's copy, and `[]` would measure the first step and then place every
   * later one against a stale height. The setState is guarded by a 2px
   * threshold, so it converges on the second pass instead of looping — which is
   * what makes the missing array safe rather than merely tolerated. */
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (Math.abs(r.height - size.h) > 2) setSize({ w: r.width, h: r.height })
  })

  const pos = placeCard(box, step.place, size)

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Tour step ${index + 1} of ${total}`}
      className={cn(
        'border-border bg-surface pointer-events-auto absolute rounded-lg border shadow-xl lift',
        'transition-all duration-500 ease-out motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
      style={{ ...pos, width: CARD_W }}
    >
      {/* Progress fills as you go — the only honest way to answer  lift"how long is
          this going to take". */}
      <div className="bg-muted h-1 w-full overflow-hidden rounded-t-lg">
        <div
          className="bg-accent h-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground eyebrow">
            Step {index + 1} of {total}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mt-1 -mr-1 rounded-md p-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Skip the tour"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>

        <h2 className="text-foreground mt-1.5 text-sm font-semibold">{words(step.title)}</h2>
        <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{words(step.meaning)}</p>

        {step.action && (
          <p className="border-ai-border ai-surface text-foreground mt-3 rounded-sm border px-2.5 py-2 text-xs font-medium">
            {words(step.action)}
          </p>
        )}

        <div className="mt-3.5 flex items-center gap-2">
          {index > 0 && (
            <Button size="xs" variant="ghost" onClick={onBack}>
              <ChevronLeft className="size-3" aria-hidden />
              Back
            </Button>
          )}
          <button
            type="button"
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
          >
            Skip the tour
          </button>
          {/* Steps that wait on a real action have no Next: the product itself
              is the button. */}
          {step.advance.on === 'next' && (
            <Button size="xs" className="ml-auto" onClick={onNext}>
              {index + 1 === total ? 'Finish' : 'Next'}
              <ArrowRight className="size-3" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Puts the card beside its target, never on top of it.
 *
 * Clamping a position back inside the viewport is what used to happen, and
 * clamping pushes the card straight onto the thing it is pointing at — the
 * reader can see the instruction and cannot reach the control. So each
 * candidate is tested for two things: does it fit on screen, and does it
 * overlap the spotlight. Only a candidate that passes both is used.
 */
function placeCard(
  box: Box | null,
  place: TourStep['place'] = 'right',
  size: { w: number; h: number },
) {
  const M = 16
  const vw = window.innerWidth
  const vh = window.innerHeight
  const { w, h } = size

  if (!box || place === 'center') {
    return { top: Math.max(M, vh / 2 - h / 2), left: Math.max(M, vw / 2 - w / 2) }
  }

  const centreY = Math.min(Math.max(M, box.top + box.height / 2 - h / 2), vh - h - M)
  const centreX = Math.min(Math.max(M, box.left + box.width / 2 - w / 2), vw - w - M)

  const candidates: Record<string, { top: number; left: number }> = {
    right: { top: centreY, left: box.left + box.width + M },
    left: { top: centreY, left: box.left - w - M },
    bottom: { top: box.top + box.height + M, left: centreX },
    top: { top: box.top - h - M, left: centreX },
  }

  const onScreen = (p: { top: number; left: number }) =>
    p.left >= M && p.top >= M && p.left + w <= vw - M && p.top + h <= vh - M

  const clearOf = (p: { top: number; left: number }) =>
    p.left + w <= box.left || p.left >= box.left + box.width
    || p.top + h <= box.top || p.top >= box.top + box.height

  /* Preferred side first, then the rest — so a step that asked for "left"
   * only moves if left genuinely does not work. */
  const order = [place, 'right', 'left', 'bottom', 'top'].filter(
    (v, i, a) => a.indexOf(v) === i,
  ) as (keyof typeof candidates)[]

  for (const key of order) {
    const p = candidates[key]
    if (onScreen(p) && clearOf(p)) return p
  }

  /* Nothing fits beside it. Take the largest band of free space around the
   * target and sit in the middle of that, still never overlapping. */
  const gaps = [
    { key: 'below', space: vh - (box.top + box.height), top: box.top + box.height + M, left: centreX },
    { key: 'above', space: box.top, top: box.top - h - M, left: centreX },
    { key: 'rightOf', space: vw - (box.left + box.width), top: centreY, left: box.left + box.width + M },
    { key: 'leftOf', space: box.left, top: centreY, left: box.left - w - M },
  ].sort((a, b) => b.space - a.space)

  const best = gaps[0]
  return {
    top: Math.min(Math.max(M, best.top), vh - h - M),
    left: Math.min(Math.max(M, best.left), vw - w - M),
  }
}
