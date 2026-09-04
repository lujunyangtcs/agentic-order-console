import { useSearchParams } from 'react-router'
import { useState } from 'react'
import { RotateCcw, X, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { reset, SEED_VERSION } from '@/services/mock/store'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/services'
import { nextStatus } from '@/types/domain'

/**
 * Reachable at `?dev=1` only.
 *
 * A demo needs a way back to a known state between rehearsals. The seed-key
 * probe is the one piece worth having early — a stale store is the failure
 * that costs an hour and looks like "my fixture edit did nothing".
 */
export function DevPanel() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(true)
  const qc = useQueryClient()
  if (params.get('dev') !== '1') return null

  /* Rehearsal shortcut: move the order on screen (or the hero order) one
     status forward as the demo administrator, without switching roles. */
  async function advanceOne() {
    const id = location.pathname.match(/^\/orders\/([^/]+)/)?.[1] ?? 'SO-1042'
    const d = await api.orders.detail(id)
    const nxt = d && !d.isRequest ? nextStatus(d.status) : null
    if (!d || !nxt) { toast.message(`${id}: nothing to advance`); return }
    await api.tracking.advance(id, nxt, { name: 'Demo administrator', role: 'Administrator' })
    toast.success(`${d.erpRef} → ${nxt.replace(/_/g, ' ')}`)
    qc.invalidateQueries()
  }

  const storeKeys = Object.keys(sessionStorage).filter((k) => k.startsWith('aoc.store.'))

  function resetAll() {
    reset()
    location.reload()
  }

  function close() {
    const next = new URLSearchParams(params)
    next.delete('dev')
    setParams(next, { replace: true })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border-border bg-surface text-muted-foreground hover:text-foreground fixed right-4 bottom-4 z-50 flex size-8 items-center justify-center rounded-xs border shadow-sm"
        aria-label="Open demo controls"
      >
        <FlaskConical className="size-4" aria-hidden />
      </button>
    )
  }

  return (
    <aside
      className="border-border bg-surface fixed right-4 bottom-4 z-50 w-72 rounded-lg border p-3 shadow-sm"
      aria-label="Demo controls"
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow text-muted-foreground">Demo controls</span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Collapse">
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Seed version</dt>
          <dd className="font-mono tabular-nums">{SEED_VERSION}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Seed keys held</dt>
          <dd className={cn('font-mono tabular-nums', storeKeys.length > 1 && 'text-sev-critical')}>{storeKeys.length}</dd>
        </div>
      </dl>

      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={advanceOne} data-dev-advance>
        <FlaskConical className="size-3.5" aria-hidden />
        Advance one step
      </Button>
      <Button variant="outline" size="sm" className="mt-2 w-full" onClick={resetAll}>
        <RotateCcw className="size-3.5" aria-hidden />
        Reset demo data
      </Button>

      <button onClick={close} className="text-muted-foreground hover:text-foreground mt-2 w-full text-2xs">
        Leave demo controls
      </button>
    </aside>
  )
}
