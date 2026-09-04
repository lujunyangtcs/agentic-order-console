import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, Sparkle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Suggestion, revealed rather than printed.
 *
 * A short gate with a spinner, then the content, then (optionally) one typed
 * sentence. It runs once per mount and stops — no ambient loop, nothing
 * still moving a minute later. Under reduced motion it renders finished.
 *
 * Used in exactly two places: the carrier suggestions and the estimated
 * arrival. Everything else on screen is a fact, and facts are not revealed.
 */
export function GatedReveal({
  gateLabel, doneLabel, typewriter, gateMs = 850, ready = true, children, className,
}: {
  gateLabel: string
  doneLabel: string
  typewriter?: string
  gateMs?: number
  /** Hold the gate open until the data behind it has arrived. */
  ready?: boolean
  children: ReactNode
  className?: string
}) {
  const [phase, setPhase] = useState<'gate' | 'typing' | 'done'>('gate')
  const [shown, setShown] = useState('')
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (!ready) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const clear = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
    if (reduced) {
      setShown(typewriter ?? '')
      setPhase('done')
      return
    }
    timers.current.push(
      window.setTimeout(() => {
        if (!typewriter) {
          setPhase('done')
          return
        }
        setPhase('typing')
        for (let i = 1; i <= typewriter.length; i += 1) {
          timers.current.push(
            window.setTimeout(() => {
              setShown(typewriter.slice(0, i))
              if (i === typewriter.length) setPhase('done')
            }, i * 14),
          )
        }
      }, gateMs),
    )
    return clear
  }, [ready, typewriter, gateMs])

  const gated = !ready || phase === 'gate'

  return (
    <div data-gated={gated ? 'open' : 'done'} className={cn('flex flex-col', className)}>
      <div className="text-ai-muted mb-2 flex items-center gap-1.5 eyebrow" aria-live="polite">
        {gated ? <Loader2 className="text-accent-text size-3.5 animate-spin" aria-hidden /> : <Sparkle className="text-accent-text size-3.5" aria-hidden />}
        {gated ? gateLabel : doneLabel}
      </div>
      {gated ? (
        <div className="bg-muted/60 h-24 animate-pulse rounded-lg" aria-hidden />
      ) : (
        <>
          {children}
          {typewriter && (
            <p className="text-ai-muted mt-3 min-h-5 text-xs leading-relaxed">
              <span className="sr-only">{typewriter}</span>
              <span aria-hidden>{shown}{phase === 'typing' ? <span className="ai-caret">▏</span> : null}</span>
            </p>
          )}
        </>
      )}
    </div>
  )
}
