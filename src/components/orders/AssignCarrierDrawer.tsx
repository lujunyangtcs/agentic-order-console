import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Send, Wifi, WifiOff } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { GatedReveal } from '@/components/ai/GatedReveal'
import { api } from '@/services'
import type { Recommendation } from '@/services'
import { useActor } from '@/app/useActor'
import { useT, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Choosing a carrier.
 *
 * The console scores every carrier that serves the lane and shows the top
 * three with the five factors that made the score. The desk clicks one.
 * Nothing is sent until they do.
 */
export function AssignCarrierDrawer({
  orderId, open, onOpenChange, terminalName, city,
}: {
  orderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  terminalName: string
  city: string
}) {
  const t = useT()
  const qc = useQueryClient()
  const actor = useActor()
  const [other, setOther] = useState('')

  const rec = useQuery({ queryKey: ['recommend', orderId], queryFn: () => api.carrier.recommend(orderId), enabled: open })
  const carriers = useQuery({ queryKey: ['carriers'], queryFn: () => api.carrier.carriers(), enabled: open })

  const send = useMutation({
    mutationFn: ({ carrierId, rank }: { carrierId: string; rank: 1 | 2 | 3 | 0 }) => api.carrier.request(orderId, carrierId, rank, actor),
    onSuccess: (_res, vars) => {
      const name = carriers.data?.find((c) => c.id === vars.carrierId)?.name ?? rec.data?.find((r) => r.carrierId === vars.carrierId)?.carrierName ?? vars.carrierId
      toast.success(t('assign.sent', { carrier: name }))
      qc.invalidateQueries()
      onOpenChange(false)
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[500px]" data-drawer="assign">
        <SheetHeader>
          <SheetTitle>{t('assign.title')}</SheetTitle>
          <SheetDescription>{t('assign.desc', { terminal: terminalName, city })}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          <GatedReveal
            ready={!!rec.data}
            gateLabel={t('assign.gate')}
            doneLabel={t('assign.done')}
            typewriter={rec.data?.[0]?.rationale}
          >
            <ol className="flex flex-col gap-3">
              {(rec.data ?? []).map((r) => (
                <li key={r.carrierId}>
                  <SuggestionCard r={r} busy={send.isPending} onSend={() => send.mutate({ carrierId: r.carrierId, rank: r.rank })} />
                </li>
              ))}
            </ol>
          </GatedReveal>

          <section className="border-border rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{t('assign.others')}</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">{t('assign.othersHint')}</p>
            <div className="mt-3 flex gap-2">
              <select
                value={other}
                onChange={(e) => setOther(e.target.value)}
                aria-label={t('assign.others')}
                className="border-border bg-background text-foreground h-9 min-w-0 flex-1 rounded-md border px-2 text-xs"
              >
                <option value="">—</option>
                {(carriers.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.hasTms ? '' : ` · ${t('assign.portal')}`}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" disabled={!other || send.isPending} onClick={() => send.mutate({ carrierId: other, rank: 0 })} data-send-other>
                <Send className="size-3.5" aria-hidden />
                {t('assign.send')}
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

const FACTOR_KEY: Record<string, I18nKey> = {
  lane: 'assign.factor.lane',
  onTime: 'assign.factor.onTime',
  rate: 'assign.factor.rate',
  capacity: 'assign.factor.capacity',
  distance: 'assign.factor.distance',
}

function SuggestionCard({ r, busy, onSend }: { r: Recommendation; busy: boolean; onSend: () => void }) {
  const t = useT()
  return (
    <article
      data-suggestion={r.carrierId}
      className={cn('border-structural-border bg-surface flex h-full flex-col rounded-lg border p-4', r.rank === 1 && 'border-accent')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground eyebrow">{t('assign.rank', { n: r.rank })}</p>
          <h4 className="mt-0.5 truncate text-sm font-semibold">{r.carrierName}</h4>
        </div>
        <span className={cn('flex shrink-0 items-center gap-1 rounded-xs px-1.5 py-0.5 text-2xs font-medium', r.hasTms ? 'bg-verdict-pass-bg text-verdict-pass' : 'bg-muted text-muted-foreground')}>
          {r.hasTms ? <Wifi className="size-3" aria-hidden /> : <WifiOff className="size-3" aria-hidden />}
          {r.hasTms ? t('assign.tms') : t('assign.portal')}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="figure tabular text-2xl leading-none font-medium">{r.score}</span>
        <span className="text-muted-foreground text-xs">{t('assign.score')}</span>
        <span className="text-muted-foreground ml-auto tabular text-xs">
          {Math.round(r.onTimePct * 100)}% {t('assign.onTime')} · {r.freeTrucks} {t('assign.free')} · ${r.ratePerTonne.toFixed(2)} {t('assign.rate')}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {r.factors.map((f) => (
          <li key={f.key} className="grid grid-cols-[76px_1fr_auto] items-center gap-2 text-2xs">
            <span className="text-muted-foreground">{t(FACTOR_KEY[f.key] ?? 'assign.factor.lane')}</span>
            <span className="bg-muted h-1.5 overflow-hidden rounded-xs">
              <span className="bg-accent/70 block h-full rounded-xs" style={{ width: `${Math.round(f.value * 100)}%` }} />
            </span>
            <span className="tabular text-muted-foreground">{Math.round(f.weight * f.value)}/{f.weight}</span>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground border-border mt-3 border-t pt-2 text-2xs leading-relaxed">{r.rationale}</p>

      <Button size="sm" className="mt-3 w-full" disabled={busy} onClick={onSend} data-send={r.carrierId} data-variant={r.rank === 1 ? 'primary' : undefined}>
        <Send className="size-3.5" aria-hidden />
        {busy ? t('assign.sending') : t('assign.send')}
      </Button>
    </article>
  )
}
