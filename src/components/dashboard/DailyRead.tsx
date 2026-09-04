import { useEffect, useRef, useState } from 'react'
import { Loader2, Sparkle } from 'lucide-react'
import { cn } from '@/lib/utils'

const GATE_MS = 850
const MS_PER_CHAR = 16

/**
 * The day's recommendation, revealed rather than simply printed.
 *
 * Two rules keep this from being theatre. It runs once on arrival and then
 * stops — there is no ambient loop, no pulsing, nothing still moving a minute
 * later. And the finished text is in the DOM from the first frame for screen
 * readers, with the visible layer reserving its own height, so nothing on the
 * page moves while it types.
 *
 * The sentence itself is computed, not written by a model, so it is labelled
 * "today's read" rather than presented as something authored.
 */
export function DailyRead({ sentence, className }: { sentence: string; className?: string }) {
  const [phase, setPhase] = useState<'gate' | 'typing' | 'done'>('gate')
  const [shown, setShown] = useState('')
  const timers = useRef<number[]>([])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setShown(sentence)
      setPhase('done')
      return
    }

    setPhase('gate')
    setShown('')
    const clear = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }

    const start = window.setTimeout(() => {
      setPhase('typing')
      for (let i = 1; i <= sentence.length; i += 1) {
        timers.current.push(
          window.setTimeout(() => {
            setShown(sentence.slice(0, i))
            if (i === sentence.length) setPhase('done')
          }, i * MS_PER_CHAR),
        )
      }
    }, GATE_MS)
    timers.current.push(start)

    return clear
  }, [sentence])

  return (
    <div className={cn('mt-4', className)}>
      <div className="text-ai-muted mb-1.5 flex items-center gap-1.5 eyebrow">
        {phase === 'gate' ? (
          <Loader2 className="text-accent-text size-3.5 animate-spin" aria-hidden />
        ) : (
          <Sparkle className="text-accent-text size-3.5" aria-hidden />
        )}
        {phase === 'gate' ? 'Working through today’s items' : 'Today’s read'}
      </div>

      {/* The full sentence is present for assistive tech immediately; the
          animated copy is decorative. */}
      <span className="sr-only">{sentence}</span>

      <div className="relative max-w-2xl" aria-hidden>
        {/* Reserves the final height so the typing never reflows the page. */}
        <p className="invisible text-sm leading-relaxed">{sentence}</p>
        <p className="text-foreground absolute inset-0 text-sm leading-relaxed">
          {phase === 'gate' ? '' : shown}
          {phase === 'typing' && (
            <span className="bg-accent ml-0.5 inline-block h-[1em] w-px translate-y-[0.15em] animate-pulse" />
          )}
        </p>
      </div>
    </div>
  )
}
