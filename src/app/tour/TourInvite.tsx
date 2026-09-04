import { Compass, X } from 'lucide-react'
import { useTour } from './TourProvider'
import { Button } from '@/components/ui/button'

/**
 * The offer, made once.
 *
 * A first-time account gets asked whether it wants showing round; it is not
 * dropped into a tour it did not ask for. Declining is a real decline — the
 * invitation does not come back, and the tour stays available from the user
 * menu for whoever wants it later.
 */
export function TourInvite() {
  const { status, start, skip } = useTour()
  if (status !== 'unseen') return null

  return (
    <div
      role="dialog"
      aria-label="Take the tour"
      className={cnInvite}
      style={{ animation: 'tour-rise 320ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <div className="flex items-start gap-3">
        <span className="bg-ai-from text-accent-text flex size-8 shrink-0 items-center justify-center rounded-md">
          <Compass className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-foreground text-sm font-semibold">First time here?</h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            A minute, walking you through one document end to end — where things arrive, how to add
            your own, and what to do with what we find.
          </p>
        </div>
        <button
          type="button"
          onClick={skip}
          aria-label="No thanks"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mt-1 -mr-1 shrink-0 rounded-md p-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={start}>
          <Compass className="size-3.5" aria-hidden />
          Show me round
        </Button>
        <Button size="sm" variant="ghost" onClick={skip}>
          I will find my own way
        </Button>
      </div>
    </div>
  )
}

const cnInvite =
  'border-border bg-surface fixed right-5 bottom-5 z-[80] w-[24rem] rounded-lg border p-4 shadow-xl lift'
